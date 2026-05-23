import * as THREE from "three";

/**
 * 3D hand rendering engine — ported from hand-canvas.
 *
 * Builds a stylised geometric hand from MediaPipe's 21 landmarks using
 * Three.js. The surface is a cool-toned matte polymer with a dense
 * wireframe overlay tracing every edge.
 *
 * Public API:
 *   createHand()          → THREE.Group   (call once per hand)
 *   updateHand(group, lm) → void          (call every frame)
 *   createHandsPool(n)    → THREE.Group[] (convenience)
 *   updateHandsPool(pool, hands) → void
 *   addHandLighting(scene)→ void
 */

export type Landmark = { x: number; y: number; z: number };

// ---------------------------------------------------------------------------
// Topology
// ---------------------------------------------------------------------------

const BONES: Array<[number, number]> = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [13, 17], [17, 18], [18, 19], [19, 20],
  // Palm base
  [0, 17],
];

// Joint radii — larger at wrist/knuckles, thinner towards tips.
const JOINT_RADIUS: number[] = (() => {
  const r = new Array(21).fill(0.018);
  r[0] = 0.032;                                       // wrist
  [1, 5, 9, 13, 17].forEach((i) => (r[i] = 0.026));  // MCP / knuckles
  [2, 6, 10, 14, 18].forEach((i) => (r[i] = 0.022));
  [3, 7, 11, 15, 19].forEach((i) => (r[i] = 0.018));
  [4, 8, 12, 16, 20].forEach((i) => (r[i] = 0.014)); // fingertips
  return r;
})();

function boneRadius(from: number, to: number): number {
  if ((from === 0 && to === 17) || from === 0) return 0.024;
  if (
    (from === 5 && to === 9) ||
    (from === 9 && to === 13) ||
    (from === 13 && to === 17)
  )
    return 0.024;
  const tipness = Math.max(from % 4, to % 4);
  return 0.022 - tipness * 0.002;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

function makePolymerMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xc4d0dc, // cool light blue-grey
    roughness: 0.85,
    metalness: 0.0,
    flatShading: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}

function makeWireMaterial(): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color: 0x1f2a36,
    transparent: true,
    opacity: 0.85,
  });
}

function attachWire(
  mesh: THREE.Mesh,
  wireMat: THREE.LineBasicMaterial
): void {
  const wireGeo = new THREE.WireframeGeometry(mesh.geometry);
  const wire = new THREE.LineSegments(wireGeo, wireMat);
  mesh.add(wire);
}

// ---------------------------------------------------------------------------
// createHand
// ---------------------------------------------------------------------------

interface HandUserData {
  joints: THREE.Mesh[];
  bones: THREE.Mesh[];
  palm: THREE.Mesh;
  palmWire: THREE.LineSegments;
  bonePairs: Array<[number, number]>;
  _v1: THREE.Vector3;
  _v2: THREE.Vector3;
  _dir: THREE.Vector3;
  _up: THREE.Vector3;
  _quat: THREE.Quaternion;
  _mid: THREE.Vector3;
}

export function createHand(): THREE.Group {
  const group = new THREE.Group();
  group.name = "hand";

  const polymer = makePolymerMaterial();
  const wireMat = makeWireMaterial();

  // ---- Joints (21 dense spheres) ----
  const joints: THREE.Mesh[] = [];
  const sphereGeo = new THREE.SphereGeometry(1, 24, 18);
  for (let i = 0; i < 21; i++) {
    const m = new THREE.Mesh(sphereGeo, polymer);
    m.scale.setScalar(JOINT_RADIUS[i]);
    attachWire(m, wireMat);
    joints.push(m);
    group.add(m);
  }

  // ---- Bones (segmented cylinders) ----
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 6, false);
  cylGeo.translate(0, 0.5, 0);

  const bones: THREE.Mesh[] = [];
  for (const [from, to] of BONES) {
    const m = new THREE.Mesh(cylGeo, polymer);
    const r = boneRadius(from, to);
    m.scale.set(r, 1, r);
    attachWire(m, wireMat);
    bones.push(m);
    group.add(m);
  }

  // ---- Palm: subdivided triangle fan ----
  const palmGeo = new THREE.BufferGeometry();
  const palmVertexCount = 8;
  const palmVerts = new Float32Array(palmVertexCount * 3);
  palmGeo.setAttribute("position", new THREE.BufferAttribute(palmVerts, 3));
  palmGeo.setIndex([
    0, 1, 5,
    0, 5, 2,
    0, 2, 6,
    0, 6, 3,
    0, 3, 7,
    0, 7, 4,
    1, 5, 2,
    2, 6, 3,
    3, 7, 4,
  ]);
  palmGeo.computeVertexNormals();
  const palm = new THREE.Mesh(palmGeo, polymer);
  palm.renderOrder = -1;
  group.add(palm);

  // Palm wireframe — shares position buffer, uses line indices
  const palmEdges = new Uint16Array([
    0, 1, 0, 2, 0, 3, 0, 4,
    0, 5, 0, 6, 0, 7,
    1, 5, 5, 2, 2, 6, 6, 3, 3, 7, 7, 4,
    1, 2, 2, 3, 3, 4,
  ]);
  const palmWireGeo = new THREE.BufferGeometry();
  palmWireGeo.setAttribute("position", palmGeo.getAttribute("position"));
  palmWireGeo.setIndex(new THREE.BufferAttribute(palmEdges, 1));
  const palmWire = new THREE.LineSegments(palmWireGeo, wireMat);
  palmWire.renderOrder = 1;
  group.add(palmWire);

  const ud: HandUserData = {
    joints,
    bones,
    palm,
    palmWire,
    bonePairs: BONES,
    _v1: new THREE.Vector3(),
    _v2: new THREE.Vector3(),
    _dir: new THREE.Vector3(),
    _up: new THREE.Vector3(0, 1, 0),
    _quat: new THREE.Quaternion(),
    _mid: new THREE.Vector3(),
  };
  group.userData = ud;

  return group;
}

