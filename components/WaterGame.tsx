"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { PronationDetector } from "@/lib/pronation-detector";
import { WaterEngine, type WaterState } from "@/lib/water-logic";
import { WaterSceneManager } from "@/lib/water-scene";
import Link from "next/link";

export default function WaterGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Iniciando cámara...");
  const [engineState, setEngineState] = useState<WaterState | null>(null);

  // Countdown state (5, 4, 3, 2, 1, 0 -> starts game)
  const [countdown, setCountdown] = useState<number | null>(null);

  const engineRef = useRef<WaterEngine | null>(null);
  const restartTriggerRef = useRef<(() => void) | null>(null);
  
  // To pass data from the CV thread to the animation loop
  const pitcherRotRef = useRef<number>(0);
  const isPouringRef = useRef<boolean>(false);

  // Countdown timer effect
  useEffect(() => {
    if (!ready) return;
    if (countdown === null) return;

    if (countdown === 0) {
      const timer = setTimeout(() => {
        setCountdown(null);
        restartTriggerRef.current?.();
      }, 700);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [ready, countdown]);

  useEffect(() => {
    if (ready) {
      setCountdown(5);
    }
  }, [ready]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let disposed = false;

    // 1. Initialize Scene & Engine
    const sceneManager = new WaterSceneManager(canvas);
    const engine = new WaterEngine();
    engineRef.current = engine;
    setEngineState(engine.getState());

    const detector = new PronationDetector();

    restartTriggerRef.current = () => {
      engine.startLevel();
      setEngineState(engine.getState());
    };

    // 2. Render loop
    let animId: number;
    let lastTime = performance.now();

    function animate() {
      if (disposed) return;
      animId = requestAnimationFrame(animate);

      const now = performance.now();
      const deltaTime = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const updated = engine.update(pitcherRotRef.current, deltaTime);
      setEngineState(updated);
      sceneManager.update(updated, pitcherRotRef.current);

      sceneManager.renderer.render(sceneManager.scene, sceneManager.camera);
    }
    animate();

    function onResize() {
      sceneManager.resize();
    }
    window.addEventListener("resize", onResize);

    // 3. MediaPipe camera setup
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

      function detect() {
        if (disposed) return;
        const now = performance.now();

        if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
          lastVideoTime = video.currentTime;
          results = handLandmarker.detectForVideo(video, now);
        }

        if (results && results.landmarks && results.landmarks.length > 0) {
          const pronationRes = detector.update(results.landmarks[0]);
          const targetRot = pronationRes.pitcherRotationZ;
          const currentRot = pitcherRotRef.current;
          
          // Shortest path angle
          let diff = targetRot - currentRot;
          while (diff > Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          
          // 1. Heavy LERP step (0.08 factor instead of 0.15 for extra weight)
          let step = diff * 0.08;
          
          // 2. Velocity Clamp (Glitch Rejection)
          // Humans can't rotate their wrist 180 degrees in 1 frame.
          // Max angular velocity allowed per frame: ~0.06 radians (approx 3.5 degrees/frame)
          const maxStep = 0.06;
          if (step > maxStep) step = maxStep;
          if (step < -maxStep) step = -maxStep;
          
          pitcherRotRef.current = currentRot + step;
        }

        requestAnimationFrame(detect);
      }
      detect();
    }

    start().catch((err) => {
      console.error("WaterGame error:", err);
      setStatus("Error: " + (err instanceof Error ? err.message : String(err)));
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

  const handleRestart = () => {
    setCountdown(5);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#f1f5f9] select-none">
      {/* 3D Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Loading Overlay */}
      {!ready && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#fcfcfc] backdrop-blur-sm">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p className="text-slate-500 font-light tracking-wide">{status}</p>
        </div>
      )}

      {/* Countdown Overlay */}
      {ready && countdown !== null && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/60 backdrop-blur-md">
          <div className="text-center animate-in zoom-in duration-300">
            <span className="block text-9xl font-black text-slate-800 drop-shadow-sm tracking-tighter">
              {countdown === 0 ? "¡YA!" : countdown}
            </span>
          </div>
        </div>
      )}

      {/* Main UI Overlay */}
      {ready && countdown === null && engineState && (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
          
          {/* Top Bar */}
          <div className="flex justify-between items-start w-full max-w-5xl mx-auto">
            <div className="pointer-events-auto">
              <Link
                href="/"
                className="inline-flex items-center justify-center w-12 h-12 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-slate-100 text-slate-400 hover:text-indigo-600 hover:shadow-md transition-all duration-200"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
            </div>
            <div className="bg-white/80 backdrop-blur-md px-6 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center">
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Ronda</span>
                <span className="text-2xl font-light text-slate-700 leading-none">{engineState.round} <span className="text-sm text-slate-400">/ 3</span></span>
              </div>
            </div>
          </div>

          {/* Bottom Bar / Notifications */}
          <div className="w-full max-w-xl mx-auto text-center pointer-events-auto">
            {engineState.phase === "waiting" && (
              <div className="bg-white/90 backdrop-blur-md py-4 px-12 inline-block rounded-full shadow-lg border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
                <span className="text-xl font-medium tracking-wide text-slate-700">¡Gira la jarra para llenarla!</span>
              </div>
            )}
            
            {engineState.phase === "pouring" && (
              <div className="bg-white/90 backdrop-blur-md py-4 px-8 rounded-3xl shadow-lg border border-slate-100 animate-in slide-in-from-bottom-10">
                <div className="w-full bg-slate-100 rounded-full h-2 mt-1 overflow-hidden border border-slate-200">
                  <div 
                    className="bg-emerald-400 h-2 rounded-full transition-all duration-75 ease-linear"
                    style={{ width: `${Math.min(100, (engineState.stabilityTimer / 1.0) * 100)}%` }}
                  ></div>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400 mt-2 block">
                  {engineState.stabilityTimer > 0 ? "¡Mantén la posición!" : "Agua al vaso (Izq) | Veneno a la basura (Der)"}
                </span>
              </div>
            )}
            {/* Phase Success - Automatic Redirect to Menu */}
            {engineState.phase === "success" && (
              <div className="bg-white/95 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl border border-slate-100 animate-in zoom-in-95">
                <h2 className="text-2xl font-medium text-slate-800 mb-2">¡Sesión Completada!</h2>
                <p className="text-slate-500 font-light">Volviendo al menú principal...</p>
                {setTimeout(() => { window.location.href = "/" }, 2000) && null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
