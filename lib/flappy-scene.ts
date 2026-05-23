import * as THREE from "three";
import type { ColumnState, FlappyState } from "./flappy-logic";

export class FlappySceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  // Key meshes
  private planeMesh!: THREE.Mesh;
  private columnGroupMap: Map<number, THREE.Group> = new Map();
  private clouds: THREE.Group[] = [];

  // Lighting
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    
    // Soft blue-gray sky color
    const skyColor = 0xeaf0f4;
    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.FogExp2(skyColor, 0.22);

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    // Position camera slightly offset to view 3D depth of origami/columns
    this.camera.position.set(0, 0.2, 2.5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLighting();
    this.createPlane();
    this.setupClouds();
  }

  private setupLighting(): void {
    // Hemispherical natural light
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xb8ccd9, 1.2);
    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);

    // Warm directional sun light
    this.dirLight = new THREE.DirectionalLight(0xfff8f0, 0.9);
    this.dirLight.position.set(5, 8, 4);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 25;
    this.dirLight.shadow.camera.left = -3;
    this.dirLight.shadow.camera.right = 3;
    this.dirLight.shadow.camera.top = 3;
    this.dirLight.shadow.camera.bottom = -3;
    this.scene.add(this.dirLight);
  }

  private createPlane(): void {
    const geom = new THREE.BufferGeometry();
    // Vertices for origami paper plane pointing in +X
    const vertices = new Float32Array([
      // x, y, z
      0.15, 0, 0,         // 0: Nose
      -0.15, 0, 0,        // 1: Tail center
      -0.12, 0.02, 0.13,   // 2: Left wing tip
      -0.12, 0.02, -0.13,  // 3: Right wing tip
      -0.11, -0.05, 0     // 4: Keel bottom
    ]);

    const indices = [
      0, 4, 1, // Keel right
      0, 1, 4, // Keel left
      0, 1, 3, // Right wing
      0, 2, 1  // Left wing
    ];

    geom.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    this.planeMesh = new THREE.Mesh(geom, mat);
    this.planeMesh.castShadow = true;
    this.planeMesh.receiveShadow = true;
    this.scene.add(this.planeMesh);

    // Initial position
    this.planeMesh.position.set(-0.4, 0, 0);
  }

  private setupClouds(): void {
    // Generate static clouds in the background at different depths
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true,
    });

    for (let i = 0; i < 7; i++) {
      const cloud = new THREE.Group();
      const numSpheres = 3 + Math.floor(Math.random() * 3);
      for (let s = 0; s < numSpheres; s++) {
        const sphereGeom = new THREE.SphereGeometry(
          0.12 + Math.random() * 0.15,
          6,
          6
        );
        const sphere = new THREE.Mesh(sphereGeom, cloudMat);
        sphere.position.set(
          (s - numSpheres / 2) * 0.18 + (Math.random() - 0.5) * 0.08,
          (Math.random() - 0.5) * 0.06,
          (Math.random() - 0.5) * 0.06
        );
        cloud.add(sphere);
      }

      // Spread clouds across scene width and depth
      cloud.position.set(
        (Math.random() - 0.5) * 6,
        0.3 + Math.random() * 0.7,
        -1.5 - Math.random() * 1.5
      );
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  private createGreekColumn(height: number, isTop: boolean): THREE.Group {
    const group = new THREE.Group();
    
    const material = new THREE.MeshStandardMaterial({
      color: 0xf5f3ee, // Parchment white
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });

    // 1. Plinth (square base/top)
    const plinthGeom = new THREE.BoxGeometry(0.18, 0.05, 0.18);
    const plinth = new THREE.Mesh(plinthGeom, material);
    plinth.castShadow = true;
    plinth.receiveShadow = true;

    // 2. Capital (top detailing)
    const capGeom = new THREE.BoxGeometry(0.20, 0.04, 0.20);
    const cap = new THREE.Mesh(capGeom, material);
    cap.castShadow = true;
    cap.receiveShadow = true;

    // 3. Fluted Shaft (low-poly cylinder)
    const shaftHeight = height - 0.12;
    const shaftGeom = new THREE.CylinderGeometry(0.065, 0.075, shaftHeight, 10);
    const shaft = new THREE.Mesh(shaftGeom, material);
    shaft.castShadow = true;
    shaft.receiveShadow = true;

    // 4. Torus decorative ring
    const torusGeom = new THREE.TorusGeometry(0.075, 0.015, 6, 12);
    const torus = new THREE.Mesh(torusGeom, material);
    torus.rotation.x = Math.PI / 2;
    torus.castShadow = true;

    if (isTop) {
      // Top column extends upwards from y = 0 (gap top edge)
      shaft.position.y = shaftHeight / 2 + 0.06;
      cap.position.y = 0.02;
      plinth.position.y = height - 0.025;
      torus.position.y = 0.045;
    } else {
      // Bottom column extends downwards from y = 0 (gap bottom edge)
      shaft.position.y = -(shaftHeight / 2 + 0.06);
      cap.position.y = -0.02;
      plinth.position.y = -(height - 0.025);
      torus.position.y = -0.045;
    }

    group.add(plinth);
    group.add(cap);
    group.add(shaft);
    group.add(torus);

    return group;
  }

  update(state: FlappyState, deltaTime: number): void {
    // 1. Update Paper Plane Position and Pitch Rotation
    this.planeMesh.position.y = state.planeY;
    
    // Aerodynamic rotation: tilts up/down based on velocity
    const targetRotZ = Math.max(-0.6, Math.min(0.5, state.planeVelocityY * 0.4));
    this.planeMesh.rotation.z += (targetRotZ - this.planeMesh.rotation.z) * 0.15;
    
    // Give it a tiny constant roll wobble for wind effect
    this.planeMesh.rotation.x = Math.sin(performance.now() * 0.008) * 0.08;

    // 2. Update Greek Columns
    const activeIds = new Set(state.columns.map((c) => c.id));

    // Remove columns that are no longer in state
    for (const [id, colGroup] of this.columnGroupMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(colGroup);
        this.columnGroupMap.delete(id);
      }
    }

    // Add or update columns from state
    for (const col of state.columns) {
      let colGroup = this.columnGroupMap.get(col.id);

      if (!colGroup) {
        // Create new column group containing both top and bottom columns
        colGroup = new THREE.Group();

        // Screen boundary is roughly at [-1.3, 1.3] Y axis
        const screenHalfHeight = 1.6;
        
        // Bottom column height extends from floor (-screenHalfHeight) to gap bottom (gapY - gapSize/2)
        const bottomHeight = col.gapY - col.gapSize / 2 - (-screenHalfHeight);
        const bottomCol = this.createGreekColumn(bottomHeight, false);
        bottomCol.position.y = col.gapY - col.gapSize / 2;

        // Top column height extends from ceiling (screenHalfHeight) to gap top (gapY + gapSize/2)
        const topHeight = screenHalfHeight - (col.gapY + col.gapSize / 2);
        const topCol = this.createGreekColumn(topHeight, true);
        topCol.position.y = col.gapY + col.gapSize / 2;

        colGroup.add(bottomCol);
        colGroup.add(topCol);
        this.scene.add(colGroup);
        this.columnGroupMap.set(col.id, colGroup);
      }

      // Update column X position
      colGroup.position.x = col.x;
    }

    // 3. Move Clouds (Parallax scrolling)
    const cloudSpeed = 0.12;
    for (const cloud of this.clouds) {
      cloud.position.x -= cloudSpeed * deltaTime;
      // Loop cloud to the right side if it goes off-screen
      if (cloud.position.x < -3.5) {
        cloud.position.x = 3.5;
        cloud.position.y = 0.3 + Math.random() * 0.7;
      }
    }
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose(): void {
    this.renderer.dispose();
    for (const colGroup of this.columnGroupMap.values()) {
      this.scene.remove(colGroup);
    }
    this.columnGroupMap.clear();
    this.clouds = [];
  }
}
