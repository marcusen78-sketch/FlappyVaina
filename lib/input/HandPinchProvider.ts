import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { InputProvider, InputEvent } from './types';

const WORLD_W = 1280;
const WORLD_H = 720;

// Where the slingshot bird sits — every pinch grabs it here regardless of hand position
const SLINGSHOT_ANCHOR = { x: 450, y: 520 };

// How much normalized camera delta maps to world pixels.
// A ~20% camera-width movement → ~180px world ≈ MAX_PULL.
const DRAG_SCALE = 0.7;

// Pinch thresholds as ratio of pinch_dist / hand_size (scale-invariant)
const PINCH_START_RATIO = 0.25;
const PINCH_END_RATIO   = 0.40;

export class HandPinchProvider implements InputProvider {
  private video: HTMLVideoElement | null = null;
  private landmarker: HandLandmarker | null = null;
  private rafId: number | null = null;
  private stream: MediaStream | null = null;
  private subscribers = new Set<(e: InputEvent) => void>();

  private isPinching = false;
  // Normalized camera coords recorded at pinch-start
  private pinchStartX = 0;
  private pinchStartY = 0;

  private readyResolve: (() => void) | null = null;
  readonly ready: Promise<void>;

  constructor() {
    this.ready = new Promise<void>(resolve => { this.readyResolve = resolve; });
  }

  async start(_canvas: HTMLCanvasElement): Promise<void> {
    await this.initLandmarker();
    await this.startCamera();
    this.loop();
    this.readyResolve?.();
  }

  stop(): void {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    if (this.video) { this.video.srcObject = null; this.video.remove(); this.video = null; }
    if (this.isPinching) {
      this.isPinching = false;
      this.emit('up', SLINGSHOT_ANCHOR.x, SLINGSHOT_ANCHOR.y);
    }
  }

  subscribe(cb: (e: InputEvent) => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  private async initLandmarker(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    const orig = console.error;
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].startsWith('INFO:')) return;
      orig.apply(console, args);
    };
    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    } finally {
      console.error = orig;
    }
  }

  private async startCamera(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, facingMode: 'user' },
      audio: false,
    });
    const video = document.createElement('video');
    video.srcObject = this.stream;
    video.playsInline = true;
    video.muted = true;
    video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(video);
    this.video = video;
    await new Promise<void>(resolve => { video.onloadeddata = () => resolve(); video.play(); });
  }

  private lastDetectTime = 0;

  private loop = (): void => {
    const { video, landmarker } = this;
    if (!video || !landmarker) return;

    const now = performance.now();
    if (now - this.lastDetectTime > 16) {
      if (video.readyState >= 2) {
        const results = landmarker.detectForVideo(video, now);
        this.lastDetectTime = performance.now();
        const lm = results.landmarks?.[0];
        if (lm && lm.length >= 10) {
          this.processPinch(lm);
        } else if (this.isPinching) {
          // Hand left frame — release
          this.isPinching = false;
          this.emit('up', SLINGSHOT_ANCHOR.x, SLINGSHOT_ANCHOR.y);
        }
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private processPinch(lm: { x: number; y: number; z: number }[]) {
    const thumb = lm[4];
    const index = lm[8];
    const wrist = lm[0];
    const middleBase = lm[9];

    // Scale-invariant pinch ratio
    const handSize  = Math.hypot(wrist.x - middleBase.x, wrist.y - middleBase.y);
    const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
    const ratio = handSize > 0.001 ? pinchDist / handSize : 1;

    // Midpoint between thumb and index in normalized camera space
    const midX = (thumb.x + index.x) / 2;
    const midY = (thumb.y + index.y) / 2;

    const wasPinching = this.isPinching;

    if (!this.isPinching && ratio < PINCH_START_RATIO) {
      this.isPinching = true;
      this.pinchStartX = midX;
      this.pinchStartY = midY;
    } else if (this.isPinching && ratio > PINCH_END_RATIO) {
      this.isPinching = false;
    }

    if (!wasPinching && this.isPinching) {
      // Pinch started → always grab the bird regardless of hand position
      this.emit('down', SLINGSHOT_ANCHOR.x, SLINGSHOT_ANCHOR.y);
    } else if (wasPinching && !this.isPinching) {
      // Pinch ended → release at current drag position
      const { wx, wy } = this.dragPos(midX, midY);
      this.emit('up', wx, wy);
    } else if (this.isPinching) {
      // Still pinching → drag relative to where pinch started
      const { wx, wy } = this.dragPos(midX, midY);
      this.emit('move', wx, wy);
    }
  }

  // Map camera delta from pinch-start to world coords relative to SLINGSHOT_ANCHOR.
  // Camera X is mirrored so the gesture feels natural (pull left = bird goes left).
  private dragPos(midX: number, midY: number): { wx: number; wy: number } {
    const dx = -(midX - this.pinchStartX) * WORLD_W * DRAG_SCALE;
    const dy =  (midY - this.pinchStartY) * WORLD_H * DRAG_SCALE;
    return {
      wx: SLINGSHOT_ANCHOR.x + dx,
      wy: SLINGSHOT_ANCHOR.y + dy,
    };
  }

  private emit(type: 'down' | 'move' | 'up', x: number, y: number) {
    const event: InputEvent = { type, x, y, timestamp: performance.now() };
    this.subscribers.forEach(cb => cb(event));
  }
}