// ---------------------------------------------------------------------------
// updateHand — moves/rotates existing geometry, allocates nothing.
// ---------------------------------------------------------------------------

export function updateHand(group: THREE.Group, landmarks: Landmark[]): void {
  if (!landmarks || landmarks.length < 21) {
    group.visible = false;
    return;
  }
  group.visible = true;

  const ud = group.userData as HandUserData;
  const { joints, bones, palm, palmWire, bonePairs, _v1, _v2, _dir, _up, _quat } = ud;

  // 1) Position joints
  for (let i = 0; i < 21; i++) {
    const l = landmarks[i];
    joints[i].position.set(l.x, l.y, l.z);
  }

  // 2) Position / orient / scale bones
  for (let i = 0; i < bonePairs.length; i++) {
    const [from, to] = bonePairs[i];
    const a = landmarks[from];
    const b = landmarks[to];
    _v1.set(a.x, a.y, a.z);
    _v2.set(b.x, b.y, b.z);
    _dir.subVectors(_v2, _v1);
    const len = _dir.length();
    if (len < 1e-6) continue;
    _dir.divideScalar(len);

    const bone = bones[i];
    bone.position.copy(_v1);
    _quat.setFromUnitVectors(_up, _dir);
    bone.quaternion.copy(_quat);
    bone.scale.y = len;
  }

  // 3) Update palm surface (wrist + 4 MCPs + 3 midpoints)
  const wrist = landmarks[0];
  const m1 = landmarks[5];
  const m2 = landmarks[9];
  const m3 = landmarks[13];
  const m4 = landmarks[17];
  const pos = palm.geometry.getAttribute("position") as THREE.BufferAttribute;
  pos.setXYZ(0, wrist.x, wrist.y, wrist.z);
  pos.setXYZ(1, m1.x, m1.y, m1.z);
  pos.setXYZ(2, m2.x, m2.y, m2.z);
  pos.setXYZ(3, m3.x, m3.y, m3.z);
  pos.setXYZ(4, m4.x, m4.y, m4.z);
  pos.setXYZ(5, (m1.x + m2.x) / 2, (m1.y + m2.y) / 2, (m1.z + m2.z) / 2);
  pos.setXYZ(6, (m2.x + m3.x) / 2, (m2.y + m3.y) / 2, (m2.z + m3.z) / 2);
  pos.setXYZ(7, (m3.x + m4.x) / 2, (m3.y + m4.y) / 2, (m3.z + m4.z) / 2);
  pos.needsUpdate = true;
  palm.geometry.computeVertexNormals();

  // Shared buffer — flag wireframe positions too
  const wirePos = palmWire.geometry.getAttribute("position") as THREE.BufferAttribute;
  wirePos.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Pool helpers
// ---------------------------------------------------------------------------

export function createHandsPool(maxHands = 2): THREE.Group[] {
  const pool: THREE.Group[] = [];
  for (let i = 0; i < maxHands; i++) pool.push(createHand());
  return pool;
}

export function updateHandsPool(
  pool: THREE.Group[],
  hands: Landmark[][]
): void {
  for (let i = 0; i < pool.length; i++) {
    if (i < hands.length) {
      updateHand(pool[i], hands[i]);
    } else {
      pool[i].visible = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Lighting — diffuse, cold, flat
// ---------------------------------------------------------------------------

export function addHandLighting(scene: THREE.Scene): void {
  const hemi = new THREE.HemisphereLight(0xeaf1f8, 0xb8c1cc, 1.0);
  scene.add(hemi);

  const amb = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(amb);

  const key = new THREE.DirectionalLight(0xffffff, 0.55);
  key.position.set(0.6, 1.4, 1.8);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xdbe6f0, 0.3);
  fill.position.set(-1.6, 0.4, 1.0);
  scene.add(fill);
}
