import * as THREE from "three";
import type { LabBall, TestTube, LabScene } from "./lab-scene";
import type { PinchResult } from "./pinch-detector";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface LabGameState {
  score: number;
  errors: number;
  totalBalls: number;
  currentlyGrabbed: LabBall | null;
  isComplete: boolean;
  hoveredTube: number | null;
}

export interface BallMetrics {
  ballIndex: number;
  grabTimestamp: number;
  releaseTimestamp: number;
  transportDuration: number;
  correct: boolean;
  targetTubeIndex: number;
}

export interface SessionMetrics {
  startTime: number;
  completionTime: number | null;
  ballMetrics: BallMetrics[];
  totalErrors: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRAB_RADIUS = 0.4;
const LERP_FACTOR = 0.4;
const GRAB_SCALE = 1.15;
const RETURN_LERP = 0.1;
const SNAP_THRESHOLD = 0.01;
const ERROR_FLASH_MS = 400;
const SUCCESS_ANIM_SPEED = 0.08;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

interface ReturningBall {
  ball: LabBall;
  target: THREE.Vector3;
}

interface ErrorFlash {
  tube: TestTube;
  startTime: number;
  originalColor: THREE.Color;
}

interface SuccessAnim {
  ball: LabBall;
  tube: TestTube;
  targetY: number;
}

export class LabEngine {
  private labScene: LabScene;
  private state: LabGameState;
  private metrics: SessionMetrics;
  private currentGrabTime = 0;
  private returningBalls: ReturningBall[] = [];
  private errorFlashes: ErrorFlash[] = [];
  private successAnims: SuccessAnim[] = [];
  private prevHoveredTube: number | null = null;

  constructor(labScene: LabScene) {
    this.labScene = labScene;
    this.state = {
      score: 0,
      errors: 0,
      totalBalls: labScene.balls.length,
      currentlyGrabbed: null,
      isComplete: false,
      hoveredTube: null,
    };
    this.metrics = {
      startTime: performance.now(),
      completionTime: null,
      ballMetrics: [],
      totalErrors: 0,
    };
  }

  update(pinch: PinchResult, deltaTime: number): LabGameState {
    this.updateReturning();
    this.updateErrorFlashes();
    this.updateSuccessAnims();

    if (pinch.state === "pinching") {
      if (!this.state.currentlyGrabbed) {
        this.tryGrab(pinch);
      } else {
        this.moveGrabbed(pinch);
      }
    } else if (pinch.state === "released") {
      if (this.state.currentlyGrabbed) {
        this.release();
      }
    }

    // Update hover feedback
    this.updateHoverFeedback();

    return this.getState();
  }

  getState(): LabGameState {
    return { ...this.state };
  }

  getMetrics(): SessionMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.state = {
      score: 0,
      errors: 0,
      totalBalls: this.labScene.balls.length,
      currentlyGrabbed: null,
      isComplete: false,
      hoveredTube: null,
    };
    this.returningBalls = [];
    this.errorFlashes = [];
    this.successAnims = [];
    this.metrics = {
      startTime: performance.now(),
      completionTime: null,
      ballMetrics: [],
      totalErrors: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Grab
  // -------------------------------------------------------------------------

  private tryGrab(pinch: PinchResult): void {
    const px = pinch.position.x;
    const py = pinch.position.y;
    let nearest: LabBall | null = null;
    let nearestDist = Infinity;

    for (const ball of this.labScene.balls) {
      if (ball.isPlaced) continue;
      const isReturning = this.returningBalls.some((r) => r.ball === ball);
      if (isReturning) continue;

      const dx = ball.mesh.position.x - px;
      const dy = ball.mesh.position.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = ball;
      }
    }

    if (nearest && nearestDist < GRAB_RADIUS) {
      this.state.currentlyGrabbed = nearest;
      nearest.isGrabbed = true;
      nearest.mesh.scale.setScalar(GRAB_SCALE);
      const mat = nearest.mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.set(0x222222);
      this.currentGrabTime = performance.now();
    }
  }

  // -------------------------------------------------------------------------
  // Move
  // -------------------------------------------------------------------------

  private pinchVec = new THREE.Vector3();

  private moveGrabbed(pinch: PinchResult): void {
    const ball = this.state.currentlyGrabbed;
    if (!ball) return;

    this.pinchVec.set(pinch.position.x, pinch.position.y, ball.mesh.position.z);
    ball.mesh.position.lerp(this.pinchVec, LERP_FACTOR);

    // Detect hover
    this.state.hoveredTube = this.detectHover(ball.mesh.position.x);
  }

