"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { FistDetector } from "@/lib/fist-detector";
import { FlappyEngine, FlappyState } from "@/lib/flappy-logic";
import { FlappySceneManager } from "@/lib/flappy-scene";
import Link from "next/link";

const EMA_ALPHA_DEFAULT = 0.55;

class SingleHandSmoother {
  private prev: { x: number; y: number; z: number }[] = [];
  public lostFrames = 0;
  private maxLostFrames = 12;

  smooth(raw: { x: number; y: number; z: number }[] | null): { x: number; y: number; z: number }[] | null {
    if (!raw) {
      if (this.prev.length > 0 && this.lostFrames < this.maxLostFrames) {
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
        x: p.x + EMA_ALPHA_DEFAULT * (raw[i].x - p.x),
        y: p.y + EMA_ALPHA_DEFAULT * (raw[i].y - p.y),
        z: p.z + (EMA_ALPHA_DEFAULT * 0.35) * (raw[i].z - p.z),
      };
      smoothed.push(s);
      this.prev[i] = s;
    }
    return smoothed;
  }
}

class LandmarkSmoother {
  private smoothers = [new SingleHandSmoother(), new SingleHandSmoother()];
  smooth(hands: { x: number; y: number; z: number }[][]): { x: number; y: number; z: number }[][] {
    const out: { x: number; y: number; z: number }[][] = [];
    for (let i = 0; i < this.smoothers.length; i++) {
      const rawHand = i < hands.length ? hands[i] : null;
      const smoothed = this.smoothers[i].smooth(rawHand);
      if (smoothed) out.push(smoothed);
    }
    return out;
  }
}

function mapLandmarks(raw: { x: number; y: number; z: number }[]): { x: number; y: number; z: number }[] {
  return raw.map((lm) => ({
    x: -(lm.x - 0.5) * 3.0,
    y: -(lm.y - 0.5) * 2.0 - 0.2,
    z: -lm.z * 0.5,
  }));
}

