import * as THREE from "three";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LabBall {
  mesh: THREE.Mesh;
  originalPosition: THREE.Vector3;
  colorIndex: number;
  isGrabbed: boolean;
  isPlaced: boolean;
}

export interface TestTube {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  colorIndex: number;
  dropZoneMinX: number;
  dropZoneMaxX: number;
  position: THREE.Vector3;
}

export interface LabScene {
  balls: LabBall[];
  tubes: TestTube[];
  tray: THREE.Mesh;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BALL_RADIUS = 0.08;
const TUBE_RADIUS = 0.055;
const TUBE_HEIGHT = 0.4;
const TRAY_X = -0.7;
const TABLE_Y = -0.6;
const DROP_ZONE_HALF_WIDTH = 0.07;

const PASTEL_COLORS = [
  0xffb3b3, // pink
  0xb3d4ff, // blue
  0xb3ffb3, // green
  0xfff0b3, // yellow
  0xe0b3ff, // purple
];

// Tube X positions (right side, evenly spaced)
const TUBE_POSITIONS_X = [0.35, 0.52, 0.69, 0.86, 1.03];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function createTray(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1.0, 0.03, 0.5);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    roughness: 0.9,
    metalness: 0.0,
  });
  const tray = new THREE.Mesh(geo, mat);
  tray.position.set(TRAY_X, TABLE_Y, 0);
  tray.receiveShadow = true;
  return tray;
}

function createBall(position: THREE.Vector3, colorIndex: number): LabBall {
  const geo = new THREE.SphereGeometry(BALL_RADIUS, 24, 24);
  const mat = new THREE.MeshStandardMaterial({
    color: PASTEL_COLORS[colorIndex],
    roughness: 0.35,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.castShadow = true;

  return {
    mesh,
    originalPosition: position.clone(),
    colorIndex,
    isGrabbed: false,
    isPlaced: false,
  };
}

function createTestTube(x: number, colorIndex: number): TestTube {
  const group = new THREE.Group();
  const pos = new THREE.Vector3(x, TABLE_Y, 0);
  group.position.copy(pos);

  // Body: semi-transparent cylinder (open top)
  const bodyGeo = new THREE.CylinderGeometry(
    TUBE_RADIUS, TUBE_RADIUS * 0.85, TUBE_HEIGHT, 24, 1, true
  );
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.2,
    roughness: 0.1,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = TUBE_HEIGHT / 2;
  group.add(bodyMesh);

  // Bottom cap
  const capGeo = new THREE.CircleGeometry(TUBE_RADIUS * 0.85, 24);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    transparent: true,
    opacity: 0.4,
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = 0.005;
  group.add(cap);

  // Colored ring at top (the main color indicator)
  const ringGeo = new THREE.TorusGeometry(TUBE_RADIUS + 0.005, 0.013, 8, 24);
  const ringMat = new THREE.MeshStandardMaterial({
    color: PASTEL_COLORS[colorIndex],
    emissive: PASTEL_COLORS[colorIndex],
    emissiveIntensity: 0.3,
    roughness: 0.3,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.y = TUBE_HEIGHT;
  group.add(ringMesh);

  // Small colored dot at base (secondary indicator)
  const dotGeo = new THREE.SphereGeometry(0.02, 12, 12);
  const dotMat = new THREE.MeshStandardMaterial({
    color: PASTEL_COLORS[colorIndex],
    emissive: PASTEL_COLORS[colorIndex],
    emissiveIntensity: 0.2,
  });
  const dot = new THREE.Mesh(dotGeo, dotMat);
  dot.position.y = 0.03;
  group.add(dot);

  return {
    group,
    bodyMesh,
    ringMesh,
    colorIndex,
    dropZoneMinX: x - DROP_ZONE_HALF_WIDTH,
    dropZoneMaxX: x + DROP_ZONE_HALF_WIDTH,
    position: pos,
  };
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export function createLabScene(scene: THREE.Scene): LabScene {
  scene.background = new THREE.Color(0xffffff);

  // Tray on the left
  const tray = createTray();
  scene.add(tray);

  // 5 balls on the tray
  const trayTop = TABLE_Y + 0.015 + BALL_RADIUS;
  const ballPositions = [
    new THREE.Vector3(TRAY_X - 0.25, trayTop, -0.1),
    new THREE.Vector3(TRAY_X - 0.1, trayTop, 0.1),
    new THREE.Vector3(TRAY_X + 0.05, trayTop, -0.05),
    new THREE.Vector3(TRAY_X + 0.2, trayTop, 0.12),
    new THREE.Vector3(TRAY_X + 0.35, trayTop, -0.08),
  ];

  const balls: LabBall[] = [];
  for (let i = 0; i < 5; i++) {
    const ball = createBall(ballPositions[i], i);
    scene.add(ball.mesh);
    balls.push(ball);
  }

  // 5 tubes on the right (shuffled color order for cognitive challenge)
  const shuffledColors = shuffleArray([0, 1, 2, 3, 4]);
  const tubes: TestTube[] = [];
  for (let i = 0; i < 5; i++) {
    const tube = createTestTube(TUBE_POSITIONS_X[i], shuffledColors[i]);
    scene.add(tube.group);
    tubes.push(tube);
  }

  // Shadow plane
  const shadowGeo = new THREE.PlaneGeometry(6, 4);
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.06 });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = TABLE_Y - 0.02;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  return { balls, tubes, tray };
}

export function resetLabScene(labScene: LabScene): void {
  for (const ball of labScene.balls) {
    ball.mesh.position.copy(ball.originalPosition);
    ball.mesh.visible = true;
    ball.mesh.scale.set(1, 1, 1);
    ball.isGrabbed = false;
    ball.isPlaced = false;
  }
}

export function setupLabLighting(scene: THREE.Scene): void {
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));

  const dir = new THREE.DirectionalLight(0xffffff, 0.5);
  dir.position.set(-1, 3, 2);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 0.1;
  dir.shadow.camera.far = 10;
  dir.shadow.camera.left = -3;
  dir.shadow.camera.right = 3;
  dir.shadow.camera.top = 3;
  dir.shadow.camera.bottom = -3;
  dir.shadow.radius = 4;
  scene.add(dir);

  const fill = new THREE.DirectionalLight(0xffffff, 0.2);
  fill.position.set(1, 1, -1);
  scene.add(fill);

  // Subtle point light near tubes for glass effect
  const tubeLight = new THREE.PointLight(0xffffff, 0.3, 3);
  tubeLight.position.set(0.7, 0.2, 0.5);
  scene.add(tubeLight);
}

export function setupLabCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    50, window.innerWidth / window.innerHeight, 0.1, 100
  );
  camera.position.set(0, 1.2, 3.5);
  camera.lookAt(new THREE.Vector3(0, -0.3, 0));
  return camera;
}
