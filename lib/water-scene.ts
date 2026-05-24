import * as THREE from "three";
import type { WaterState } from "./water-logic";

export class WaterSceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private pitcher: THREE.Group;
  private pitcherBody: THREE.Mesh;
  private pitcherWater: THREE.Mesh;
  
  private glass: THREE.Group;
  private glassBody: THREE.Mesh;
  private glassWater: THREE.Mesh;
  
  private tap: THREE.Mesh;

  private waterParticles: THREE.InstancedMesh;
  private dummy: THREE.Object3D;

  constructor(canvas: HTMLCanvasElement) {
    // 1. Setup Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#f1f5f9"); // Slate-50
    // Subtle fog to blend distant geometry
    this.scene.fog = new THREE.FogExp2("#f1f5f9", 0.05);

    // 2. Setup Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 0, 5);

    // 3. Setup Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    // Materials
    const glassMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      flatShading: true,
      side: THREE.DoubleSide
    });
    const waterMat = new THREE.MeshPhongMaterial({
      color: 0x38bdf8, // Sky-400
      flatShading: true,
    });
    const solidMat = new THREE.MeshPhongMaterial({
      color: 0x94a3b8, // Slate-400
      flatShading: true,
    });

    // 5. Pitcher (Jarra)
    this.pitcher = new THREE.Group();
    const pitcherGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 8);
    this.pitcherBody = new THREE.Mesh(pitcherGeo, glassMat);
    this.pitcher.add(this.pitcherBody);

    const pitcherWaterGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.58, 8);
    this.pitcherWater = new THREE.Mesh(pitcherWaterGeo, waterMat);
    this.pitcherWater.position.y = -0.3; // Starts at bottom
    this.pitcherWater.scale.y = 0.001; // Empty
    this.pitcher.add(this.pitcherWater);
    
    // Spout indicator
    const spoutGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const spout = new THREE.Mesh(spoutGeo, solidMat);
    spout.position.set(0.2, 0.2, 0);
    this.pitcher.add(spout);
    this.scene.add(this.pitcher);

    // 6. Glass (Vaso)
    this.glass = new THREE.Group();
    const glassGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 8);
    this.glassBody = new THREE.Mesh(glassGeo, glassMat);
    this.glass.add(this.glassBody);

    const glassWaterGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.38, 8);
    this.glassWater = new THREE.Mesh(glassWaterGeo, waterMat);
    this.glassWater.position.y = -0.2; // Starts at bottom
    this.glassWater.scale.y = 0.001;
    this.glass.add(this.glassWater);
    this.glass.position.set(0, -1.0, 0);
    this.scene.add(this.glass);

    // 7. Tap (Grifo)
    const tapGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 6);
    this.tap = new THREE.Mesh(tapGeo, solidMat);
    this.tap.position.set(0, 1.3, 0);
    this.scene.add(this.tap);

    // 8. Water Particles (InstancedMesh)
    const dropGeo = new THREE.TetrahedronGeometry(0.03);
    this.waterParticles = new THREE.InstancedMesh(dropGeo, waterMat, 300);
    this.waterParticles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.waterParticles);
    
    this.dummy = new THREE.Object3D();
  }

  update(state: WaterState, pitcherRotZ: number) {
    // Hide/Show elements based on phase
    this.tap.visible = (state.phase === "filling");
    this.glass.visible = (state.phase === "pouring" || state.phase === "success" || state.phase === "gameover");

    // Update Pitcher
    if (state.phase === "filling") {
      this.pitcher.position.set(0, 0, 0);
      this.pitcher.rotation.z = pitcherRotZ;
    } else if (state.phase === "pouring") {
      this.pitcher.position.set(0, 0.5, 0); // Move up to pour
      this.pitcher.rotation.z = pitcherRotZ;
    } else {
      this.pitcher.position.set(0, 0, 0);
      this.pitcher.rotation.z = 0;
    }

    // Update Internal Water Volumes
    // Scale goes from 0.001 to 1.0. Position Y must adjust to keep bottom anchored.
    const pVol = Math.max(0.001, state.pitcherVolume);
    this.pitcherWater.scale.y = pVol;
    this.pitcherWater.position.y = -0.29 + (0.58 * pVol) / 2;

    const gVolRatio = Math.max(0.001, state.glassCurrentVolume / Math.max(0.001, state.glassTargetVolume));
    this.glassWater.scale.y = gVolRatio;
    this.glassWater.position.y = -0.19 + (0.38 * gVolRatio) / 2;

    // Adjust glass width based on state
    this.glass.scale.set(state.glassWidth / 0.3, 1, state.glassWidth / 0.3);

    // Update Particles
    let activeCount = 0;
    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      this.dummy.position.set(p.x, p.y, 0);
      
      // Add slight rotation to droplets for visual flair
      this.dummy.rotation.x += 0.1;
      this.dummy.rotation.y += 0.1;
      
      this.dummy.updateMatrix();
      this.waterParticles.setMatrixAt(activeCount, this.dummy.matrix);
      activeCount++;
    }
    this.waterParticles.count = activeCount;
    this.waterParticles.instanceMatrix.needsUpdate = true;
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    this.renderer.dispose();
    this.pitcherBody.geometry.dispose();
    (this.pitcherBody.material as THREE.Material).dispose();
    this.waterParticles.dispose();
  }
}