export default function FlappyGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Iniciando cámara...");
  const [ready, setReady] = useState(false);
  
  // Game states managed in React to update UI HUD
  const [engineState, setEngineState] = useState<FlappyState | null>(null);
  const [fistStrength, setFistStrength] = useState(0);
  const fistStrengthRef = useRef(0);

  // Countdown state (5, 4, 3, 2, 1, 0 -> starts game)
  const [countdown, setCountdown] = useState<number | null>(null);

  // References to communicate with WebGL loop
  const engineRef = useRef<FlappyEngine | null>(null);
  const restartTriggerRef = useRef<(() => void) | null>(null);

  // Countdown timer effect
  useEffect(() => {
    if (!ready) return;
    if (countdown === null) return;

    if (countdown === 0) {
      const timer = setTimeout(() => {
        setCountdown(null);
        restartTriggerRef.current?.(); // Starts physical simulation in engine
      }, 700); // display "¡YA!" briefly
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [ready, countdown]);

  // Start countdown as soon as tracking is ready
  useEffect(() => {
    if (ready) {
      setCountdown(5);
    }
  }, [ready]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let disposed = false;

    // 1. Initialize Scene & WebGL (Greek columns, paper plane, sky clouds)
    const sceneManager = new FlappySceneManager(canvas);
    
    // 2. Initialize Game Engine
    const engine = new FlappyEngine();
    engineRef.current = engine;
    setEngineState(engine.getState());

    // 3. Initialize Detectors
    const fistDetector = new FistDetector();
    const smoother = new LandmarkSmoother();

    // Trigger restart
    restartTriggerRef.current = () => {
      engine.start();
      setEngineState(engine.getState());
    };

    // Render loop
    let animId: number;
    let lastTime = performance.now();

    function animate() {
      if (disposed) return;
      animId = requestAnimationFrame(animate);

      const now = performance.now();
      const deltaTime = Math.min(0.05, (now - lastTime) / 1000); // cap to avoid spikes
      lastTime = now;

      // Update engine state in physics loop
      const currentState = engine.getState();
      if (currentState.status === "playing") {
        const updated = engine.update(fistStrengthRef.current, deltaTime);
        setEngineState(updated);
        sceneManager.update(updated, deltaTime);
      } else {
        // Just update decorative scenery (clouds)
        sceneManager.update(currentState, deltaTime);
      }

      sceneManager.renderer.render(sceneManager.scene, sceneManager.camera);
    }
    animate();

    function onResize() {
      sceneManager.resize();
    }
    window.addEventListener("resize", onResize);

    // 4. MediaPipe camera setup (tracks hand behind the scenes)
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
        numHands: 1, // only need one hand for flappy bird controls
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

      function detect() {
        if (disposed) return;
        const now = performance.now();

        if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
          lastVideoTime = video.currentTime;
          results = handLandmarker.detectForVideo(video, now);
        }

        if (results && results.landmarks && results.landmarks.length > 0) {
          const mapped = results.landmarks.map(mapLandmarks);
          const smoothed = smoother.smooth(mapped);

          // Update fist strength from the main hand
          const fistRes = fistDetector.update(smoothed[0]);
          fistStrengthRef.current = fistRes.strength;
          setFistStrength(fistRes.strength);
        } else {
          fistStrengthRef.current = 0;
          setFistStrength(0);
        }

        requestAnimationFrame(detect);
      }
      detect();
    }

    start().catch((err) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("FlappyGame error:", err);
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
  }, []); // <-- Removed fistStrength from dependencies to prevent constant restarts!

  const handleRestart = () => {
    setCountdown(5);
  };

  return (
    <div className="relative w-screen h-screen bg-[#eaf0f4] overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Loading Overlay */}
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#eaf0f4] z-50">
          <div className="w-12 h-12 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p className="text-slate-500 font-light tracking-wide text-lg">{status}</p>
        </div>
      )}

      {/* Main HUD overlay */}
      {ready && engineState && (
        <>
          {/* Top Score display */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10 pointer-events-none">
            <span className="text-slate-800 text-5xl font-extralight tracking-widest">
              {engineState.score}
            </span>
            <span className="text-slate-400 text-xs font-light tracking-wider uppercase">
              Récord: {engineState.highScore}
            </span>
          </div>

          {/* Fist strength indicator (floating minimalist bar at bottom) */}
          {(engineState.status === "playing" || countdown !== null) && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10 pointer-events-none">
              <div className="w-48 h-1.5 bg-slate-200/50 rounded-full overflow-hidden backdrop-blur-xs">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-75"
                  style={{ width: `${fistStrength * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">
                {fistStrength > 0.8 ? "Propulsión Máxima" : fistStrength > 0.1 ? "Subiendo..." : "Descendiendo"}
              </span>
            </div>
          )}

          {/* COUNTDOWN Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/10 backdrop-blur-xs z-30 pointer-events-none">
              <div className="text-center animate-pulse">
                <span className="text-slate-800 text-[10rem] font-extralight tracking-widest leading-none drop-shadow-sm select-none">
                  {countdown === 0 ? "¡YA!" : countdown}
                </span>
                <p className="text-slate-500 text-xs font-light tracking-widest uppercase mt-4">
                  {countdown === 0 ? "¡A VOLAR!" : "Prepárate para cerrar el puño"}
                </p>
              </div>
            </div>
          )}

          {/* GAMEOVER state screen */}
          {engineState.status === "gameover" && countdown === null && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 backdrop-blur-xs z-20">
              <div className="bg-white/95 p-8 rounded-2xl shadow-xl max-w-sm w-full mx-4 border border-slate-100 flex flex-col items-center text-center animate-scale-up">
                <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-5">
                  <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-light text-slate-800 tracking-wide mb-1">Juego Terminado</h2>
                <p className="text-slate-400 text-sm font-light mb-6">Colisión detectada</p>
                
                <div className="grid grid-cols-2 gap-4 w-full mb-6">
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Puntuación</div>
                    <div className="text-2xl font-light text-slate-700">{engineState.score}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Récord</div>
                    <div className="text-2xl font-light text-slate-700">{engineState.highScore}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={handleRestart}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium tracking-wide shadow-md shadow-indigo-100 transition-colors duration-200"
                  >
                    Volver a Intentarlo
                  </button>
                  <Link
                    href="/"
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium tracking-wide transition-colors duration-200"
                  >
                    Volver al Menú
                  </Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
