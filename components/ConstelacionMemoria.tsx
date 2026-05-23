"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { PinchDetector } from "@/lib/pinch-detector";
import { ConstelacionEngine, type ConstelacionState, type GamePhase } from "@/lib/constelacion-logic";
import { ConstelacionSceneManager } from "@/lib/constelacion-scene";

const EMA_ALPHA = 0.55;

class HandSmoother {
  private prev: { x: number; y: number; z: number }[] = [];
  private lostFrames = 0;
  private maxLost = 12;

  smooth(raw: { x: number; y: number; z: number }[] | null): { x: number; y: number; z: number }[] | null {
    if (!raw) {
      if (this.prev.length > 0 && this.lostFrames < this.maxLost) {
        this.lostFrames++;
        return this.prev.map((l) => ({ ...l }));
      }
      this.prev = [];
      return null;
    }
    this.lostFrames = 0;
    if (this.prev.length === 0) {
      this.prev = raw.map((l) => ({ ...l }));
      return raw;
    }
    const smoothed: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < raw.length; i++) {
      const p = this.prev[i];
      const s = {
        x: p.x + EMA_ALPHA * (raw[i].x - p.x),
        y: p.y + EMA_ALPHA * (raw[i].y - p.y),
        z: p.z + EMA_ALPHA * 0.35 * (raw[i].z - p.z),
      };
      smoothed.push(s);
      this.prev[i] = s;
    }
    return smoothed;
  }
}

function mapLandmarks(raw: { x: number; y: number; z: number }[]): { x: number; y: number; z: number }[] {
  return raw.map((lm) => ({
    x: -(lm.x - 0.5) * 3.0,
    y: -(lm.y - 0.5) * 2.0 - 0.2,
    z: -lm.z * 0.5,
  }));
}

