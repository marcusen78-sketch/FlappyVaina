import * as THREE from "three";
import type { GameObject, GameScene } from "./game-scene";
import type { PinchResult } from "./pinch-detector";

export interface GameState {
  score: number;
  totalObjects: number;
  currentlyGrabbed: GameObject | null;
  isComplete: boolean;
  level: number;
}

const GRAB_RADIUS = 0.4;
const LERP_FACTOR = 0.4;
const GRAB_SCALE = 1.2;
const RETURN_LERP_FACTOR = 0.1;
const SNAP_THRESHOLD = 0.01;
const EMISSIVE_GLOW = new THREE.Color(0x333333);

interface ReturningObject {
  object: GameObject;
  targetPosition: THREE.Vector3;
}

export class GameEngine {
  private gameScene: GameScene;
  private state: GameState;
  private returningObjects: ReturningObject[] = [];
  private originalEmissives: Map<GameObject, THREE.Color> = new Map();
  private originalScales: Map<GameObject, THREE.Vector3> = new Map();

  constructor(gameScene: GameScene) {
    this.gameScene = gameScene;
    this.state = {
      score: 0,
      totalObjects: gameScene.objects.length,
      currentlyGrabbed: null,
      isComplete: false,
      level: 1,
    };
  }

  update(pinch: PinchResult, deltaTime: number): GameState {
    this.updateReturningObjects();

    if (pinch.state === "pinching") {
      if (this.state.currentlyGrabbed === null) {
        this.tryGrab(pinch);
      } else {
        this.moveGrabbed(pinch);
      }
    } else if (pinch.state === "released") {
      if (this.state.currentlyGrabbed !== null) {
        this.release();
      }
    }

    return this.getState();
  }

  reset(): void {
    for (const obj of this.gameScene.objects) {
      obj.isPlaced = false;
      obj.mesh.position.copy(obj.originalPosition);
      obj.mesh.scale.set(1, 1, 1);
      this.clearVisualFeedback(obj);
    }

    this.state = {
      score: 0,
      totalObjects: this.gameScene.objects.length,
      currentlyGrabbed: null,
      isComplete: false,
      level: this.state.level,
    };

    this.returningObjects = [];
    this.originalEmissives.clear();
    this.originalScales.clear();
  }

  getState(): GameState {
    return { ...this.state };
  }

  private tryGrab(pinch: PinchResult): void {
    // Use only X and Y for grab detection (Z depth from hand tracking is unreliable)
    const px = pinch.position.x;
    const py = pinch.position.y;
    let nearest: GameObject | null = null;
    let nearestDist = Infinity;

    for (const obj of this.gameScene.objects) {
      if (obj.isPlaced) continue;

      const isReturning = this.returningObjects.some((r) => r.object === obj);
      if (isReturning) continue;

      const dx = obj.mesh.position.x - px;
      const dy = obj.mesh.position.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = obj;
      }
    }

    if (nearest !== null && nearestDist < GRAB_RADIUS) {
      this.state.currentlyGrabbed = nearest;
      this.applyVisualFeedback(nearest);
    }
  }

  private pinchVec = new THREE.Vector3();

  private moveGrabbed(pinch: PinchResult): void {
    const obj = this.state.currentlyGrabbed;
    if (obj === null) return;

    // Only move in X/Y, keep Z at object's original depth (table plane)
    this.pinchVec.set(pinch.position.x, pinch.position.y, obj.mesh.position.z);
    obj.mesh.position.lerp(this.pinchVec, LERP_FACTOR);
  }

  private release(): void {
    const obj = this.state.currentlyGrabbed;
    if (obj === null) return;

    this.clearVisualFeedback(obj);

    const dropZone = this.gameScene.dropZone;

    if (this.isInsideDropZone(obj.mesh.position, dropZone)) {
      // Success: place the object on the right table
      obj.isPlaced = true;
      this.snapToDropZone(obj, dropZone);
      this.state.score++;

      if (this.state.score === this.state.totalObjects) {
        this.state.isComplete = true;
      }
    } else {
      // Fail: animate back to original position
      this.returningObjects.push({
        object: obj,
        targetPosition: obj.originalPosition.clone(),
      });
    }

    this.state.currentlyGrabbed = null;
  }

  private updateReturningObjects(): void {
    const completed: number[] = [];

    for (let i = 0; i < this.returningObjects.length; i++) {
      const { object, targetPosition } = this.returningObjects[i];

      // Ease-out: move 10% of remaining distance each frame
      object.mesh.position.lerp(targetPosition, RETURN_LERP_FACTOR);

      const dist = object.mesh.position.distanceTo(targetPosition);
      if (dist < SNAP_THRESHOLD) {
        object.mesh.position.copy(targetPosition);
        completed.push(i);
      }
    }

    // Remove completed animations in reverse order to preserve indices
    for (let i = completed.length - 1; i >= 0; i--) {
      this.returningObjects.splice(completed[i], 1);
    }
  }

  private isInsideDropZone(
    position: THREE.Vector3,
    dropZone: THREE.Box3
  ): boolean {
    // Only check X range — Y and Z from hand tracking are too unreliable
    return position.x >= dropZone.min.x && position.x <= dropZone.max.x;
  }

  private snapToDropZone(
    obj: GameObject,
    dropZone: THREE.Box3
  ): void {
    // Place on the surface of the right table (use the min y as the table surface)
    const centerX = (dropZone.min.x + dropZone.max.x) / 2;
    const centerZ = (dropZone.min.z + dropZone.max.z) / 2;
    const surfaceY = dropZone.min.y;

    // Offset each placed object slightly so they don't stack perfectly
    const placedCount = this.state.score;
    const offsetX = (placedCount % 3 - 1) * 0.08;
    const offsetZ = (Math.floor(placedCount / 3) - 1) * 0.08;

    obj.mesh.position.set(
      centerX + offsetX,
      surfaceY,
      centerZ + offsetZ
    );
  }

  private applyVisualFeedback(obj: GameObject): void {
    // Store original scale
    this.originalScales.set(obj, obj.mesh.scale.clone());

    // Scale up
    obj.mesh.scale.multiplyScalar(GRAB_SCALE);

    // Apply emissive glow if the material supports it
    const material = obj.mesh.material as THREE.MeshStandardMaterial;
    if (material && "emissive" in material) {
      this.originalEmissives.set(obj, material.emissive.clone());
      material.emissive.copy(EMISSIVE_GLOW);
    }
  }

  private clearVisualFeedback(obj: GameObject): void {
    // Restore original scale
    const originalScale = this.originalScales.get(obj);
    if (originalScale) {
      obj.mesh.scale.copy(originalScale);
      this.originalScales.delete(obj);
    } else {
      obj.mesh.scale.set(1, 1, 1);
    }

    // Restore original emissive
    const originalEmissive = this.originalEmissives.get(obj);
    const material = obj.mesh.material as THREE.MeshStandardMaterial;
    if (material && "emissive" in material) {
      if (originalEmissive) {
        material.emissive.copy(originalEmissive);
        this.originalEmissives.delete(obj);
      } else {
        material.emissive.set(0x000000);
      }
    }
  }
}
