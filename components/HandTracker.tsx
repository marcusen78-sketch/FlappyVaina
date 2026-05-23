"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import {
  createHandsPool,
  updateHandsPool,
  addHandLighting,
  type Landmark,
} from "@/lib/hand3d";

// ---------------------------------------------------------------------------
// Temporal smoothing (EMA) — eliminates jitter without noticeable latency
// ---------------------------------------------------------------------------

const EMA_ALPHA = 0.35; // lower = smoother but more lag

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

    // Trim stale entries when fewer hands are detected
    if (hands.length < this.prev.length) {
      this.prev.length = hands.length;
    }

    return out;
  }
}

// ---------------------------------------------------------------------------
// Map MediaPipe normalised coordinates (0→1) into Three.js world units
// ---------------------------------------------------------------------------

function mapLandmarks(raw: { x: number; y: number; z: number }[]): Landmark[] {
  return raw.map((lm) => ({
    x: (lm.x - 0.5) * 5,
    y: -(lm.y - 0.5) * 4,
    z: -lm.z * 4,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HandTracker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Cargando modelo de manos...");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    let disposed = false;

    /* ── Scene ─────────────────────────────────────────────── */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2f4f7);

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      50
    );
    camera.position.set(0, 0, 4.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    /* ── Lighting (from hand3d) ───────────────────────────── */
    addHandLighting(scene);

    /* ── Hand pool ────────────────────────────────────────── */
    const pool = createHandsPool(2);
    pool.forEach((h) => scene.add(h));

    /* ── Temporal smoother ────────────────────────────────── */
    const smoother = new LandmarkSmoother();

    /* ── Render loop ──────────────────────────────────────── */
    let animId: number;
    function animate() {
      if (disposed) return;
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    /* ── Resize ───────────────────────────────────────────── */
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", onResize);

    /* ── MediaPipe + webcam ───────────────────────────────── */
    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");
    video.muted = true;

    let lastVideoTime = -1;
    let results: ReturnType<HandLandmarker["detectForVideo"]> | null = null;

    async function startDetection() {
      setStatus("Cargando modelo de manos...");

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
        // ── Lowered thresholds for better tracking ──
        minHandDetectionConfidence: 0.3,
        minHandPresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
      });

      setStatus("Solicitando cámara...");

      // ── Higher resolution camera for better detection ──
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
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
          // Map from normalised coords → world units, then smooth
          const mapped = results.landmarks.map(mapLandmarks);
          const smoothed = smoother.smooth(mapped);
          updateHandsPool(pool, smoothed);
        } else {
          updateHandsPool(pool, []);
        }

        requestAnimationFrame(detect);
      }

      detect();
    }

    startDetection().catch((err) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("HandTracker error:", err);
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
    <div
      className="relative w-screen h-screen"
      style={{ background: "#f2f4f7" }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
      {!ready && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "#f2f4f7" }}
        >
          <p className="text-lg" style={{ color: "#6b7c8d" }}>
            {status}
          </p>
        </div>
      )}
    </div>
  );
}
