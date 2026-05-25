"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import {
  createHandsPool,
  updateHandsPool,
  addHandLighting,
  type Landmark,
  type HandModel,
} from "@/lib/hand3d-procedural";
import { createGameScene, setupGameLighting, setupGameCamera } from "@/lib/game-scene";
import { PinchDetector } from "@/lib/pinch-detector";
import { GameEngine, type GameState } from "@/lib/game-logic";

// ---------------------------------------------------------------------------
// Smoothing — same as HandTracker (constant EMA 0.55, no velocity-adaptive)
// ---------------------------------------------------------------------------

const EMA_ALPHA_DEFAULT = 0.55;

class SingleHandSmoother {
  private prev: Landmark[] = [];
  public lostFrames = 0;
  private maxLostFrames = 12;

  private dist2D(a: Landmark, b: Landmark): number {
    const dx = a.x - b.x; const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  private dist3D(a: Landmark, b: Landmark): number {
    const dx = a.x - b.x; const dy = a.y - b.y; const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private getTemplateLandmark(i: number, scale: number, d: Landmark, s: Landmark, pinchFactor: number): Landmark {
    let coeffD = 0, coeffS = 0, pinchCoeffD = 0, pinchCoeffS = 0;
    switch (i) {
      case 0: break;
      case 1: coeffD=0.15; coeffS=-0.15; pinchCoeffD=0.15; pinchCoeffS=-0.15; break;
      case 2: coeffD=0.25; coeffS=-0.25; pinchCoeffD=0.25; pinchCoeffS=-0.25; break;
      case 3: coeffD=0.35; coeffS=-0.32; pinchCoeffD=0.35; pinchCoeffS=-0.24; break;
      case 4: coeffD=0.45; coeffS=-0.38; pinchCoeffD=0.52; pinchCoeffS=-0.20; break;
      case 5: coeffD=0.35; coeffS=-0.08; pinchCoeffD=0.35; pinchCoeffS=-0.08; break;
      case 6: coeffD=0.55; coeffS=-0.08; pinchCoeffD=0.45; pinchCoeffS=-0.12; break;
      case 7: coeffD=0.70; coeffS=-0.08; pinchCoeffD=0.50; pinchCoeffS=-0.16; break;
      case 8: coeffD=0.82; coeffS=-0.08; pinchCoeffD=0.52; pinchCoeffS=-0.20; break;
      case 9: coeffD=0.37; coeffS=0.0; break;
      case 10: coeffD=0.60; coeffS=0.0; break;
      case 11: coeffD=0.77; coeffS=0.0; break;
      case 12: coeffD=0.90; coeffS=0.0; break;
      case 13: coeffD=0.35; coeffS=0.08; break;
      case 14: coeffD=0.55; coeffS=0.08; break;
      case 15: coeffD=0.70; coeffS=0.08; break;
      case 16: coeffD=0.82; coeffS=0.08; break;
      case 17: coeffD=0.30; coeffS=0.15; break;
      case 18: coeffD=0.46; coeffS=0.15; break;
      case 19: coeffD=0.58; coeffS=0.15; break;
      case 20: coeffD=0.68; coeffS=0.15; break;
    }
    if (i >= 9) { pinchCoeffD = coeffD; pinchCoeffS = coeffS; }
    const fD = (1 - pinchFactor) * coeffD + pinchFactor * pinchCoeffD;
    const fS = (1 - pinchFactor) * coeffS + pinchFactor * pinchCoeffS;
    return { x: fD * scale * d.x + fS * scale * s.x, y: fD * scale * d.y + fS * scale * s.y, z: fD * scale * d.z + fS * scale * s.z };
  }

  smooth(raw: Landmark[] | null): Landmark[] | null {
    if (!raw) {
      if (this.prev.length > 0 && this.lostFrames < this.maxLostFrames) { this.lostFrames++; return this.prev.map(l => ({ ...l })); }
      this.prev = []; return null;
    }
    this.lostFrames = 0;
    if (this.prev.length === 0) { this.prev = raw.map(l => ({ ...l })); return raw; }

    const palm2d = this.dist2D(raw[0], raw[9]), palm3d = this.dist3D(raw[0], raw[9]);
    const idx2d  = this.dist2D(raw[5], raw[8]), idx3d  = this.dist3D(raw[5], raw[8]);
    const mid2d  = this.dist2D(raw[9], raw[12]), mid3d = this.dist3D(raw[9], raw[12]);
    const foreshortening = (
      (palm3d > 0.001 ? palm2d / palm3d : 1) +
      (idx3d  > 0.001 ? idx2d  / idx3d  : 1) +
      (mid3d  > 0.001 ? mid2d  / mid3d  : 1)
    ) / 3;

    let snapBlend = 0;
    if (foreshortening < 0.65) snapBlend = Math.max(0, Math.min(1, (0.65 - foreshortening) / (0.65 - 0.45)));

    let blendedRaw = raw;
    if (snapBlend > 0) {
      const scale = this.dist3D(raw[0], raw[9]);
      const dx = raw[9].x - raw[0].x, dy = raw[9].y - raw[0].y, dz = raw[9].z - raw[0].z;
      const lenD = Math.sqrt(dx*dx+dy*dy+dz*dz);
      const d = { x: lenD>0.001?dx/lenD:0, y: lenD>0.001?dy/lenD:0, z: lenD>0.001?dz/lenD:1 };
      const sx = raw[17].x - raw[5].x, sy = raw[17].y - raw[5].y, sz = raw[17].z - raw[5].z;
      const lenS = Math.sqrt(sx*sx+sy*sy+sz*sz);
      const s = { x: lenS>0.001?sx/lenS:1, y: lenS>0.001?sy/lenS:0, z: lenS>0.001?sz/lenS:0 };
      const dProj = { x: d.x, y: 0, z: d.z }; const sProj = { x: s.x, y: 0, z: s.z };
      const lenDP = Math.sqrt(dProj.x*dProj.x+dProj.z*dProj.z);
      if (lenDP>0.001){dProj.x/=lenDP;dProj.z/=lenDP;}else{dProj.z=1;}
      const lenSP = Math.sqrt(sProj.x*sProj.x+sProj.z*sProj.z);
      if (lenSP>0.001){sProj.x/=lenSP;sProj.z/=lenSP;}else{sProj.x=1;}
      const trackedDist = this.dist3D(raw[4], raw[8]);
      const pinchFactor = Math.max(0, Math.min(1, (0.22 - trackedDist) / (0.22 - 0.08)));
      blendedRaw = raw.map((lm, idx) => {
        if (idx === 0) return lm;
        const off = this.getTemplateLandmark(idx, scale, dProj, sProj, pinchFactor);
        const flat = { x: raw[0].x+off.x, y: raw[0].y+off.y, z: raw[0].z+off.z };
        return { x: (1-snapBlend)*lm.x+snapBlend*flat.x, y: (1-snapBlend)*lm.y+snapBlend*flat.y, z: (1-snapBlend)*lm.z+snapBlend*flat.z };
      });
    }

    let alpha = EMA_ALPHA_DEFAULT;
    if (foreshortening < 0.65) {
      const t = Math.max(0, Math.min(1, (foreshortening - 0.3) / (0.65 - 0.3)));
      alpha = 0.08 + t * (EMA_ALPHA_DEFAULT - 0.08);
    }

    const smoothed: Landmark[] = [];
    for (let i = 0; i < blendedRaw.length; i++) {
      const p = this.prev[i];
      const alphaZ = alpha * (snapBlend > 0 ? 1.0 : 0.35);
      const sv: Landmark = {
        x: p.x + alpha  * (blendedRaw[i].x - p.x),
        y: p.y + alpha  * (blendedRaw[i].y - p.y),
        z: p.z + alphaZ * (blendedRaw[i].z - p.z),
      };
      smoothed.push(sv);
      this.prev[i] = sv;
    }
    return smoothed;
  }
}

class LandmarkSmoother {
  private smoothers = [new SingleHandSmoother(), new SingleHandSmoother()];
  smooth(hands: Landmark[][]): Landmark[][] {
    const out: Landmark[][] = [];
    for (let i = 0; i < this.smoothers.length; i++) {
      const s = this.smoothers[i].smooth(i < hands.length ? hands[i] : null);
      if (s) out.push(s);
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Coordinate mappers
// ---------------------------------------------------------------------------

// Game objects live in a specific volume — use tighter mapping for physics
function mapLandmarksGame(raw: { x: number; y: number; z: number }[]): Landmark[] {
  return raw.map(lm => ({ x: -(lm.x - 0.5) * 3.0, y: -(lm.y - 0.5) * 2.0 - 0.3, z: -lm.z * 0.5 }));
}

// Hand overlay uses the same mapping as HandTracker — wider, centered on screen
function mapLandmarksOverlay(raw: { x: number; y: number; z: number }[]): Landmark[] {
  return raw.map(lm => ({ x: -(lm.x - 0.5) * 3.5, y: -(lm.y - 0.5) * 2.5, z: -lm.z * 1.0 }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PinchGame() {
  const gameCanvasRef    = useRef<HTMLCanvasElement>(null);
  const handCanvasRef    = useRef<HTMLCanvasElement>(null);
  const [status, setStatus]     = useState("Cargando...");
  const [ready,  setReady]      = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    const gameCanvas = gameCanvasRef.current;
    const handCanvas = handCanvasRef.current;
    if (!gameCanvas || !handCanvas) return;
    let disposed = false;

    // ── Game scene (tables + objects) ────────────────────────────────────────
    const gameScene  = new THREE.Scene();
    const gameCamera = setupGameCamera();
    setupGameLighting(gameScene);
    const gameRenderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true });
    gameRenderer.setSize(window.innerWidth, window.innerHeight);
    gameRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    gameRenderer.shadowMap.enabled = true;
    gameRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const gameSceneData = createGameScene(gameScene);
    const gameEngine    = new GameEngine(gameSceneData);
    const pinchDetector = new PinchDetector();

    // ── Hand overlay scene (transparent, on top) ─────────────────────────────
    const handScene  = new THREE.Scene();
    // Camera matches HandTracker exactly
    const handCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 100);
    handCamera.position.set(0, 0, 3);
    handCamera.lookAt(0, 0, 0);
    const handRenderer = new THREE.WebGLRenderer({ canvas: handCanvas, antialias: true, alpha: true });
    handRenderer.setSize(window.innerWidth, window.innerHeight);
    handRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    handRenderer.setClearColor(0x000000, 0); // fully transparent background
    addHandLighting(handScene);

    // Hand pool lives only in the overlay scene
    let handPool: HandModel[] = [];
    const smootherGame    = new LandmarkSmoother(); // drives game physics
    const smootherOverlay = new LandmarkSmoother(); // drives hand visuals

    // ── Render loops (independent) ────────────────────────────────────────────
    let gameAnimId: number;
    let handAnimId: number;

    function animateGame() {
      if (disposed) return;
      gameAnimId = requestAnimationFrame(animateGame);
      gameRenderer.render(gameScene, gameCamera);
    }
    function animateHand() {
      if (disposed) return;
      handAnimId = requestAnimationFrame(animateHand);
      handRenderer.render(handScene, handCamera);
    }
    animateGame();
    animateHand();

    function onResize() {
      gameCamera.aspect = handCamera.aspect = window.innerWidth / window.innerHeight;
      gameCamera.updateProjectionMatrix();
      handCamera.updateProjectionMatrix();
      gameRenderer.setSize(window.innerWidth, window.innerHeight);
      handRenderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", onResize);

    // ── MediaPipe ─────────────────────────────────────────────────────────────
    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");
    video.muted = true;

    let lastVideoTime = -1;
    let lastMPResults: ReturnType<HandLandmarker["detectForVideo"]> | null = null;

    // Score ref to avoid setState on every frame
    const lastScoreRef = { score: -1, isComplete: false };

    async function start() {
      setStatus("Cargando mano 3D...");
      handPool = await createHandsPool(2);
      handPool.forEach(h => handScene.add(h.root));

      setStatus("Cargando modelo de detección...");
      const vision = await FilesetResolver.forVisionTasks("/wasm");

      setStatus("Inicializando detector...");
      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
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
      await new Promise<void>(r => video.addEventListener("loadeddata", () => r(), { once: true }));

      setReady(true);

      function detect() {
        if (disposed) return;
        const now = performance.now();
        const deltaTime = 1 / 60; // stable fixed step for game logic

        // Run MediaPipe only when there is a new video frame
        if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
          lastVideoTime = video.currentTime;
          lastMPResults = handLandmarker.detectForVideo(video, now);
        }

        if (lastMPResults?.landmarks?.length) {
          const rawLandmarks = lastMPResults.landmarks;

          // Game physics: tight mapping so hand covers game object area
          const mappedGame   = rawLandmarks.map(mapLandmarksGame);
          const smoothedGame = smootherGame.smooth(mappedGame);

          // Pinch + game logic — no React setState on every frame
          const pinchResult = pinchDetector.update(smoothedGame[0]);
          const state = gameEngine.update(pinchResult, deltaTime);

          // Only trigger React re-render when score or completion changes
          if (state.score !== lastScoreRef.score || state.isComplete !== lastScoreRef.isComplete) {
            lastScoreRef.score = state.score;
            lastScoreRef.isComplete = state.isComplete;
            setGameState({ ...state });
          }

          // Hand overlay: wider mapping same as HandTracker, dedicated smoother
          const mappedOverlay   = rawLandmarks.map(mapLandmarksOverlay);
          const smoothedOverlay = smootherOverlay.smooth(mappedOverlay);
          updateHandsPool(handPool, smoothedOverlay.length ? smoothedOverlay : []);
        } else {
          smootherGame.smooth([]);    // advances lost-frame counters
          smootherOverlay.smooth([]); // same
          updateHandsPool(handPool, []);
        }

        requestAnimationFrame(detect);
      }
      detect();
    }

    start().catch(err => {
      setStatus("Error: " + (err instanceof Error ? err.message : JSON.stringify(err)));
      console.error("PinchGame error:", err);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(gameAnimId);
      cancelAnimationFrame(handAnimId);
      window.removeEventListener("resize", onResize);
      gameRenderer.dispose();
      handRenderer.dispose();
      if (video.srcObject) (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="relative w-screen h-screen">
      {/* Game canvas — bottom layer */}
      <canvas ref={gameCanvasRef} className="absolute inset-0 w-full h-full" />

      {/* Hand overlay canvas — transparent, on top, non-interactive */}
      <canvas ref={handCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

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