export default function ConstelacionMemoria() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Iniciando cámara...");
  const [ready, setReady] = useState(false);
  const [gameState, setGameState] = useState<ConstelacionState | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let disposed = false;

    const sceneManager = new ConstelacionSceneManager(canvas);
    const engine = new ConstelacionEngine();
    const pinchDetector = new PinchDetector({ pinchThreshold: 0.18, releaseThreshold: 0.28 });
    const smoother = new HandSmoother();

    let currentPhase: GamePhase = "IDLE";
    let observeSetup = false;
    let tracingSetup = false;
    let activeTracePoints: THREE.Vector3[] = [];
    let lastConnectedSegment = -1;

    setGameState(engine.getState());

    let animId: number;
    let lastTime = performance.now();

    function animate() {
      if (disposed) return;
      animId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(50, now - lastTime);
      lastTime = now;

      const state = engine.getState();
      sceneManager.update(state, dt / 1000);
      sceneManager.render();
    }
    animate();

    function onResize() {
      sceneManager.resize();
    }
    window.addEventListener("resize", onResize);

    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");
    video.muted = true;

    let lastVideoTime = -1;
    let results: ReturnType<HandLandmarker["detectForVideo"]> | null = null;

    async function start() {
      setStatus("Cargando modelo de detección...");
      const vision = await FilesetResolver.forVisionTasks("/wasm");

      setStatus("Inicializando detector...");
      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });

      setStatus("Solicitando cámara...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });

      video.srcObject = stream;
      await new Promise<void>((r) =>
        video.addEventListener("loadeddata", () => r(), { once: true })
      );

      setReady(true);

      let prevTime = performance.now();

      function detect() {
        if (disposed) return;
        const now = performance.now();
        const deltaMs = Math.min(100, now - prevTime);
        prevTime = now;

        if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
          lastVideoTime = video.currentTime;
          results = handLandmarker.detectForVideo(video, now);
        }

        let smoothedLandmarks: { x: number; y: number; z: number }[] | null = null;
        let pinchResult = null;

        if (results && results.landmarks && results.landmarks.length > 0) {
          const mapped = mapLandmarks(results.landmarks[0]);
          smoothedLandmarks = smoother.smooth(mapped);

          if (smoothedLandmarks) {
            pinchResult = pinchDetector.update(smoothedLandmarks);
            sceneManager.updateCursor(pinchResult.position, true, pinchResult.state === "pinching");
          }
        } else {
          smoother.smooth(null);
          sceneManager.updateCursor({ x: 0, y: 0, z: 0 }, false);
        }

        const state = engine.update(pinchResult, smoothedLandmarks, deltaMs);
        setGameState(state);

        // Phase transition handling
        if (state.phase !== currentPhase) {
          handlePhaseTransition(currentPhase, state.phase, state);
          currentPhase = state.phase;
        }

        // Tracing: only draw tube when anchored on origin star
        if (state.phase === "TRACING" && pinchResult && smoothedLandmarks) {
          if (state.tracingAnchored && pinchResult.state === "pinching") {
            activeTracePoints.push(
              new THREE.Vector3(pinchResult.position.x, pinchResult.position.y, pinchResult.position.z)
            );
            if (activeTracePoints.length > 200) {
              activeTracePoints = activeTracePoints.filter((_, i) => i % 2 === 0);
            }
            sceneManager.updateActiveTube(activeTracePoints);
          } else if (!state.tracingAnchored || pinchResult.state !== "pinching") {
            if (activeTracePoints.length > 0) {
              activeTracePoints = [];
              sceneManager.updateActiveTube([]);
            }
          }

          // Check if a new segment was completed
          if (state.starsConnected > lastConnectedSegment + 1) {
            const segIdx = lastConnectedSegment + 1;
            sceneManager.completeSegment(activeTracePoints.length > 1 ? [...activeTracePoints] : []);
            activeTracePoints = [];
            sceneManager.updateActiveTube([]);
            lastConnectedSegment = segIdx;

            if (state.constellation) {
              const seg = state.constellation.segments[segIdx];
              if (seg) sceneManager.markStarConnected(seg.to);
            }
          }
        }

        requestAnimationFrame(detect);
      }
      detect();
    }

    function handlePhaseTransition(from: GamePhase, to: GamePhase, state: ConstelacionState) {
      if (to === "OBSERVING" && state.constellation) {
        if (!observeSetup) {
          sceneManager.setupConstellation(state.constellation);
          sceneManager.showStarNumbers(state.constellation.order);
          observeSetup = true;
        }
      }

      if (to === "TRACING" && state.constellation) {
        if (!tracingSetup) {
          sceneManager.hideStarNumbers();
          sceneManager.resetStarVisuals();
          sceneManager.showGuideCurves(state.constellation);
          // Mark first star as connected (starting point)
          sceneManager.markStarConnected(state.constellation.segments[0]?.from ?? 0);
          lastConnectedSegment = -1;
          activeTracePoints = [];
          tracingSetup = true;
        }
      }
    }

    start().catch((err) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("ConstelacionMemoria error:", err);
      setStatus("Error: " + msg);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      sceneManager.dispose();
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const phaseLabel = (phase: GamePhase | undefined): string => {
    switch (phase) {
      case "IDLE": return "ESPERANDO MANO";
      case "CALIBRATING": return "CALIBRANDO";
      case "OBSERVING": return "OBSERVA LA SECUENCIA";
      case "TRACING": return "REPRODUCE LA SECUENCIA";
      case "RESULTS": return "RESULTADOS";
      default: return "";
    }
  };

  const clouds = [
    { top: "12%", size: 140, duration: 55, delay: 0, opacity: 0.85 },
    { top: "32%", size: 90, duration: 75, delay: -20, opacity: 0.6 },
    { top: "55%", size: 180, duration: 90, delay: -45, opacity: 0.75 },
    { top: "72%", size: 110, duration: 65, delay: -10, opacity: 0.55 },
  ];

  return (
    <div
      className="relative w-screen h-screen overflow-hidden select-none bg-cover bg-no-repeat"
      style={{ backgroundImage: "url(/night-sky-bg.jpg)", imageRendering: "pixelated", backgroundPosition: "center 20%" }}
    >
      {/* Pixel clouds behind everything */}
      {clouds.map((c, i) => (
        <img
          key={i}
          src="/pixel-cloud.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute z-0"
          style={{
            top: c.top,
            width: `${c.size}px`,
            height: "auto",
            opacity: c.opacity,
            imageRendering: "pixelated" as const,
            animationName: "cloud-drift",
            animationDuration: `${c.duration}s`,
            animationTimingFunction: "linear",
            animationDelay: `${c.delay}s`,
            animationIterationCount: "infinite",
          }}
        />
      ))}

      {/* Three.js canvas with transparent background */}
      <canvas ref={canvasRef} className="block w-full h-full absolute inset-0 z-[1]" />

      {/* Loading overlay */}
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50"
          style={{ backgroundImage: "url(/night-sky-bg.jpg)", backgroundSize: "cover", backgroundPosition: "center 20%" }}
        >
          <div className="w-12 h-12 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin mb-4" />
          <p className="text-slate-300 font-light tracking-wide text-lg">{status}</p>
        </div>
      )}

      {/* HUD */}
      {ready && gameState && (
        <>
          {/* IDLE: big centered message */}
          {gameState.phase === "IDLE" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
              <div className="bg-black/40 backdrop-blur-sm px-10 py-6 rounded-2xl border border-white/10">
                <p className="text-white text-xl font-light tracking-wide text-center mb-2">
                  Muestra tu mano a la cámara
                </p>
                <p className="text-white/50 text-sm font-light tracking-wide text-center">
                  Se detectará automáticamente
                </p>
              </div>
            </div>
          )}

          {/* CALIBRATING: prominent banner + progress */}
          {gameState.phase === "CALIBRATING" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
              <div className="bg-black/40 backdrop-blur-sm px-10 py-6 rounded-2xl border border-white/10 flex flex-col items-center">
                <p className="text-amber-300 text-lg font-medium tracking-wider uppercase mb-1">
                  Calibrando
                </p>
                <p className="text-white/70 text-sm font-light tracking-wide mb-4">
                  Abre y cierra la mano varias veces
                </p>
                <div className="w-56 h-2 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-200"
                    style={{ width: `${Math.min(100, (gameState.phaseElapsedMs / 5000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* OBSERVING: large top banner + star counter + progress bar */}
          {gameState.phase === "OBSERVING" && (
            <>
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <div className="bg-black/40 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/10">
                  <p className="text-indigo-300 text-base font-medium tracking-wider uppercase text-center">
                    Observa la secuencia
                  </p>
                  <p className="text-white/50 text-xs font-light tracking-wide text-center mt-1">
                    Estrella {Math.min(5, (gameState.currentStarIlluminated >= 0 ? gameState.currentStarIlluminated + 1 : 0))} de 5
                  </p>
                </div>
              </div>
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10 pointer-events-none">
                <div className="w-56 h-2 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 rounded-full transition-all duration-75"
                    style={{ width: `${gameState.observeProgress * 100}%` }}
                  />
                </div>
              </div>
            </>
          )}

          {/* TRACING: action banner + score + timer */}
          {gameState.phase === "TRACING" && (
            <>
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <div className="bg-black/40 backdrop-blur-sm px-6 py-3 rounded-xl border border-emerald-500/20">
                  <p className="text-emerald-300 text-base font-medium tracking-wider uppercase text-center">
                    Reproduce la secuencia
                  </p>
                  <p className="text-white/50 text-xs font-light tracking-wide text-center mt-1">
                    Haz pinza en cada estrella y traza hasta la siguiente
                  </p>
                </div>
              </div>
              <div className="absolute top-6 right-8 z-10 pointer-events-none">
                <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10">
                  <span className="text-white text-3xl font-extralight tracking-widest">
                    {gameState.starsConnected + 1}
                  </span>
                  <span className="text-white/50 text-base font-extralight"> / 5</span>
                </div>
              </div>
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <div className="bg-black/30 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/10">
                  <span className="text-white/70 text-sm font-light tracking-widest">
                    {Math.max(0, Math.ceil((60000 - gameState.phaseElapsedMs) / 1000))}s
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Results */}
          {gameState.phase === "RESULTS" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
              <div className="bg-slate-900/90 p-8 rounded-2xl shadow-xl max-w-sm w-full mx-4 border border-white/10 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-light text-white tracking-wide mb-1">Sesión Completa</h2>
                <p className="text-white/40 text-sm font-light mb-6">Datos registrados</p>
                <div className="grid grid-cols-2 gap-4 w-full mb-6">
                  <div className="bg-white/10 p-4 rounded-xl">
                    <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold mb-1">Estrellas</div>
                    <div className="text-3xl font-light text-white">{gameState.starsConnected + 1}<span className="text-white/40 text-lg"> /5</span></div>
                  </div>
                  <div className="bg-white/10 p-4 rounded-xl">
                    <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold mb-1">Errores</div>
                    <div className="text-3xl font-light text-white">{gameState.sequenceErrors}</div>
                  </div>
                </div>
                <p className="text-white/30 text-xs font-light">Ver consola para métricas completas</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
