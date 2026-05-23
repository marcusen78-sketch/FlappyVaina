import type { Landmark } from "./hand3d-procedural";

export type FistState = "open" | "closed";

export interface FistResult {
  state: FistState;
  strength: number; // 0 to 1
  averageRatio: number;
}

export class FistDetector {
  private closeThreshold: number = 0.38;
  private openThreshold: number = 0.65;

  update(landmarks: Landmark[]): FistResult {
    if (!landmarks || landmarks.length < 21) {
      return { state: "open", strength: 0, averageRatio: 1.0 };
    }

    // 0: Wrist, 9: Middle MCP
    const palmScale = this.dist3D(landmarks[0], landmarks[9]);
    if (palmScale < 0.001) {
      return { state: "open", strength: 0, averageRatio: 1.0 };
    }

    // Index (5 -> 8), Middle (9 -> 12), Ring (13 -> 16), Pinky (17 -> 20)
    const distIndex = this.dist3D(landmarks[8], landmarks[5]) / palmScale;
    const distMiddle = this.dist3D(landmarks[12], landmarks[9]) / palmScale;
    const distRing = this.dist3D(landmarks[16], landmarks[13]) / palmScale;
    const distPinky = this.dist3D(landmarks[20], landmarks[17]) / palmScale;

    const averageRatio = (distIndex + distMiddle + distRing + distPinky) / 4;

    // strength is 1 when averageRatio <= closeThreshold, 0 when >= openThreshold
    const strength = Math.max(
      0,
      Math.min(
        1,
        (this.openThreshold - averageRatio) /
          (this.openThreshold - this.closeThreshold)
      )
    );

    const state: FistState = strength > 0.5 ? "closed" : "open";

    return {
      state,
      strength,
      averageRatio,
    };
  }

  private dist3D(a: Landmark, b: Landmark): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
