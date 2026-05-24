import type { Landmark } from "./hand3d-procedural";

export interface PronationResult {
  angleRaw: number; // Raw atan2 angle in radians
  pitcherRotationZ: number; // Mapped rotation for the 3D pitcher (0 is upright)
  isPouring: boolean; // True if tilted beyond a threshold
}

export class PronationDetector {
  private pourThreshold: number = 0.4; // Radians of tilt required to start pouring

  update(landmarks: Landmark[] | null): PronationResult {
    if (!landmarks || landmarks.length < 21) {
      return { angleRaw: -Math.PI / 2, pitcherRotationZ: 0, isPouring: false };
    }

    // 5: Index Finger MCP, 17: Pinky Finger MCP
    const indexMcp = landmarks[5];
    const pinkyMcp = landmarks[17];

    const dx = indexMcp.x - pinkyMcp.x;
    const dy = indexMcp.y - pinkyMcp.y;

    // Angle of the knuckle line in screen space
    const angleRaw = Math.atan2(dy, dx);

    // Map to pitcher rotation. 
    // When neutral (thumb up), index is above pinky, dy < 0, dx ~ 0 -> angle is -PI/2.
    // We want neutral to be 0 rotation.
    // Pitcher Z rotation = -angle - PI/2.
    // We also flip it based on the camera mirror effect to match physical reality.
    // Actually, in mirrored webcam space, if we just apply `angleRaw + Math.PI/2`, it tilts correctly.
    let pitcherRotationZ = angleRaw + Math.PI / 2;

    // Normalize rotation to be between -PI and PI
    while (pitcherRotationZ > Math.PI) pitcherRotationZ -= 2 * Math.PI;
    while (pitcherRotationZ < -Math.PI) pitcherRotationZ += 2 * Math.PI;

    // Smooth out tiny jitters near 0
    if (Math.abs(pitcherRotationZ) < 0.05) {
      pitcherRotationZ = 0;
    }

    const isPouring = Math.abs(pitcherRotationZ) > this.pourThreshold;

    return {
      angleRaw,
      pitcherRotationZ,
      isPouring,
    };
  }
}