  private detectHover(ballX: number): number | null {
    for (let i = 0; i < this.labScene.tubes.length; i++) {
      const tube = this.labScene.tubes[i];
      if (ballX >= tube.dropZoneMinX && ballX <= tube.dropZoneMaxX) {
        return i;
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Release
  // -------------------------------------------------------------------------

  private release(): void {
    const ball = this.state.currentlyGrabbed;
    if (!ball) return;

    this.clearBallFeedback(ball);
    const now = performance.now();

    if (this.state.hoveredTube !== null) {
      const tube = this.labScene.tubes[this.state.hoveredTube];

      if (ball.colorIndex === tube.colorIndex) {
        // SUCCESS
        ball.isPlaced = true;
        ball.isGrabbed = false;
        this.state.score++;

        // Start success animation (ball drops into tube)
        this.successAnims.push({
          ball,
          tube,
          targetY: tube.position.y + 0.05,
        });

        this.metrics.ballMetrics.push({
          ballIndex: this.labScene.balls.indexOf(ball),
          grabTimestamp: this.currentGrabTime,
          releaseTimestamp: now,
          transportDuration: now - this.currentGrabTime,
          correct: true,
          targetTubeIndex: this.state.hoveredTube,
        });

        if (this.state.score === this.state.totalBalls) {
          this.state.isComplete = true;
          this.metrics.completionTime = now - this.metrics.startTime;
        }
      } else {
        // ERROR: wrong tube
        this.state.errors++;
        this.metrics.totalErrors++;

        // Flash tube red
        const bodyMat = tube.bodyMesh.material as THREE.MeshStandardMaterial;
        this.errorFlashes.push({
          tube,
          startTime: now,
          originalColor: bodyMat.color.clone(),
        });
        bodyMat.color.set(0xff4444);
        bodyMat.opacity = 0.5;

        // Return ball
        this.returningBalls.push({ ball, target: ball.originalPosition.clone() });

        this.metrics.ballMetrics.push({
          ballIndex: this.labScene.balls.indexOf(ball),
          grabTimestamp: this.currentGrabTime,
          releaseTimestamp: now,
          transportDuration: now - this.currentGrabTime,
          correct: false,
          targetTubeIndex: this.state.hoveredTube,
        });
      }
    } else {
      // MISS: not over any tube
      ball.isGrabbed = false;
      this.returningBalls.push({ ball, target: ball.originalPosition.clone() });
    }

    this.state.currentlyGrabbed = null;
    this.state.hoveredTube = null;
  }

  // -------------------------------------------------------------------------
  // Animations
  // -------------------------------------------------------------------------

  private updateReturning(): void {
    const done: number[] = [];
    for (let i = 0; i < this.returningBalls.length; i++) {
      const { ball, target } = this.returningBalls[i];
      ball.mesh.position.lerp(target, RETURN_LERP);
      if (ball.mesh.position.distanceTo(target) < SNAP_THRESHOLD) {
        ball.mesh.position.copy(target);
        ball.isGrabbed = false;
        done.push(i);
      }
    }
    for (let i = done.length - 1; i >= 0; i--) {
      this.returningBalls.splice(done[i], 1);
    }
  }

  private updateErrorFlashes(): void {
    const now = performance.now();
    const done: number[] = [];
    for (let i = 0; i < this.errorFlashes.length; i++) {
      const { tube, startTime, originalColor } = this.errorFlashes[i];
      if (now - startTime > ERROR_FLASH_MS) {
        const mat = tube.bodyMesh.material as THREE.MeshStandardMaterial;
        mat.color.copy(originalColor);
        mat.opacity = 0.2;
        done.push(i);
      }
    }
    for (let i = done.length - 1; i >= 0; i--) {
      this.errorFlashes.splice(done[i], 1);
    }
  }

  private updateSuccessAnims(): void {
    const done: number[] = [];
    for (let i = 0; i < this.successAnims.length; i++) {
      const { ball, tube, targetY } = this.successAnims[i];

      // Move ball toward tube center and shrink
      const tubeCenter = new THREE.Vector3(tube.position.x, targetY, tube.position.z);
      ball.mesh.position.lerp(tubeCenter, SUCCESS_ANIM_SPEED);
      ball.mesh.scale.multiplyScalar(0.96);

      if (ball.mesh.scale.x < 0.3) {
        ball.mesh.visible = false;
        done.push(i);
      }
    }
    for (let i = done.length - 1; i >= 0; i--) {
      this.successAnims.splice(done[i], 1);
    }
  }

  // -------------------------------------------------------------------------
  // Hover feedback
  // -------------------------------------------------------------------------

  private updateHoverFeedback(): void {
    const current = this.state.hoveredTube;

    // Reset previous tube
    if (this.prevHoveredTube !== null && this.prevHoveredTube !== current) {
      const prevTube = this.labScene.tubes[this.prevHoveredTube];
      const ringMat = prevTube.ringMesh.material as THREE.MeshStandardMaterial;
      ringMat.emissiveIntensity = 0.3;
    }

    // Highlight current tube
    if (current !== null) {
      const tube = this.labScene.tubes[current];
      const ringMat = tube.ringMesh.material as THREE.MeshStandardMaterial;
      ringMat.emissiveIntensity = 0.9;
    }

    this.prevHoveredTube = current;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private clearBallFeedback(ball: LabBall): void {
    ball.mesh.scale.setScalar(1);
    const mat = ball.mesh.material as THREE.MeshStandardMaterial;
    mat.emissive.set(0x000000);
  }
}
