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
  
  private table: THREE.Group;
  private tap: THREE.Group;

  private waterParticles: THREE.InstancedMesh;
  private dummy: THREE.Object3D;
  
  private waterClipPlane: THREE.Plane;

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
    this.renderer.localClippingEnabled = true;

    this.waterClipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);

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
      side: THREE.DoubleSide,
      clippingPlanes: [this.waterClipPlane],
    });
    const dropMat = new THREE.MeshPhongMaterial({
      color: 0x38bdf8,
      flatShading: true,
    });
    const solidMat = new THREE.MeshPhongMaterial({
      color: 0x94a3b8, // Slate-400
      flatShading: true,
    });

    // 5. Pitcher (Jarra)
    this.pitcher = new THREE.Group();
    
    // Main Body (tapered top)
    const pitcherGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.7, 16);
    this.pitcherBody = new THREE.Mesh(pitcherGeo, glassMat);
    this.pitcher.add(this.pitcherBody);

    const pitcherWaterGeo = new THREE.CylinderGeometry(0.19, 0.24, 0.68, 16);
    this.pitcherWater = new THREE.Mesh(pitcherWaterGeo, waterMat);
    this.pitcher.add(this.pitcherWater);
    
    // Spout (Hendidura) on the LEFT (-X)
    const spoutGeo = new THREE.ConeGeometry(0.08, 0.2, 8);
    const spout = new THREE.Mesh(spoutGeo, glassMat);
    spout.position.set(-0.18, 0.3, 0);
    spout.rotation.z = Math.PI / 4; // Tilted up/left
    this.pitcher.add(spout);

    // Handle (Agarradera) on the RIGHT (+X)
    const handleGeo = new THREE.TorusGeometry(0.18, 0.04, 8, 16);
    const handle = new THREE.Mesh(handleGeo, glassMat);
    handle.position.set(0.25, 0, 0);
    this.pitcher.add(handle);

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
    this.glass.position.set(-0.8, -1.0, 0); // Moved to bottom-left
    this.scene.add(this.glass);

    // 6.5 Table (Mesa)
    this.table = new THREE.Group();
    const woodMat = new THREE.MeshPhongMaterial({ color: 0x8b5a2b, flatShading: true }); // Wooden texture
    
    // Table top
    const tableTopGeo = new THREE.BoxGeometry(5.0, 0.1, 1.5);
    const tableTop = new THREE.Mesh(tableTopGeo, woodMat);
    this.table.add(tableTop);
    
    // Table legs
    const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8);
    const legPositions = [
      [-2.2, -0.5, -0.5],
      [ 2.2, -0.5, -0.5],
      [-2.2, -0.5,  0.5],
      [ 2.2, -0.5,  0.5]
    ];
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(pos[0], pos[1], pos[2]);
      this.table.add(leg);
    });

    // Bonsai Tree (Low Poly)
    const bonsaiGroup = new THREE.Group();
    
    const potGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.1, 6);
    const potMat = new THREE.MeshPhongMaterial({ color: 0x4a4a4a, flatShading: true });
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.y = 0.05; 
    bonsaiGroup.add(pot);

    const trunkGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.25, 5);
    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x5c4033, flatShading: true });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.2; 
    trunk.rotation.z = 0.2;
    bonsaiGroup.add(trunk);

    const leavesGeo = new THREE.IcosahedronGeometry(0.15, 0);
    const leavesMat = new THREE.MeshPhongMaterial({ color: 0x2e8b57, flatShading: true });
    
    const leaf1 = new THREE.Mesh(leavesGeo, leavesMat);
    leaf1.position.set(-0.06, 0.32, 0);
    bonsaiGroup.add(leaf1);
    
    const leaf2 = new THREE.Mesh(leavesGeo, leavesMat);
    leaf2.position.set(0.08, 0.28, 0.05);
    leaf2.scale.set(0.7, 0.7, 0.7);
    bonsaiGroup.add(leaf2);

    bonsaiGroup.scale.set(1.5, 1.5, 1.5);
    bonsaiGroup.position.set(2.0, 0.05, -0.2); 
    this.table.add(bonsaiGroup);

    // Low Poly Chair (Behind table, right side)
    const chairGroup = new THREE.Group();
    const chairMat = new THREE.MeshPhongMaterial({ color: 0x7a4a2a, flatShading: true }); // Slightly darker wood
    
    // Seat
    const seatGeo = new THREE.BoxGeometry(0.6, 0.05, 0.6);
    const seat = new THREE.Mesh(seatGeo, chairMat);
    seat.position.y = 0.5;
    chairGroup.add(seat);

    // Chair Legs
    const chairLegGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6);
    const chairLegs = [
      [-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]
    ];
    chairLegs.forEach(pos => {
      const leg = new THREE.Mesh(chairLegGeo, chairMat);
      leg.position.set(pos[0], 0.25, pos[1]);
      chairGroup.add(leg);
    });

    // Backrest
    const backGeo = new THREE.BoxGeometry(0.6, 0.5, 0.05);
    const back = new THREE.Mesh(backGeo, chairMat);
    back.position.set(0, 0.75, -0.275);
    chairGroup.add(back);

    // Position chair in the table group
    chairGroup.scale.set(1.4, 1.4, 1.4); // Made the chair bigger
    chairGroup.position.set(1.8, -1.0, -0.8); // Moved to the right side
    chairGroup.rotation.y = -0.3; // Slight natural rotation inward
    this.table.add(chairGroup);

    this.table.position.set(0, -1.3, 0);
    this.scene.add(this.table);

    // 7. Tap (Grifo Industrial Low-Poly)
    this.tap = new THREE.Group();
    
    const metalMat = new THREE.MeshPhongMaterial({ color: 0x9ba4b5, flatShading: true, shininess: 80 });
    const brassMat = new THREE.MeshPhongMaterial({ color: 0xd4af37, flatShading: true }); // Dorado para la llave
    
    // Tubería horizontal (viene de la pared derecha)
    const neckGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6);
    const neck = new THREE.Mesh(neckGeo, metalMat);
    neck.rotation.z = Math.PI / 2;
    neck.position.set(0.25, 1.35, 0);
    this.tap.add(neck);

    // Boquilla vertical (apuntando al centro de la jarra)
    const spoutDownGeo = new THREE.CylinderGeometry(0.05, 0.03, 0.15, 6);
    const spoutDown = new THREE.Mesh(spoutDownGeo, metalMat);
    spoutDown.position.set(0, 1.275, 0);
    this.tap.add(spoutDown);

    // Llave de cruz superior
    const crossGeo = new THREE.BoxGeometry(0.16, 0.04, 0.04);
    const cross1 = new THREE.Mesh(crossGeo, brassMat);
    cross1.position.set(0, 1.4, 0);
    const cross2 = new THREE.Mesh(crossGeo, brassMat);
    cross2.position.set(0, 1.4, 0);
    cross2.rotation.y = Math.PI / 2;
    this.tap.add(cross1);
    this.tap.add(cross2);

    this.scene.add(this.tap);

    // 8. Water Particles (Gotas)
    const dropGeo = new THREE.TetrahedronGeometry(0.04);
    this.waterParticles = new THREE.InstancedMesh(dropGeo, dropMat, 300);
    this.waterParticles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.waterParticles);
    
    this.dummy = new THREE.Object3D();
  }

  update(state: WaterState, pitcherRotZ: number) {
    // Hide/Show elements based on phase
    this.tap.visible = (state.phase === "filling");
    const showGlassAndTable = (state.phase === "pouring" || state.phase === "success" || state.phase === "gameover");
    this.glass.visible = showGlassAndTable;
    this.table.visible = showGlassAndTable;

    // Update Pitcher
    if (state.phase === "filling") {
      this.pitcher.position.set(0, 0, 0);
      this.pitcher.rotation.z = pitcherRotZ;
    } else if (state.phase === "pouring") {
      this.pitcher.position.set(-0.1, 0.5, 0); // Center slightly to the left
      this.pitcher.rotation.z = pitcherRotZ;
    } else {
      this.pitcher.position.set(0, 0, 0);
      this.pitcher.rotation.z = 0;
    }

    // Update Internal Water Volumes
    // Water Volume
    const pVol = Math.max(0.000, state.pitcherVolume);
    if (pVol > 0 && (state.phase === "filling" || state.phase === "pouring")) {
      this.pitcherWater.visible = true;
      const tiltMagnitude = Math.abs(this.pitcher.rotation.z);
      const lowestWorldY = this.pitcher.position.y - 0.22 * Math.sin(tiltMagnitude) - 0.34 * Math.cos(this.pitcher.rotation.z);
      const highestWorldY = this.pitcher.position.y + 0.22 * Math.sin(tiltMagnitude) + 0.26 * Math.cos(this.pitcher.rotation.z);
      this.waterClipPlane.constant = lowestWorldY + pVol * (highestWorldY - lowestWorldY);
    } else {
      this.pitcherWater.visible = false;
    }

    const gVolRatio = Math.max(0.001, Math.min(1.0, state.glassCurrentVolume / Math.max(0.001, state.glassTargetVolume)));
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
