import type { Landmark } from "./hand3d-procedural";

export interface PronationResult {
  angleRaw: number; // Raw atan2 angle in radians
  pitcherRotationZ: number; // Mapped rotation for the 3D pitcher (0 is upright)
}

export class PronationDetector {
  update(landmarks: Landmark[] | null): PronationResult {
    if (!landmarks || landmarks.length < 21) {
      return { angleRaw: 0, pitcherRotationZ: 0 };
    }

    const indexMcp = landmarks[5];
    const pinkyMcp = landmarks[17];

    const dx = indexMcp.x - pinkyMcp.x;
    const dy = indexMcp.y - pinkyMcp.y;

    // Use 2D screen coordinates for robust detection when arm points at camera.
    // Dorso (Pronation): index is left of pinky -> dx < 0, dy ~ 0 -> angleRaw is -PI or PI.
    // Profile: index is above pinky -> dx ~ 0, dy < 0 -> angleRaw is -PI/2.
    // Palma (Supination): index is right of pinky -> dx > 0, dy ~ 0 -> angleRaw is 0.
    const angleRaw = Math.atan2(dy, dx);
    
    // We map Profile (-PI/2) to Upright (0), and Palma (0) to Tilt Left (PI/2).
    let pitcherRotationZ = angleRaw + Math.PI / 2;

    // Normalize rotation strictly to [-PI, PI]
    while (pitcherRotationZ > Math.PI) pitcherRotationZ -= 2 * Math.PI;
    while (pitcherRotationZ <= -Math.PI) pitcherRotationZ += 2 * Math.PI;

    // Smooth out tiny jitters near upright (0)
    if (Math.abs(pitcherRotationZ) < 0.15) {
      pitcherRotationZ = 0;
    }

    return {
      angleRaw,
      pitcherRotationZ
    };
  }
}
