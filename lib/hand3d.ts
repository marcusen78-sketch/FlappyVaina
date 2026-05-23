import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type Landmark = { x: number; y: number; z: number };

const BONE_NAMES = [
  "wrist",
  "thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip",
  "index-finger-metacarpal", "index-finger-phalanx-proximal", "index-finger-phalanx-intermediate", "index-finger-phalanx-distal", "index-finger-tip",
  "middle-finger-metacarpal", "middle-finger-phalanx-proximal", "middle-finger-phalanx-intermediate", "middle-finger-phalanx-distal", "middle-finger-tip",
  "ring-finger-metacarpal", "ring-finger-phalanx-proximal", "ring-finger-phalanx-intermediate", "ring-finger-phalanx-distal", "ring-finger-tip",
  "pinky-finger-metacarpal", "pinky-finger-phalanx-proximal", "pinky-finger-phalanx-intermediate", "pinky-finger-phalanx-distal", "pinky-finger-tip",
];

const BONE_TO_MP: number[] = [
  0,
  1, 2, 3, 4,
  -1, 5, 6, 7, 8,
  -1, 9, 10, 11, 12,
  -1, 13, 14, 15, 16,
  -1, 17, 18, 19, 20,
];

const META_INTERP: Record<number, [number, number, number]> = {
  5:  [0, 5, 0.3],
  10: [0, 9, 0.3],
  15: [0, 13, 0.3],
  20: [0, 17, 0.3],
};

const FINGER_CHAINS: number[][] = [
  [1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
];

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

const loader = new GLTFLoader();

export interface HandModel {
  root: THREE.Group;
  bones: (THREE.Bone | null)[];
  skinnedMesh: THREE.SkinnedMesh | null;
  restWristToMid: number;
}

export async function loadHandModel(url: string): Promise<HandModel> {
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;
  root.visible = false;

  const bonesByName = new Map<string, THREE.Bone>();
  let skinnedMesh: THREE.SkinnedMesh | null = null;

  root.traverse((child) => {
    if ((child as THREE.Bone).isBone) {
      bonesByName.set(child.name, child as THREE.Bone);
    }
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      skinnedMesh = child as THREE.SkinnedMesh;
      skinnedMesh.frustumCulled = false;
    }
  });

  const bones: (THREE.Bone | null)[] = BONE_NAMES.map(
    (name) => bonesByName.get(name) || null
  );

  // Measure rest-pose wrist → middle-proximal distance in LOCAL bone space
  // (before any root scale is applied)
  let restWristToMid = 0.08;
  const wristBone = bones[0];
  const midProxBone = bones[11];
  if (wristBone && midProxBone) {
    const d = wristBone.position.distanceTo(midProxBone.position);
    if (d > 0.001) restWristToMid = d;
  }

  return { root, bones, skinnedMesh, restWristToMid };
}

// ---------------------------------------------------------------------------
// Retarget - simple absolute positioning per bone
// ---------------------------------------------------------------------------

const _dir = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);

function getLandmarkForBone(landmarks: Landmark[], boneIdx: number): Landmark {
  const mpIdx = BONE_TO_MP[boneIdx];
  if (mpIdx >= 0) return landmarks[mpIdx];

  const interp = META_INTERP[boneIdx];
  if (interp) {
    const [aIdx, bIdx, t] = interp;
    const a = landmarks[aIdx];
    const b = landmarks[bIdx];
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  }
  return landmarks[0];
}

function dist(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function retargetHand(model: HandModel, landmarks: Landmark[]): void {
  if (!landmarks || landmarks.length < 21) {
    model.root.visible = false;
    return;
  }
  model.root.visible = true;

  const wrist = landmarks[0];

  // Scale bones into model-local space, then let root.scale amplify to screen size.
  // restWristToMid is the bone-local distance the model expects.
  // handSpan is the same measurement in our mapped landmark space.
  // We set root.scale dynamically so the hand always looks the right size on screen.
  const handSpan = dist(landmarks[0], landmarks[9]);
  const boneScale = handSpan > 0.001 ? model.restWristToMid / handSpan : 1;

  // Root scale: make the model fill ~40% of viewport.
  // With camera at z=3 FOV=50, viewport height ≈ 2.8 units.
  // We want the hand (~3.5x wristToMid) to span ~1.2 units.
  // rootScale = targetSize / (restWristToMid * 3.5)
  const targetHandSize = 1.2;
  const rootScale = targetHandSize / (model.restWristToMid * 3.5);
  model.root.scale.setScalar(rootScale);

  const scale = boneScale;

  // Position each bone relative to wrist in bone-local coords
  for (let i = 0; i < BONE_NAMES.length; i++) {
    const bone = model.bones[i];
    if (!bone) continue;

    const lm = getLandmarkForBone(landmarks, i);
    bone.position.set(
      (lm.x - wrist.x) * scale,
      (lm.y - wrist.y) * scale,
      (lm.z - wrist.z) * scale
    );
  }

  // Orient wrist toward middle MCP
  const wristBone = model.bones[0];
  if (wristBone) {
    const midMCP = landmarks[9];
    _dir.set(midMCP.x - wrist.x, midMCP.y - wrist.y, midMCP.z - wrist.z).normalize();
    if (_dir.lengthSq() > 0.0001) {
      wristBone.quaternion.setFromUnitVectors(_yAxis, _dir);
    }
  }

  // Orient each finger bone toward its next joint
  for (const chain of FINGER_CHAINS) {
    for (let ci = 0; ci < chain.length - 1; ci++) {
      const boneIdx = chain[ci];
      const bone = model.bones[boneIdx];
      if (!bone) continue;

      const current = getLandmarkForBone(landmarks, boneIdx);
      const next = getLandmarkForBone(landmarks, chain[ci + 1]);

      _dir.set(next.x - current.x, next.y - current.y, next.z - current.z);
      const len = _dir.length();
      if (len > 0.0001) {
        _dir.divideScalar(len);
        bone.quaternion.setFromUnitVectors(_yAxis, _dir);
      }
    }

    // Tip: same orientation as parent
    const tipIdx = chain[chain.length - 1];
    const prevIdx = chain[chain.length - 2];
    const tipBone = model.bones[tipIdx];
    const prevBone = model.bones[prevIdx];
    if (tipBone && prevBone) {
      tipBone.quaternion.copy(prevBone.quaternion);
    }
  }
}

// ---------------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------------

export async function createHandsPool(maxHands = 2): Promise<HandModel[]> {
  const pool: HandModel[] = [];
  for (let i = 0; i < maxHands; i++) {
    pool.push(await loadHandModel("/models/hand-right.glb"));
  }
  return pool;
}

export function updateHandsPool(pool: HandModel[], hands: Landmark[][]): void {
  for (let i = 0; i < pool.length; i++) {
    if (i < hands.length) {
      const landmarks = hands[i];
      const wrist = landmarks[0];
      pool[i].root.position.set(wrist.x, wrist.y, wrist.z);
      retargetHand(pool[i], landmarks);
    } else {
      pool[i].root.visible = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Lighting
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
