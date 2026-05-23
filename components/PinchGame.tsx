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
import { createGameScene, setupGameLighting, setupGameCamera, resetGameScene, type GameScene } from "@/lib/game-scene";
import { PinchDetector } from "@/lib/pinch-detector";
import { GameEngine, type GameState } from "@/lib/game-logic";

// ---------------------------------------------------------------------------
// Smoothing
// ---------------------------------------------------------------------------

const EMA_ALPHA_DEFAULT = 0.55;

class SingleHandSmoother {
  private prev: Landmark[] = [];
  public lostFrames = 0;
  private maxLostFrames = 12; // ~400ms at 30fps

  private dist2D(a: Landmark, b: Landmark): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private dist3D(a: Landmark, b: Landmark): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private getTemplateLandmark(
    i: number,
    scale: number,
    d: Landmark,
    s: Landmark,
    pinchFactor: number
  ): Landmark {
    let coeffD = 0;
    let coeffS = 0;
    let pinchCoeffD = 0;
    let pinchCoeffS = 0;

    switch (i) {
      case 0:
        coeffD = 0; coeffS = 0;
        pinchCoeffD = 0; pinchCoeffS = 0;
        break;

      // Thumb
      case 1:
        coeffD = 0.15; coeffS = -0.15;
        pinchCoeffD = 0.15; pinchCoeffS = -0.15;
        break;
      case 2:
        coeffD = 0.25; coeffS = -0.25;
        pinchCoeffD = 0.25; pinchCoeffS = -0.25;
        break;
      case 3:
        coeffD = 0.35; coeffS = -0.32;
        pinchCoeffD = 0.35; pinchCoeffS = -0.24;
        break;
      case 4:
        coeffD = 0.45; coeffS = -0.38;
        pinchCoeffD = 0.52; pinchCoeffS = -0.20;
        break;

      // Index
      case 5:
        coeffD = 0.35; coeffS = -0.08;
        pinchCoeffD = 0.35; pinchCoeffS = -0.08;
        break;
      case 6:
        coeffD = 0.55; coeffS = -0.08;
        pinchCoeffD = 0.45; pinchCoeffS = -0.12;
        break;
      case 7:
        coeffD = 0.70; coeffS = -0.08;
        pinchCoeffD = 0.50; pinchCoeffS = -0.16;
        break;
      case 8:
        coeffD = 0.82; coeffS = -0.08;
        pinchCoeffD = 0.52; pinchCoeffS = -0.20;
        break;

      // Middle
      case 9: coeffD = 0.37; coeffS = 0.0; break;
      case 10: coeffD = 0.60; coeffS = 0.0; break;
      case 11: coeffD = 0.77; coeffS = 0.0; break;
      case 12: coeffD = 0.90; coeffS = 0.0; break;

      // Ring
      case 13: coeffD = 0.35; coeffS = 0.08; break;
      case 14: coeffD = 0.55; coeffS = 0.08; break;
      case 15: coeffD = 0.70; coeffS = 0.08; break;
      case 16: coeffD = 0.82; coeffS = 0.08; break;

      // Pinky
      case 17: coeffD = 0.30; coeffS = 0.15; break;
      case 18: coeffD = 0.46; coeffS = 0.15; break;
      case 19: coeffD = 0.58; coeffS = 0.15; break;
      case 20: coeffD = 0.68; coeffS = 0.15; break;
    }

    if (i >= 9) {
      pinchCoeffD = coeffD;
      pinchCoeffS = coeffS;
    }

    const finalCoeffD = (1 - pinchFactor) * coeffD + pinchFactor * pinchCoeffD;
    const finalCoeffS = (1 - pinchFactor) * coeffS + pinchFactor * pinchCoeffS;

    return {
      x: finalCoeffD * scale * d.x + finalCoeffS * scale * s.x,
      y: finalCoeffD * scale * d.y + finalCoeffS * scale * s.y,
      z: finalCoeffD * scale * d.z + finalCoeffS * scale * s.z,
    };
  }

