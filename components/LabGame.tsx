"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import {
  createHandsPool,
  updateHandsPool,
  type Landmark,
  type HandModel,
} from "@/lib/hand3d-procedural";
import { createLabScene, setupLabLighting, setupLabCamera, type LabScene } from "@/lib/lab-scene";
import { PinchDetector } from "@/lib/pinch-detector";
import { LabEngine, type LabGameState } from "@/lib/lab-logic";

// ---------------------------------------------------------------------------
// Smoothing
// ---------------------------------------------------------------------------

const EMA_ALPHA = 0.55;

class LandmarkSmoother {
  private prev: Landmark[][] = [];

  smooth(hands: Landmark[][]): Landmark[][] {
    const out: Landmark[][] = [];
    for (let h = 0; h < hands.length; h++) {
      const raw = hands[h];
      if (!this.prev[h]) {
        this.prev[h] = raw.map((l) => ({ ...l }));
        out.push(raw);
        continue;
      }
      const smoothed: Landmark[] = [];
      for (let i = 0; i < raw.length; i++) {
        const p = this.prev[h][i];
        const s: Landmark = {
          x: p.x + EMA_ALPHA * (raw[i].x - p.x),
          y: p.y + EMA_ALPHA * (raw[i].y - p.y),
          z: p.z + EMA_ALPHA * (raw[i].z - p.z),
        };
        smoothed.push(s);
        this.prev[h][i] = s;
      }
      out.push(smoothed);
    }
    if (hands.length < this.prev.length) {
      this.prev.length = hands.length;
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Landmark mapping (mirrored X, offset Y down toward table level)
// ---------------------------------------------------------------------------

function mapLandmarks(raw: { x: number; y: number; z: number }[]): Landmark[] {
  return raw.map((lm) => ({
    x: -(lm.x - 0.5) * 3.0,
    y: -(lm.y - 0.5) * 2.0 - 0.3,
    z: -lm.z * 0.5,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LabGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Cargando...");
  const [ready, setReady] = useState(false);
  const [labState, setLabState] = useState<LabGameState | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let disposed = false;

    // Scene
    const scene = new THREE.Scene();
    const camera = setupLabCamera();
    setupLabLighting(scene);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lab scene
    const labSceneData = createLabScene(scene);

    // Game engine
    const labEngine = new LabEngine(labSceneData);

    // Pinch detector
    const pinchDetector = new PinchDetector();

    // Hand
    let pool: HandModel[] = [];
    const smoother = new LandmarkSmoother();

    // Render loop
    let animId: number;
    let lastTime = performance.now();

    function animate() {
      if (disposed) return;
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", onResize);

    // Video
    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");
    video.muted = true;

    let lastVideoTime = -1;
    let results: ReturnType<HandLandmarker["detectForVideo"]> | null = null;

    async function start() {
      setStatus("Cargando mano 3D...");
      pool = await createHandsPool(2);
      pool.forEach((h) => scene.add(h.root));

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
        numHands: 2,
        minHandDetectionConfidence: 0.3,
        minHandPresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
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
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;

        if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
          lastVideoTime = video.currentTime;
          results = handLandmarker.detectForVideo(video, now);
        }

        if (results && results.landmarks && results.landmarks.length > 0) {
          const mapped = results.landmarks.map(mapLandmarks);
          const smoothed = smoother.smooth(mapped);
          updateHandsPool(pool, smoothed);

          const pinchResult = pinchDetector.update(smoothed[0]);
          const state = labEngine.update(pinchResult, deltaTime);
          setLabState(state);
        } else {
          updateHandsPool(pool, []);
        }

        requestAnimationFrame(detect);
      }
      detect();
    }

    start().catch((err) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("LabGame error:", err);
      setStatus("Error: " + msg);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="relative w-screen h-screen bg-white">
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Loading */}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <p className="text-gray-400 text-lg">{status}</p>
        </div>
      )}

      {/* HUD */}
      {ready && labState && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-6">
          <span className="text-gray-600 text-sm font-light tracking-wide">
            {labState.score} / {labState.totalBalls}
          </span>
          {labState.errors > 0 && (
            <span className="text-red-300 text-sm font-light">
              {labState.errors} {labState.errors === 1 ? "error" : "errores"}
            </span>
          )}
        </div>
      )}

      {/* Completion */}
      {labState?.isComplete && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/95 px-10 py-6 rounded-2xl shadow-sm text-center">
            <p className="text-gray-700 text-xl font-light mb-2">Completado</p>
            <p className="text-gray-400 text-sm">
              {labState.errors === 0
                ? "Sin errores"
                : `${labState.errors} ${labState.errors === 1 ? "error" : "errores"}`}
            </p>
          </div>
        </div>
      )}

      {/* Instruction */}
      {ready && labState && !labState.isComplete && labState.score === 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <p className="text-gray-300 text-sm font-light">
            Pellizca cada bola y sueltala en el tubo de su color
          </p>
        </div>
      )}
    </div>
  );
}
