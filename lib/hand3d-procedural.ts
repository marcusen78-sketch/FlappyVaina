import * as THREE from "three";

export type Landmark = { x: number; y: number; z: number };

// ---------------------------------------------------------------------------
// MediaPipe Hand Connections
// ---------------------------------------------------------------------------

const CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm cross-connections
  [5, 9], [9, 13], [13, 17], [0, 5], [0, 17],
];

// ---------------------------------------------------------------------------
// Joint radius per landmark index (knuckles and wrist slightly larger)
// ---------------------------------------------------------------------------

const BASE_JOINT_RADIUS = 0.035;

const JOINT_RADII: number[] = (() => {
  const radii = new Array(21).fill(BASE_JOINT_RADIUS);
  // Wrist - largest
  radii[0] = 0.055;
  // MCP knuckles (base of each finger)
  radii[1] = 0.040; // thumb CMC
  radii[5] = 0.042; // index MCP
  radii[9] = 0.042; // middle MCP
  radii[13] = 0.040; // ring MCP
  radii[17] = 0.038; // pinky MCP
  // PIP joints (middle knuckles)
  radii[2] = 0.036;
  radii[6] = 0.036;
  radii[10] = 0.036;
  radii[14] = 0.034;
  radii[18] = 0.032;
  // Fingertips - slightly smaller
  radii[4] = 0.030;
  radii[8] = 0.028;
  radii[12] = 0.028;
  radii[16] = 0.026;
  radii[20] = 0.024;
  return radii;
})();

// Bone (capsule) radius — slightly thinner than joints for smooth blending
const BONE_RADIUS = 0.025;

// ---------------------------------------------------------------------------
// Shared Geometry & Material (instanced across all hands for performance)
// ---------------------------------------------------------------------------

const SPHERE_GEO = new THREE.SphereGeometry(1, 16, 12);
const CYLINDER_GEO = new THREE.CylinderGeometry(1, 1, 1, 10, 1);
// Shift cylinder so bottom is at origin, top at y=1
CYLINDER_GEO.translate(0, 0.5, 0);

const SKIN_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xf0b090,
  roughness: 0.6,
  metalness: 0.0,
});

// ---------------------------------------------------------------------------
// HandModel interface (matches hand3d.ts export)
// ---------------------------------------------------------------------------

export interface HandModel {
  root: THREE.Group;
  bones: (THREE.Bone | null)[];
  skinnedMesh: THREE.SkinnedMesh | null;
  restWristToMid: number;
  // Internal references for procedural updates
  _joints: THREE.Mesh[];
  _bones: THREE.Mesh[];
}

// ---------------------------------------------------------------------------
// Create a single procedural hand
// ---------------------------------------------------------------------------

function createProceduralHand(): HandModel {
  const root = new THREE.Group();
  root.visible = false;

  const joints: THREE.Mesh[] = [];
  const bones: THREE.Mesh[] = [];

  // Create joint spheres
  for (let i = 0; i < 21; i++) {
    const radius = JOINT_RADII[i];
    const sphere = new THREE.Mesh(SPHERE_GEO, SKIN_MATERIAL);
    sphere.scale.setScalar(radius);
    root.add(sphere);
    joints.push(sphere);
  }

  // Create bone cylinders (one per connection)
  for (let i = 0; i < CONNECTIONS.length; i++) {
    const cyl = new THREE.Mesh(CYLINDER_GEO, SKIN_MATERIAL);
    root.add(cyl);
    bones.push(cyl);
  }

  return {
    root,
    bones: [], // No actual THREE.Bone objects in procedural approach
    skinnedMesh: null,
    restWristToMid: 0.08,
    _joints: joints,
    _bones: bones,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const _start = new THREE.Vector3();
const _end = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

function positionCylinder(
  cyl: THREE.Mesh,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): void {
  _start.set(ax, ay, az);
  _end.set(bx, by, bz);
  _dir.subVectors(_end, _start);
  const length = _dir.length();

  if (length < 0.0001) {
    cyl.visible = false;
    return;
  }
  cyl.visible = true;

  // Position at start point
  cyl.position.copy(_start);

  // Scale: radius in X/Z, length in Y
  cyl.scale.set(BONE_RADIUS, length, BONE_RADIUS);

  // Orient Y-axis along direction
  _dir.divideScalar(length); // normalize
  _quat.setFromUnitVectors(_up, _dir);
  cyl.quaternion.copy(_quat);
}

// ---------------------------------------------------------------------------
// Update a procedural hand from landmarks
// ---------------------------------------------------------------------------

function updateProceduralHand(model: HandModel, landmarks: Landmark[]): void {
  if (!landmarks || landmarks.length < 21) {
    model.root.visible = false;
    return;
  }
  model.root.visible = true;

  const wrist = landmarks[0];

  // Position joints relative to wrist (root is placed at wrist position)
  for (let i = 0; i < 21; i++) {
    const lm = landmarks[i];
    const joint = model._joints[i];
    joint.position.set(
      lm.x - wrist.x,
      lm.y - wrist.y,
      lm.z - wrist.z,
    );
  }

  // Position and orient bone cylinders
  for (let i = 0; i < CONNECTIONS.length; i++) {
    const [aIdx, bIdx] = CONNECTIONS[i];
    const a = landmarks[aIdx];
    const b = landmarks[bIdx];
    positionCylinder(
      model._bones[i],
      a.x - wrist.x, a.y - wrist.y, a.z - wrist.z,
      b.x - wrist.x, b.y - wrist.y, b.z - wrist.z,
    );
  }
}

// ---------------------------------------------------------------------------
// Pool (matches hand3d.ts export interface)
// ---------------------------------------------------------------------------

export async function createHandsPool(maxHands = 2): Promise<HandModel[]> {
  const pool: HandModel[] = [];
  for (let i = 0; i < maxHands; i++) {
    pool.push(createProceduralHand());
  }
  return pool;
}

export function updateHandsPool(pool: HandModel[], hands: Landmark[][]): void {
  for (let i = 0; i < pool.length; i++) {
    if (i < hands.length) {
      const landmarks = hands[i];
      const wrist = landmarks[0];
      pool[i].root.position.set(wrist.x, wrist.y, wrist.z);
      updateProceduralHand(pool[i], landmarks);
    } else {
      pool[i].root.visible = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Lighting (same as hand3d.ts)
// ---------------------------------------------------------------------------

export function addHandLighting(scene: THREE.Scene): void {
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));

  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(2, 4, 3);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xeeeeff, 0.5);
  fill.position.set(-2, 1, 2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffeedd, 0.3);
  rim.position.set(0, -1, -2);
  scene.add(rim);
}