  smooth(raw: Landmark[] | null): Landmark[] | null {
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

    // 1. Detect foreshortening (hand pointing directly at camera)
    // Compare 2D vs 3D length of the palm (wrist: 0 to middle MCP: 9)
    const palm2d = this.dist2D(raw[0], raw[9]);
    const palm3d = this.dist3D(raw[0], raw[9]);
    const palmRatio = palm3d > 0.001 ? palm2d / palm3d : 1.0;

    // Compare index finger (5 to 8)
    const idx2d = this.dist2D(raw[5], raw[8]);
    const idx3d = this.dist3D(raw[5], raw[8]);
    const idxRatio = idx3d > 0.001 ? idx2d / idx3d : 1.0;

    // Compare middle finger (9 to 12)
    const mid2d = this.dist2D(raw[9], raw[12]);
    const mid3d = this.dist3D(raw[9], raw[12]);
    const midRatio = mid3d > 0.001 ? mid2d / mid3d : 1.0;

    const foreshortening = (palmRatio + idxRatio + midRatio) / 3.0;

    // 2. Determine snap blending factor
    // We snap when foreshortening is low (pointing at camera, hand parallel to floor)
    let snapBlend = 0.0;
    if (foreshortening < 0.65) {
      // Linear blend from 0.0 to 1.0 as foreshortening goes from 0.65 to 0.45
      snapBlend = Math.max(0, Math.min(1, (0.65 - foreshortening) / (0.65 - 0.45)));
    }

    let blendedRaw = raw;
    if (snapBlend > 0) {
      const scale = this.dist3D(raw[0], raw[9]);

      // Pointing vector d (wrist to middle MCP)
      const dx = raw[9].x - raw[0].x;
      const dy = raw[9].y - raw[0].y;
      const dz = raw[9].z - raw[0].z;
      const lenD3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const d = {
        x: lenD3D > 0.001 ? dx / lenD3D : 0,
        y: lenD3D > 0.001 ? dy / lenD3D : 0,
        z: lenD3D > 0.001 ? dz / lenD3D : 1,
      };

      // Side vector s (index MCP to pinky MCP)
      const sx = raw[17].x - raw[5].x;
      const sy = raw[17].y - raw[5].y;
      const sz = raw[17].z - raw[5].z;
      const lenS3D = Math.sqrt(sx * sx + sy * sy + sz * sz);
      const s = {
        x: lenS3D > 0.001 ? sx / lenS3D : 1,
        y: lenS3D > 0.001 ? sy / lenS3D : 0,
        z: lenS3D > 0.001 ? sz / lenS3D : 0,
      };

      // Project to horizontal plane (y=0) and normalize to force parallel orientation
      const dProj = { x: d.x, y: 0, z: d.z };
      const sProj = { x: s.x, y: 0, z: s.z };

      const lenDProj = Math.sqrt(dProj.x * dProj.x + dProj.z * dProj.z);
      if (lenDProj > 0.001) {
        dProj.x /= lenDProj;
        dProj.z /= lenDProj;
      } else {
        dProj.z = 1;
      }

      const lenSProj = Math.sqrt(sProj.x * sProj.x + sProj.z * sProj.z);
      if (lenSProj > 0.001) {
        sProj.x /= lenSProj;
        sProj.z /= lenSProj;
      } else {
        sProj.x = 1;
      }

      // Pinch factor based on raw distance between thumb tip (4) and index tip (8)
      const trackedDist = this.dist3D(raw[4], raw[8]);
      const pinchFactor = Math.max(0, Math.min(1, (0.22 - trackedDist) / (0.22 - 0.08)));

      blendedRaw = raw.map((lm, idx) => {
        if (idx === 0) return lm; // Keep raw wrist position
        const flatOffset = this.getTemplateLandmark(idx, scale, dProj, sProj, pinchFactor);
        const flatPos = {
          x: raw[0].x + flatOffset.x,
          y: raw[0].y + flatOffset.y,
          z: raw[0].z + flatOffset.z,
        };
        return {
          x: (1 - snapBlend) * lm.x + snapBlend * flatPos.x,
          y: (1 - snapBlend) * lm.y + snapBlend * flatPos.y,
          z: (1 - snapBlend) * lm.z + snapBlend * flatPos.z,
        };
      });
    }

    // 3. Compute dynamic alpha and smooth
    let alpha = EMA_ALPHA_DEFAULT;
    if (foreshortening < 0.65) {
      // Extra heavy filtering as we enter/exit snapping to smooth transitions
      const t = Math.max(0, Math.min(1, (foreshortening - 0.3) / (0.65 - 0.3)));
      alpha = 0.08 + t * (EMA_ALPHA_DEFAULT - 0.08);
    }

    const smoothed: Landmark[] = [];
    for (let i = 0; i < blendedRaw.length; i++) {
      const p = this.prev[i];
      // Keep Z axis smoother only when tracking, snap pose has stable Z
      const alphaZ = alpha * (snapBlend > 0 ? 1.0 : 0.35);

      const s: Landmark = {
        x: p.x + alpha * (blendedRaw[i].x - p.x),
        y: p.y + alpha * (blendedRaw[i].y - p.y),
        z: p.z + alphaZ * (blendedRaw[i].z - p.z),
      };
      smoothed.push(s);
      this.prev[i] = s;
    }

    return smoothed;
  }
}

