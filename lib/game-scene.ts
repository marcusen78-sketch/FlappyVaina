import * as THREE from "three";

export interface GameObject {
  mesh: THREE.Mesh;
  originalPosition: THREE.Vector3;
  isGrabbed: boolean;
  isPlaced: boolean;
}

export interface GameScene {
  leftTable: THREE.Mesh;
  rightTable: THREE.Mesh;
  objects: GameObject[];
  dropZone: THREE.Box3;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABLE_WIDTH = 1.0;
const TABLE_DEPTH = 0.7;
const TABLE_HEIGHT = 0.06;
const TABLE_COLOR = 0xe8e8e8;

const LEFT_TABLE_X = -0.8;
const RIGHT_TABLE_X = 0.8;
const TABLE_Y = -0.6;

const PASTEL_COLORS = [
  0xffb3b3, // soft pink
  0xb3d4ff, // soft blue
  0xb3ffb3, // soft green
  0xfff0b3, // soft yellow
  0xe0b3ff, // soft purple
];

const OBJECT_RADIUS_MIN = 0.08;
const OBJECT_RADIUS_MAX = 0.12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTable(x: number, isDropZone: boolean): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(TABLE_WIDTH, TABLE_HEIGHT, TABLE_DEPTH);

  const material = new THREE.MeshStandardMaterial({
    color: TABLE_COLOR,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 0.95,
  });

  const table = new THREE.Mesh(geometry, material);
  table.position.set(x, TABLE_Y, 0);
  table.castShadow = true;
  table.receiveShadow = true;

  // Add a subtle border/edge highlight for the drop zone
  if (isDropZone) {
    const borderGeometry = new THREE.BoxGeometry(
      TABLE_WIDTH + 0.02,
      TABLE_HEIGHT * 0.5,
      TABLE_DEPTH + 0.02
    );
    const borderMaterial = new THREE.MeshStandardMaterial({
      color: 0xb3d4ff,
      roughness: 0.5,
      metalness: 0.1,
      transparent: true,
      opacity: 0.4,
      emissive: 0xb3d4ff,
      emissiveIntensity: 0.3,
    });
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.position.set(0, -TABLE_HEIGHT * 0.25, 0);
    table.add(border);
  }

  return table;
}

function createGameObject(
  position: THREE.Vector3,
  color: number,
  radius: number,
  type: "sphere" | "cylinder"
): GameObject {
  let geometry: THREE.BufferGeometry;

  if (type === "sphere") {
    geometry = new THREE.SphereGeometry(radius, 24, 24);
  } else {
    geometry = new THREE.CylinderGeometry(radius * 0.8, radius * 0.8, radius * 1.2, 20);
  }

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.05,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return {
    mesh,
    originalPosition: position.clone(),
    isGrabbed: false,
    isPlaced: false,
  };
}

function createShadowPlane(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(8, 6);
  const material = new THREE.ShadowMaterial({
    opacity: 0.08,
  });
  const plane = new THREE.Mesh(geometry, material);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = TABLE_Y - TABLE_HEIGHT / 2 - 0.01;
  plane.receiveShadow = true;
  return plane;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export function createGameScene(scene: THREE.Scene): GameScene {
  // Set white background
  scene.background = new THREE.Color(0xffffff);

  // Create tables
  const leftTable = createTable(LEFT_TABLE_X, false);
  const rightTable = createTable(RIGHT_TABLE_X, true);
  scene.add(leftTable);
  scene.add(rightTable);

  // Create shadow plane
  const shadowPlane = createShadowPlane();
  scene.add(shadowPlane);

  // Create 5 objects spread nicely on the left table
  const tableTop = TABLE_Y + TABLE_HEIGHT / 2;
  const objectPositions: { pos: THREE.Vector3; color: number; radius: number; type: "sphere" | "cylinder" }[] = [
    {
      pos: new THREE.Vector3(LEFT_TABLE_X - 0.3, tableTop + 0.10, -0.15),
      color: PASTEL_COLORS[0],
      radius: 0.10,
      type: "sphere",
    },
    {
      pos: new THREE.Vector3(LEFT_TABLE_X + 0.3, tableTop + 0.08, -0.10),
      color: PASTEL_COLORS[1],
      radius: 0.08,
      type: "sphere",
    },
    {
      pos: new THREE.Vector3(LEFT_TABLE_X, tableTop + 0.12, 0.10),
      color: PASTEL_COLORS[2],
      radius: 0.12,
      type: "sphere",
    },
    {
      pos: new THREE.Vector3(LEFT_TABLE_X - 0.35, tableTop + 0.09, 0.20),
      color: PASTEL_COLORS[3],
      radius: 0.09,
      type: "cylinder",
    },
    {
      pos: new THREE.Vector3(LEFT_TABLE_X + 0.35, tableTop + 0.10, 0.15),
      color: PASTEL_COLORS[4],
      radius: 0.10,
      type: "cylinder",
    },
  ];

  const objects: GameObject[] = objectPositions.map(({ pos, color, radius, type }) => {
    const obj = createGameObject(pos, color, radius, type);
    scene.add(obj.mesh);
    return obj;
  });

  // Compute the drop zone bounding box from the right table
  const dropZone = new THREE.Box3().setFromObject(rightTable);
  // Expand the drop zone slightly upward so objects hovering above the table count
  dropZone.max.y += 0.15;

  return {
    leftTable,
    rightTable,
    objects,
    dropZone,
  };
}

export function resetGameScene(gameScene: GameScene): void {
  for (const obj of gameScene.objects) {
    obj.mesh.position.copy(obj.originalPosition);
    obj.isGrabbed = false;
    obj.isPlaced = false;
  }
}

export function setupGameLighting(scene: THREE.Scene): void {
  // Soft ambient light for overall illumination
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  // Main directional light — soft, slightly from above-front-left
  const directional = new THREE.DirectionalLight(0xffffff, 0.5);
  directional.position.set(-1, 3, 2);
  directional.castShadow = true;
  directional.shadow.mapSize.set(1024, 1024);
  directional.shadow.camera.near = 0.1;
  directional.shadow.camera.far = 10;
  directional.shadow.camera.left = -2;
  directional.shadow.camera.right = 2;
  directional.shadow.camera.top = 2;
  directional.shadow.camera.bottom = -2;
  directional.shadow.radius = 4; // soft shadow edges
  scene.add(directional);

  // Subtle fill light from the right to reduce harsh contrast
  const fill = new THREE.DirectionalLight(0xffffff, 0.2);
  fill.position.set(1, 1, -1);
  scene.add(fill);
}

export function setupGameCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.2, 3.5);
  camera.lookAt(new THREE.Vector3(0, -0.3, 0));
  return camera;
}
