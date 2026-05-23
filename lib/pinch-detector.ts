import type { Landmark } from "./hand3d-procedural";

export type PinchState = "idle" | "pinching" | "released";

export interface PinchResult {
  state: PinchState;
  position: { x: number; y: number; z: number };
  distance: number;
  strength: number;
}

interface PinchDetectorOptions {
  pinchThreshold?: number;
  releaseThreshold?: number;
  smoothingFrames?: number;
  releaseConfirmFrames?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance3d(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function midpoint(a: Landmark, b: Landmark): { x: number; y: number; z: number } {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
}

export class PinchDetector {
  private pinchThreshold: number;
  private releaseThreshold: number;
  private currentState: PinchState = "idle";

  // Smoothing: rolling average of last N distance readings
  private distanceHistory: number[] = [];
  private smoothingFrames: number;

  // Release confirmation: must stay above threshold for N consecutive frames
  private releaseConfirmFrames: number;
  private framesAboveRelease = 0;

  constructor(options?: PinchDetectorOptions) {
    this.pinchThreshold = options?.pinchThreshold ?? 0.18;
    this.releaseThreshold = options?.releaseThreshold ?? 0.35;
    this.smoothingFrames = options?.smoothingFrames ?? 5;
    this.releaseConfirmFrames = options?.releaseConfirmFrames ?? 4;
  }

  update(landmarks: Landmark[]): PinchResult {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const rawDist = distance3d(thumbTip, indexTip);

    // Push to history and keep only last N frames
    this.distanceHistory.push(rawDist);
    if (this.distanceHistory.length > this.smoothingFrames) {
      this.distanceHistory.shift();
    }

    // Smoothed distance: average of history
    const dist = this.distanceHistory.reduce((a, b) => a + b, 0) / this.distanceHistory.length;

    const position = midpoint(thumbTip, indexTip);
    const strength = 1 - clamp(dist / this.pinchThreshold, 0, 1);

    let nextState: PinchState;

    switch (this.currentState) {
      case "idle":
        if (dist < this.pinchThreshold) {
          nextState = "pinching";
          this.framesAboveRelease = 0;
        } else {
          nextState = "idle";
        }
        break;

      case "pinching":
        if (dist > this.releaseThreshold) {
          this.framesAboveRelease++;
          if (this.framesAboveRelease >= this.releaseConfirmFrames) {
            nextState = "released";
            this.framesAboveRelease = 0;
          } else {
            nextState = "pinching"; // not confirmed yet, stay pinching
          }
        } else {
          this.framesAboveRelease = 0;
          nextState = "pinching";
        }
        break;

      case "released":
        if (dist < this.pinchThreshold) {
          nextState = "pinching";
        } else {
          nextState = "idle";
        }
        this.framesAboveRelease = 0;
        break;
    }

    this.currentState = nextState;

    return {
      state: nextState,
      position,
      distance: dist,
      strength,
    };
  }

  reset(): void {
    this.currentState = "idle";
    this.distanceHistory = [];
    this.framesAboveRelease = 0;
  }
}