class LandmarkSmoother {
  private smoothers: SingleHandSmoother[] = [new SingleHandSmoother(), new SingleHandSmoother()];

  smooth(hands: Landmark[][]): Landmark[][] {
    const out: Landmark[][] = [];
    for (let i = 0; i < this.smoothers.length; i++) {
      const rawHand = i < hands.length ? hands[i] : null;
      const smoothed = this.smoothers[i].smooth(rawHand);
      if (smoothed) {
        out.push(smoothed);
      }
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Map MediaPipe normalized coords → scene space (mirrored X for natural feel)
// ---------------------------------------------------------------------------

// Map landmarks so hand range aligns with game objects.
// Objects live at x:[-1.2, -0.4] (left table) to [0.4, 1.2] (right table), y≈-0.5
// MediaPipe gives x,y in [0,1]. We map so the hand naturally covers the game area.
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

export default function PinchGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Cargando...");
  const [ready, setReady] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let disposed = false;

    // Scene
    const scene = new THREE.Scene();
    const camera = setupGameCamera();
    setupGameLighting(scene);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Game scene (tables + objects)
    const gameSceneData = createGameScene(scene);

    // Game engine
    const gameEngine = new GameEngine(gameSceneData);

    // Pinch detector
    const pinchDetector = new PinchDetector({
      pinchThreshold: 0.08,
      releaseThreshold: 0.12,
    });

    // Hand tracking pool
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

    // MediaPipe
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

          // Use first hand for pinch detection
          const pinchResult = pinchDetector.update(smoothed[0]);
          const state = gameEngine.update(pinchResult, deltaTime);
          setGameState(state);
        } else {
          updateHandsPool(pool, []);
        }

        requestAnimationFrame(detect);
      }
      detect();
    }

    start().catch((err) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("PinchGame error:", err);
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

      {/* Loading overlay */}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <p className="text-gray-400 text-lg">{status}</p>
        </div>
      )}

      {/* HUD */}
      {ready && gameState && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
          <span className="text-gray-500 text-sm font-light tracking-wide">
            {gameState.score} / {gameState.totalObjects}
          </span>
        </div>
      )}

      {/* Success message */}
      {gameState?.isComplete && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 px-8 py-4 rounded-xl shadow-sm">
            <p className="text-gray-700 text-lg font-light">Completado</p>
          </div>
        </div>
      )}


    </div>
  );
}
