/**
 * HandInputProvider.ts
 *
 * Implements InputProvider using MediaPipe HandLandmarker.
 * Maps hand position + pinch gesture to InputEvent (down/move/up),
 * identical to the mouse events the Slingshot already understands.
 *
 * Landmarks used:
 *   4  = thumb tip
 *   8  = index finger tip
 *   Cursor = midpoint of thumb tip and index tip, mapped to world space.
 *
 * Pinch detection uses hysteresis to avoid flickering:
 *   PINCH_START < distance → activate pinch
 *   distance > PINCH_END   → deactivate pinch
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { InputProvider, InputEvent } from './types';

// ── Constants ──────────────────────────────────────────────────────────────────

const WORLD_W = 1280;
const WORLD_H = 720;

// Pinch thresholds (normalized MediaPipe units, 0–1).
// Two-threshold hysteresis prevents flickering.
const PINCH_START = 0.08; // distance to ACTIVATE pinch (higher = easier to trigger)
const PINCH_END   = 0.12; // distance to DEACTIVATE pinch

// EMA smoothing factor for cursor position (0 = no smoothing, 1 = frozen).
// 0.5 removes high-frequency jitter without noticeable lag.
const SMOOTH_ALPHA = 0.5;

// Minimum movement in world units to emit a 'move' event (reduces spam).
const MOVE_THRESHOLD = 2;

// ── Hand cursor state (published to the UI overlay) ────────────────────────────

export interface HandCursorState {
  x: number;          // screen px (relative to canvas top-left)
  y: number;
  isPinching: boolean;
  visible: boolean;
  landmarks?: { x: number; y: number }[]; // Full 21-point skeleton
}

type CursorListener = (state: HandCursorState) => void;

// ── Provider ───────────────────────────────────────────────────────────────────

export class HandInputProvider implements InputProvider {
  private canvas: HTMLCanvasElement | null = null;
  private video: HTMLVideoElement | null = null;
  private landmarker: HandLandmarker | null = null;
  private rafId: number | null = null;
  private stream: MediaStream | null = null;

  private subscribers: Set<(e: InputEvent) => void> = new Set();
  private cursorListeners: Set<CursorListener> = new Set();

  // Smoothed cursor position (world coordinates)
  private smoothX = WORLD_W / 2;
  private smoothY = WORLD_H / 2;
  private smoothLandmarks: { x: number; y: number }[] = [];

  // State machine
  private isPinching = false;
  private lastEmittedX = 0;
  private lastEmittedY = 0;

  // Ready signal
  private readyResolve: (() => void) | null = null;
  readonly ready: Promise<void>;

  constructor() {
    this.ready = new Promise<void>((resolve) => {
      this.readyResolve = resolve;
    });
  }

  // ── InputProvider.start ───────────────────────────────────────────────────────

  async start(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;

    // 1. Init MediaPipe HandLandmarker
    await this.initLandmarker();

    // 2. Start camera
    await this.startCamera();

    // 3. Start detection loop
    this.loop();

    this.readyResolve?.();
  }

  // ── InputProvider.stop ────────────────────────────────────────────────────────

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video.remove();
      this.video = null;
    }
    this.canvas = null;
    this.isPinching = false;
  }

  // ── InputProvider.subscribe ───────────────────────────────────────────────────

  subscribe(cb: (e: InputEvent) => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  // ── Cursor state subscription (for overlay UI) ────────────────────────────────

  subscribeCursor(cb: CursorListener): () => void {
    this.cursorListeners.add(cb);
    return () => this.cursorListeners.delete(cb);
  }

  // ── Private: init MediaPipe ───────────────────────────────────────────────────

  private async initLandmarker(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    // TFLite logs INFO messages via console.error; suppress them during init
    // to prevent Next.js dev overlay from treating them as real errors.
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : '';
      if (msg.startsWith('INFO:')) return;
      originalError.apply(console, args);
    };

    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'CPU', // GPU causes main-thread blocking in some browsers
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });
    } finally {
      console.error = originalError;
    }
  }

  // ── Private: camera ───────────────────────────────────────────────────────────

  private async startCamera(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, facingMode: 'user' },
      audio: false,
    });

    const video = document.createElement('video');
    video.srcObject = this.stream;
    video.playsInline = true;
    video.muted = true;
    // Hidden but still being decoded by the browser
    video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(video);
    this.video = video;

    await new Promise<void>((resolve) => {
      video.onloadeddata = () => resolve();
      video.play();
    });
  }

  // ── Private: detection loop ────────────────────────────────────────────────────

  private lastDetectTime = 0;

  private loop = (): void => {
    const video = this.video;
    const landmarker = this.landmarker;
    const canvas = this.canvas;

    if (!video || !landmarker || !canvas) return;

    const now = performance.now();
    
    // Throttle MediaPipe detection to ~30 FPS (every 30ms) to avoid blocking the main thread,
    // which starves the Matter.js physics engine and React rendering loop running at 60 FPS.
    if (now - this.lastDetectTime > 30) {
      if (video.readyState >= 2) {
        const results = landmarker.detectForVideo(video, now);
        this.lastDetectTime = performance.now(); // update after processing

        const lm = results.landmarks?.[0];
        if (lm && lm.length >= 9) {
          this.processLandmarks(lm, canvas);
        } else {
          // No hand visible — release pinch if held
          if (this.isPinching) {
            this.isPinching = false;
            this.emit('up', this.smoothX, this.smoothY);
          }
          this.publishCursor(this.smoothX, this.smoothY, false, false, undefined);
        }
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  };


  // ── Private: landmark processing ──────────────────────────────────────────────

  private processLandmarks(lm: { x: number; y: number; z: number }[], canvas: HTMLCanvasElement) {
    const thumbRaw = lm[4];
    const indexRaw = lm[8];

    // 1. Calculate the 'Action Point' (midpoint of thumb and index) in normalized camera space [0, 1]
    const actionNormX = (thumbRaw.x + indexRaw.x) / 2;
    const actionNormY = (thumbRaw.y + indexRaw.y) / 2;

    // 2. Map Action Point to screen coordinates.
    // We add a 'sensitivity' multiplier so the user doesn't have to reach the extreme edges of the camera.
    // Map the center 60% of the camera to 100% of the screen.
    const SENSITIVITY = 1.6;
    let screenActionX = (0.5 - (actionNormX - 0.5) * SENSITIVITY) * WORLD_W; // Mirrored X
    let screenActionY = (0.5 + (actionNormY - 0.5) * SENSITIVITY) * WORLD_H;

    // Clamp to screen bounds
    screenActionX = Math.max(0, Math.min(WORLD_W, screenActionX));
    screenActionY = Math.max(0, Math.min(WORLD_H, screenActionY));

    // 3. Process all 21 landmarks for visual rendering
    // Instead of stretching them across the 16:9 screen, we render them at a fixed 1:1 scale
    // relative to the action point.
    const VISUAL_SCALE = 500; // Fixed size for the hand visual (in pixels)
    const processedLandmarks = lm.map((point) => ({
      x: screenActionX + ((actionNormX - point.x) * VISUAL_SCALE), // Mirrored X difference
      y: screenActionY + ((point.y - actionNormY) * VISUAL_SCALE)
    }));

    // Initialize smoothing array if first frame
    if (this.smoothLandmarks.length !== 21) {
      this.smoothLandmarks = processedLandmarks.map(p => ({ ...p }));
    }

    // Apply EMA smoothing to all landmarks
    for (let i = 0; i < 21; i++) {
      this.smoothLandmarks[i].x = this.smoothLandmarks[i].x * SMOOTH_ALPHA + processedLandmarks[i].x * (1 - SMOOTH_ALPHA);
      this.smoothLandmarks[i].y = this.smoothLandmarks[i].y * SMOOTH_ALPHA + processedLandmarks[i].y * (1 - SMOOTH_ALPHA);
    }

    const thumb = this.smoothLandmarks[4];
    const index = this.smoothLandmarks[8];

    // Cursor is the midpoint between smoothed thumb and index tips
    this.smoothX = (thumb.x + index.x) / 2;
    this.smoothY = (thumb.y + index.y) / 2;

    // Pinch distance calculation (Robust distance-independent ratio)
    // We calculate this using the raw camera coordinates to avoid visual scaling artifacts.
    // 1. Get reference hand size (distance from wrist [0] to middle finger base [9])
    const wristRaw = lm[0];
    const middleBaseRaw = lm[9];
    const handSizeRaw = Math.hypot(wristRaw.x - middleBaseRaw.x, wristRaw.y - middleBaseRaw.y);

    // 2. Get pinch distance (thumb tip [4] to index tip [8])
    const pinchDistRaw = Math.hypot(thumbRaw.x - indexRaw.x, thumbRaw.y - indexRaw.y);

    // 3. Ratio is independent of how close the hand is to the camera
    const pinchRatio = pinchDistRaw / handSizeRaw;

    // Hysteresis state machine for pinch ratio
    const PINCH_START_RATIO = 0.25; // 25% of hand size to activate
    const PINCH_END_RATIO   = 0.40; // 40% of hand size to deactivate

    const wasPinching = this.isPinching;
    if (!this.isPinching && pinchRatio < PINCH_START_RATIO) {
      this.isPinching = true;
    } else if (this.isPinching && pinchRatio > PINCH_END_RATIO) {
      this.isPinching = false;
    }

    const sx = this.smoothX;
    const sy = this.smoothY;

    if (!wasPinching && this.isPinching) {
      // Pinch started → 'down'
      this.lastEmittedX = sx;
      this.lastEmittedY = sy;
      this.emit('down', sx, sy);

    } else if (wasPinching && !this.isPinching) {
      // Pinch ended → 'up'
      this.emit('up', sx, sy);

    } else if (this.isPinching) {
      // Still pinching → 'move' (only if moved enough)
      const moved = Math.hypot(sx - this.lastEmittedX, sy - this.lastEmittedY);
      if (moved > MOVE_THRESHOLD) {
        this.lastEmittedX = sx;
        this.lastEmittedY = sy;
        this.emit('move', sx, sy);
      }
    }

    this.publishCursor(sx, sy, this.isPinching, true, this.smoothLandmarks);
  }


  // ── Private: emit InputEvent to game ──────────────────────────────────────────

  private emit(type: 'down' | 'move' | 'up', x: number, y: number) {
    const event: InputEvent = { type, x, y, timestamp: performance.now() };
    this.subscribers.forEach((cb) => cb(event));
  }

  // ── Private: publish cursor state to UI overlay ───────────────────────────────

  private publishCursor(x: number, y: number, isPinching: boolean, visible: boolean, landmarks?: {x: number, y: number}[]) {
    const state: HandCursorState = { x, y, isPinching, visible, landmarks };
    this.cursorListeners.forEach((cb) => cb(state));
  }
}
