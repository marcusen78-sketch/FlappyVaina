import * as THREE from "three";

export interface StarDef {
  position: THREE.Vector3;
}

export interface SegmentDef {
  from: number;
  to: number;
  controlPoint: THREE.Vector3;
}

export interface ConstellationDef {
  id: string;
  stars: StarDef[];
  order: number[];
  segments: SegmentDef[];
}

function v(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

function computeControl(a: THREE.Vector3, b: THREE.Vector3, offset: number): THREE.Vector3 {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a).normalize();
  const perp = new THREE.Vector3(-dir.y, dir.x, dir.z * 0.3).normalize();
  return mid.add(perp.multiplyScalar(offset));
}

// Wider horizontal spread (x: -1.0 to 1.0), shorter vertical (y: -0.25 to 0.25)
const pool: ConstellationDef[] = [
  {
    // Zigzag — like a lightning bolt going right
    id: "rayo",
    stars: [
      { position: v(-0.95, 0.15, 0) },
      { position: v(-0.45, -0.2, 0) },
      { position: v(0.0, 0.2, 0) },
      { position: v(0.5, -0.15, 0) },
      { position: v(0.95, 0.1, 0) },
    ],
    order: [0, 1, 2, 3, 4],
    segments: [],
  },
  {
    // Wide W shape
    id: "onda",
    stars: [
      { position: v(-1.0, 0.2, 0) },
      { position: v(-0.5, -0.25, 0) },
      { position: v(0.0, 0.15, 0) },
      { position: v(0.5, -0.25, 0) },
      { position: v(1.0, 0.2, 0) },
    ],
    order: [0, 1, 2, 3, 4],
    segments: [],
  },
  {
    // Hook — starts left, sweeps right then dips down
    id: "gancho",
    stars: [
      { position: v(-0.9, -0.1, 0) },
      { position: v(-0.35, 0.25, 0) },
      { position: v(0.3, 0.2, 0) },
      { position: v(0.9, 0.0, 0) },
      { position: v(0.5, -0.25, 0) },
    ],
    order: [0, 1, 2, 3, 4],
    segments: [],
  },
  {
    // Staircase descending left to right
    id: "escalera",
    stars: [
      { position: v(-0.9, 0.25, 0) },
      { position: v(-0.4, 0.25, 0) },
      { position: v(-0.1, 0.0, 0) },
      { position: v(0.4, 0.0, 0) },
      { position: v(0.9, -0.2, 0) },
    ],
    order: [0, 1, 2, 3, 4],
    segments: [],
  },
  {
    // Boomerang — out right and back left-ish
    id: "bumeran",
    stars: [
      { position: v(-0.85, 0.0, 0) },
      { position: v(-0.2, 0.25, 0) },
      { position: v(0.5, 0.15, 0) },
      { position: v(0.95, -0.1, 0) },
      { position: v(0.3, -0.25, 0) },
    ],
    order: [0, 1, 2, 3, 4],
    segments: [],
  },
];

for (const c of pool) {
  c.segments = [];
  for (let i = 0; i < c.order.length - 1; i++) {
    const fromIdx = c.order[i];
    const toIdx = c.order[i + 1];
    const a = c.stars[fromIdx].position;
    const b = c.stars[toIdx].position;
    const sign = i % 2 === 0 ? 1 : -1;
    const offset = 0.15 + (i * 0.03);
    c.segments.push({
      from: fromIdx,
      to: toIdx,
      controlPoint: computeControl(a, b, offset * sign),
    });
  }
}

export function getRandomConstellation(): ConstellationDef {
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

export function getCurveForSegment(constellation: ConstellationDef, segIndex: number): THREE.QuadraticBezierCurve3 {
  const seg = constellation.segments[segIndex];
  const start = constellation.stars[seg.from].position;
  const end = constellation.stars[seg.to].position;
  return new THREE.QuadraticBezierCurve3(start.clone(), seg.controlPoint.clone(), end.clone());
}
