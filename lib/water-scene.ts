import * as THREE from "three";
import type { WaterState } from "./water-logic";

export class WaterSceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private pitcher: THREE.Group;
  private pitcherBody: THREE.Mesh;
  
  private pitcherWaterLayers: {
    mesh: THREE.Mesh;
    material: THREE.MeshPhongMaterial;
    topPlane: THREE.Plane;
    bottomPlane: THREE.Plane;
  }[] = [];
  
  private glass: THREE.Group;
  private glassBody: THREE.Mesh;
  private glassWater: THREE.Mesh;
  private glassWaterMat: THREE.MeshPhongMaterial;
  
  private trash: THREE.Group;
  
  private table: THREE.Group;
  private tap: THREE.Group;

  private waterParticles: THREE.InstancedMesh;
  private dummy: THREE.Object3D;
  
  private readonly colorWater = new THREE.Color(0x38bdf8); // Sky-400
  private readonly colorPoison = new THREE.Color(0xd09b2c); // Pantone 7555 U (Amarillento/marrón)

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#f1f5f9");
    this.scene.fog = new THREE.FogExp2("#f1f5f9", 0.05);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0, 5);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    const glassMat = new THREE.MeshPhongMaterial({
      color: 0xffffff, transparent: true, opacity: 0.3, flatShading: true, side: THREE.DoubleSide
    });

    // Pitcher
    this.pitcher = new THREE.Group();
    const pitcherGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.7, 16);
    this.pitcherBody = new THREE.Mesh(pitcherGeo, glassMat);
    this.pitcher.add(this.pitcherBody);

    // Dynamic Liquid Layers (Up to 5)
    const pitcherWaterGeo = new THREE.CylinderGeometry(0.19, 0.24, 0.68, 16);
    for (let i = 0; i < 5; i++) {
      const topPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
      const bottomPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const mat = new THREE.MeshPhongMaterial({
        color: this.colorWater,
        flatShading: true,
        side: THREE.DoubleSide,
        clippingPlanes: [topPlane, bottomPlane],
      });
      const mesh = new THREE.Mesh(pitcherWaterGeo, mat);
      this.pitcher.add(mesh);
      this.pitcherWaterLayers.push({ mesh, material: mat, topPlane, bottomPlane });
    }
    
    // Spout LEFT (-X)
    const spoutGeo = new THREE.ConeGeometry(0.08, 0.2, 8);
    const spoutLeft = new THREE.Mesh(spoutGeo, glassMat);
    spoutLeft.position.set(-0.18, 0.3, 0);
    spoutLeft.rotation.z = Math.PI / 4; 
    this.pitcher.add(spoutLeft);

    // Spout RIGHT (+X)
    const spoutRight = new THREE.Mesh(spoutGeo, glassMat);
    spoutRight.position.set(0.18, 0.3, 0);
    spoutRight.rotation.z = -Math.PI / 4; 
    this.pitcher.add(spoutRight);

    this.scene.add(this.pitcher);

    // Glass (Left)
    this.glass = new THREE.Group();
    const glassGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 8);
    this.glassBody = new THREE.Mesh(glassGeo, glassMat);
    this.glass.add(this.glassBody);

    const glassWaterGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.38, 8);
    this.glassWaterMat = new THREE.MeshPhongMaterial({ color: this.colorWater, flatShading: true });
    this.glassWater = new THREE.Mesh(glassWaterGeo, this.glassWaterMat);
    this.glassWater.position.y = -0.2;
    this.glassWater.scale.y = 0.001;
    this.glass.add(this.glassWater);
    this.glass.position.set(-0.8, -1.0, 0);
    this.scene.add(this.glass);

    // Sink (Fregadero Metálico Amplio)
    this.trash = new THREE.Group(); 
    const sinkDepth = 0.5;
    const sinkWidth = 0.7; // Wider to catch poison easily
    const sinkHeight = 0.3;
    const thickness = 0.05;
    const sinkMat = new THREE.MeshPhongMaterial({ color: 0xe2e8f0, flatShading: true, shininess: 90 }); // Lighter Metallic Steel

    // Basin walls
    const sinkBottom = new THREE.Mesh(new THREE.BoxGeometry(sinkWidth, thickness, sinkDepth), sinkMat);
    sinkBottom.position.y = -sinkHeight/2 + thickness/2;
    this.trash.add(sinkBottom);

    const sinkLeft = new THREE.Mesh(new THREE.BoxGeometry(thickness, sinkHeight, sinkDepth), sinkMat);
    sinkLeft.position.x = -sinkWidth/2 + thickness/2;
    this.trash.add(sinkLeft);

    const sinkRight = new THREE.Mesh(new THREE.BoxGeometry(thickness, sinkHeight, sinkDepth), sinkMat);
    sinkRight.position.x = sinkWidth/2 - thickness/2;
    this.trash.add(sinkRight);

    const sinkBack = new THREE.Mesh(new THREE.BoxGeometry(sinkWidth, sinkHeight, thickness), sinkMat);
    sinkBack.position.z = -sinkDepth/2 + thickness/2;
    this.trash.add(sinkBack);

    const sinkFront = new THREE.Mesh(new THREE.BoxGeometry(sinkWidth, sinkHeight, thickness), sinkMat);
    sinkFront.position.z = sinkDepth/2 - thickness/2;
    this.trash.add(sinkFront);

    // Position sink like a modern countertop basin
    this.trash.position.set(0.8, -1.1, 0);
    this.scene.add(this.trash);

    // Kitchen Countertop (Encimera y Fondo Minimalista)
    this.table = new THREE.Group();
    const counterMat = new THREE.MeshPhongMaterial({ color: 0xf8fafc, flatShading: true }); // Quartz/Marble white
    const baseMat = new THREE.MeshPhongMaterial({ color: 0x64748b, flatShading: true }); // Lighter Slate cabinets
    
    // Main Counter Surface
    const counterTopGeo = new THREE.BoxGeometry(5.0, 0.15, 1.5);
    const counterTop = new THREE.Mesh(counterTopGeo, counterMat);
    this.table.add(counterTop);

    // Lower Cabinets
    const baseGeo = new THREE.BoxGeometry(4.8, 1.5, 1.3);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.825;
    this.table.add(base);

    // Background Wall Removed to let the light #f1f5f9 scene background shine through

    // Floating Shelf
    const shelfGeo = new THREE.BoxGeometry(3, 0.1, 0.5);
    const woodMat = new THREE.MeshPhongMaterial({ color: 0x8b5a2b, flatShading: true });
    const shelf = new THREE.Mesh(shelfGeo, woodMat);
    shelf.position.set(-1.0, 2.0, -1.7);
    this.table.add(shelf);

    // Shelf Decor (Books, Plant, Alarm Clock)
    const shelfDecor = new THREE.Group();
    
    // 3 Recipe Books
    const book1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.25), new THREE.MeshPhongMaterial({color: 0x3b82f6}));
    book1.position.set(0.3, 0.2, 0); book1.rotation.z = -0.1;
    shelfDecor.add(book1);
    
    const book2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.25), new THREE.MeshPhongMaterial({color: 0x10b981}));
    book2.position.set(0.2, 0.21, 0);
    shelfDecor.add(book2);

    const book3 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.25), new THREE.MeshPhongMaterial({color: 0xf59e0b}));
    book3.position.set(0.12, 0.19, 0); book3.rotation.z = 0.05;
    shelfDecor.add(book3);
    
    // Bonsai (Instead of simple plant)
    const bonsaiGroup = new THREE.Group();
    const potGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.1, 6);
    const potMat = new THREE.MeshPhongMaterial({ color: 0x4a4a4a, flatShading: true });
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.y = 0.05; 
    bonsaiGroup.add(pot);
    const trunkGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.25, 5);
    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x5c4033, flatShading: true });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.2; trunk.rotation.z = 0.2;
    bonsaiGroup.add(trunk);
    const leavesGeo = new THREE.IcosahedronGeometry(0.15, 0);
    const leavesMat = new THREE.MeshPhongMaterial({ color: 0x2e8b57, flatShading: true });
    const leaf1 = new THREE.Mesh(leavesGeo, leavesMat); leaf1.position.set(-0.06, 0.32, 0);
    const leaf2 = new THREE.Mesh(leavesGeo, leavesMat); leaf2.position.set(0.08, 0.28, 0.05); leaf2.scale.set(0.7,0.7,0.7);
    bonsaiGroup.add(leaf1); bonsaiGroup.add(leaf2);
    bonsaiGroup.scale.set(0.8, 0.8, 0.8);
    bonsaiGroup.position.set(-1.0, 0.05, 0);
    shelfDecor.add(bonsaiGroup);

    // Alarm Clock (Scaled up)
    const clockGroup = new THREE.Group();
    const clockBody = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.08), new THREE.MeshPhongMaterial({ color: 0xef4444, flatShading: true }));
    clockBody.position.y = 0.075;
    clockGroup.add(clockBody);
    const bellGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8);
    const bellMat = new THREE.MeshPhongMaterial({ color: 0xeab308, flatShading: true }); // Gold bell
    const bell1 = new THREE.Mesh(bellGeo, bellMat);
    bell1.position.set(-0.05, 0.16, 0); bell1.rotation.x = Math.PI/2;
    clockGroup.add(bell1);
    const bell2 = new THREE.Mesh(bellGeo, bellMat);
    bell2.position.set(0.05, 0.16, 0); bell2.rotation.x = Math.PI/2;
    clockGroup.add(bell2);
    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 16), new THREE.MeshPhongMaterial({ color: 0xffffff }));
    clockFace.rotation.x = Math.PI/2;
    clockFace.position.set(0, 0.075, 0.04);
    clockGroup.add(clockFace);
    clockGroup.scale.set(1.6, 1.6, 1.6); // Made significantly larger
    clockGroup.position.set(0.8, 0.0, 0);
    shelfDecor.add(clockGroup);

    shelfDecor.position.set(-1.0, 2.0, -1.7);
    this.table.add(shelfDecor);

    // Minimalist Fridge (Detailed with Dispenser and Gap)
    const fridgeGroup = new THREE.Group();
    const metalFridgeMat = new THREE.MeshPhongMaterial({ color: 0xf8fafc, flatShading: true }); // Bright white metal
    const handleMat = new THREE.MeshPhongMaterial({ color: 0x94a3b8, flatShading: true });
    const dispMat = new THREE.MeshPhongMaterial({ color: 0x1e293b, flatShading: true }); // Dark dispenser panel
    
    const fridgeBottom = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.8), metalFridgeMat);
    fridgeBottom.position.y = 0.35; // Position relative to table group
    fridgeGroup.add(fridgeBottom);
    
    // Detailed Water Dispenser
    const dispGroup = new THREE.Group();
    const dispenserFrame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.02), dispMat);
    dispGroup.add(dispenserFrame);
    
    const dispInner = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.38, 0.03), new THREE.MeshPhongMaterial({ color: 0x475569, flatShading: true }));
    dispInner.position.z = -0.01;
    dispGroup.add(dispInner);
    
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), handleMat);
    nozzle.position.set(0, 0.12, 0.01);
    dispGroup.add(nozzle);
    
    const btnMat = new THREE.MeshPhongMaterial({ color: 0x38bdf8 }); // Blue LED
    for(let i=0; i<3; i++) {
        const btn = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.01), btnMat);
        btn.position.set(-0.08 + i*0.08, 0.18, 0.015);
        dispGroup.add(btn);
    }
    
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.08), handleMat);
    tray.position.set(0, -0.21, 0.03);
    dispGroup.add(tray);
    
    dispGroup.position.set(0.2, 0.6, 0.41);
    fridgeGroup.add(dispGroup);

    const handleBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), handleMat);
    handleBottom.position.set(-0.45, 0.8, 0.42);
    fridgeGroup.add(handleBottom);

    const fridgeTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.8), metalFridgeMat);
    fridgeTop.position.y = 2.1; 
    fridgeGroup.add(fridgeTop);
    
    const handleTop = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8), handleMat);
    handleTop.position.set(-0.45, 1.9, 0.42);
    fridgeGroup.add(handleTop);

    const fridgeGap = new THREE.Mesh(new THREE.BoxGeometry(1.21, 0.04, 0.81), new THREE.MeshPhongMaterial({ color: 0x475569, flatShading: true }));
    fridgeGap.position.y = 1.48;
    fridgeGroup.add(fridgeGap);

    fridgeGroup.position.set(2.5, 0, -1.5);
    this.table.add(fridgeGroup);

    this.table.position.set(0, -1.3, 0);
    this.scene.add(this.table);

    // Tap (Industrial Over-counter Faucet)
    this.tap = new THREE.Group();
    const metalMat = new THREE.MeshPhongMaterial({ color: 0x9ba4b5, flatShading: true, shininess: 80 });
    const brassMat = new THREE.MeshPhongMaterial({ color: 0xd4af37, flatShading: true }); // Gold valve
    
    // Vertical pipe originating from the right of the sink
    // The counter top in world space is exactly at Y = -1.3
    // We want the pipe to go from Y = -1.3 up to Y = 1.35 (Total height: 2.65)
    // The center of the cylinder will be at Y = 0.025
    const vertPipeGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.65, 6);
    const vertPipe = new THREE.Mesh(vertPipeGeo, metalMat);
    vertPipe.position.set(1.25, 0.025, -0.2); 
    this.tap.add(vertPipe);
    
    // Horizontal pipe stretching left towards center (x=0)
    const horizPipeGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.25, 6);
    const horizPipe = new THREE.Mesh(horizPipeGeo, metalMat);
    horizPipe.rotation.z = Math.PI / 2;
    horizPipe.position.set(0.625, 1.35, -0.2);
    this.tap.add(horizPipe);

    // Forward extension pipe reaching over the pitcher
    const fwdPipeGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6);
    const fwdPipe = new THREE.Mesh(fwdPipeGeo, metalMat);
    fwdPipe.rotation.x = Math.PI / 2;
    fwdPipe.position.set(0, 1.35, -0.1);
    this.tap.add(fwdPipe);

    // Spout nozzle pointing down
    const spoutDownGeo = new THREE.CylinderGeometry(0.05, 0.03, 0.15, 6);
    const spoutDown = new THREE.Mesh(spoutDownGeo, metalMat);
    spoutDown.position.set(0, 1.275, 0);
    this.tap.add(spoutDown);
    
    // Large Brass Valve on top of the spout
    const valveBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), metalMat);
    valveBase.position.set(0, 1.4, 0);
    this.tap.add(valveBase);
    
    const valveCrossGeo = new THREE.BoxGeometry(0.2, 0.04, 0.04);
    const valve1 = new THREE.Mesh(valveCrossGeo, brassMat);
    valve1.position.set(0, 1.45, 0);
    this.tap.add(valve1);
    
    const valve2 = new THREE.Mesh(valveCrossGeo, brassMat);
    valve2.position.set(0, 1.45, 0);
    valve2.rotation.y = Math.PI / 2;
    this.tap.add(valve2);

    this.scene.add(this.tap);

    // Particles (Colorable instances)
    const dropGeo = new THREE.TetrahedronGeometry(0.04);
    const dropMat = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true }); // Base white, tinted by setColorAt
    this.waterParticles = new THREE.InstancedMesh(dropGeo, dropMat, 400);
    this.waterParticles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.waterParticles);
    
    this.dummy = new THREE.Object3D();
  }

  update(state: WaterState, pitcherRotZ: number) {
    this.pitcher.position.set(-0.1, 0.5, 0);
    this.pitcher.rotation.z = pitcherRotZ;

    // Robust 4-point bounds for any rotation
    const Y1 = this.pitcher.position.y - 0.22 * Math.sin(this.pitcher.rotation.z) - 0.34 * Math.cos(this.pitcher.rotation.z);
    const Y2 = this.pitcher.position.y + 0.22 * Math.sin(this.pitcher.rotation.z) - 0.34 * Math.cos(this.pitcher.rotation.z);
    const Y3 = this.pitcher.position.y - 0.22 * Math.sin(this.pitcher.rotation.z) + 0.26 * Math.cos(this.pitcher.rotation.z);
    const Y4 = this.pitcher.position.y + 0.22 * Math.sin(this.pitcher.rotation.z) + 0.26 * Math.cos(this.pitcher.rotation.z);
    
    const lowestWorldY = Math.min(Y1, Y2, Y3, Y4);
    const highestWorldY = Math.max(Y1, Y2, Y3, Y4);
    const rangeY = highestWorldY - lowestWorldY;

    // Render Multi-Layers
    let cumulativeVol = 0;
    for (let i = 0; i < 5; i++) {
      const layerData = state.pitcherLayers[i];
      const layerRenderer = this.pitcherWaterLayers[i];
      
      if (!layerData || layerData.volume <= 0) {
        layerRenderer.mesh.visible = false;
        continue;
      }
      
      layerRenderer.mesh.visible = true;
      layerRenderer.material.color.copy(layerData.type === 'poison' ? this.colorPoison : this.colorWater);
      
      const bottomY = lowestWorldY + cumulativeVol * rangeY;
      cumulativeVol += layerData.volume;
      const topY = lowestWorldY + cumulativeVol * rangeY;
      
      // Top plane pointing down (-y), constant is topY
      layerRenderer.topPlane.constant = topY;
      // Bottom plane pointing up (+y), constant is -bottomY (because of normal direction)
      layerRenderer.bottomPlane.constant = -bottomY;
    }

    // Glass visual updates
    const totalGlass = state.glassCurrentVolume + state.glassPoisonVolume;
    const gVolRatio = Math.max(0.001, Math.min(1.0, totalGlass / Math.max(0.001, state.glassTargetVolume)));
    this.glassWater.scale.y = gVolRatio;
    this.glassWater.position.y = -0.19 + (0.38 * gVolRatio) / 2;
    
    // Tint glass based on poison ratio
    if (totalGlass > 0) {
       const poisonRatio = state.glassPoisonVolume / totalGlass;
       this.glassWaterMat.color.lerpColors(this.colorWater, this.colorPoison, poisonRatio);
    } else {
       this.glassWaterMat.color.copy(this.colorWater);
    }

    this.glass.scale.set(state.glassWidth / 0.3, 1, state.glassWidth / 0.3);
    this.glass.position.set(state.glassX, -1.0, 0);
    
    this.trash.scale.set(state.trashWidth / 0.3, 1, state.trashWidth / 0.3);
    this.trash.position.set(state.trashX, -1.0, 0);

    // Particles
    let activeCount = 0;
    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      this.dummy.position.set(p.x, p.y, 0);
      this.dummy.rotation.set(p.x * 10, p.y * 10, 0); // Spint
      this.dummy.updateMatrix();
      
      this.waterParticles.setMatrixAt(activeCount, this.dummy.matrix);
      this.waterParticles.setColorAt(activeCount, p.type === 'poison' ? this.colorPoison : this.colorWater);
      
      activeCount++;
    }
    this.waterParticles.count = activeCount;
    this.waterParticles.instanceMatrix.needsUpdate = true;
    if (this.waterParticles.instanceColor) this.waterParticles.instanceColor.needsUpdate = true;
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
