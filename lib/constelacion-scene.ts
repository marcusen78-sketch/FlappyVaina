import * as THREE from "three";
import type { ConstelacionState } from "./constelacion-logic";
import { getCurveForSegment, type ConstellationDef } from "./constellations-pool";

export class ConstelacionSceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private starMeshes: THREE.Mesh[] = [];
  private starBaseMat: THREE.MeshStandardMaterial;
  private starLitMat: THREE.MeshStandardMaterial;
  private numberSprites: THREE.Sprite[] = [];
  private guideTubes: THREE.Mesh[] = [];
  private activeTube: THREE.Mesh | null = null;
  private completedTubes: THREE.Mesh[] = [];
  private cursorMesh: THREE.Mesh;
  private constellation: ConstellationDef | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    // Transparent background — pixel art sky shows through from CSS behind canvas
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 0.1, 3.2);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLighting();

    this.starBaseMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.5,
      metalness: 0.3,
      flatShading: true,
      emissive: 0x94a3b8,
      emissiveIntensity: 0.3,
    });

    this.starLitMat = new THREE.MeshStandardMaterial({
      color: 0xe0e7ff,
      roughness: 0.4,
      metalness: 0.4,
      flatShading: true,
      emissive: 0x6366f1,
      emissiveIntensity: 1.0,
    });

    const cursorGeom = new THREE.SphereGeometry(0.05, 12, 12);
    const cursorMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      emissive: 0x6366f1,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.4,
    });
    this.cursorMesh = new THREE.Mesh(cursorGeom, cursorMat);
    this.cursorMesh.visible = false;
    this.scene.add(this.cursorMesh);
  }

  private setupLighting(): void {
    const hemi = new THREE.HemisphereLight(0xffffff, 0xb8ccd9, 1.2);
    hemi.position.set(0, 20, 0);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xfff8f0, 0.9);
    dir.position.set(5, 8, 4);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 1024;
    dir.shadow.mapSize.height = 1024;
    this.scene.add(dir);
  }


  setupConstellation(constellation: ConstellationDef): void {
    this.clearConstellation();
    this.constellation = constellation;

    const starGeom = this.createStarGeometry();

    for (let i = 0; i < constellation.stars.length; i++) {
      const star = constellation.stars[i];
      const mesh = new THREE.Mesh(starGeom, this.starBaseMat.clone());
      mesh.position.copy(star.position);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.starMeshes.push(mesh);
    }
  }

  private createStarGeometry(): THREE.BufferGeometry {
    // 4-pointed star with front/back depth
    const r = 0.09;
    const inner = 0.035;
    const depth = 0.04;
    const points = 4;
    const vertices: number[] = [];
    const indices: number[] = [];

    // Front center vertex = 0
    vertices.push(0, 0, depth);
    // Back center vertex = 1
    vertices.push(0, 0, -depth);

    // Ring vertices: alternating outer/inner, starting at index 2
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const radius = i % 2 === 0 ? r : inner;
      vertices.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    }

    const ringStart = 2;
    const ringCount = points * 2;
    for (let i = 0; i < ringCount; i++) {
      const curr = ringStart + i;
      const next = ringStart + ((i + 1) % ringCount);
      // Front face
      indices.push(0, curr, next);
      // Back face
      indices.push(1, next, curr);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  showStarNumbers(order: number[]): void {
    this.clearNumberSprites();
    for (let i = 0; i < order.length; i++) {
      const starIdx = order[i];
      const pos = this.starMeshes[starIdx].position;
      const sprite = this.createNumberSprite(i + 1);
      sprite.position.set(pos.x, pos.y + 0.18, pos.z);
      sprite.scale.set(0.15, 0.15, 1);
      this.scene.add(sprite);
      this.numberSprites.push(sprite);
    }
  }

  hideStarNumbers(): void {
    this.clearNumberSprites();
  }

  showGuideCurves(constellation: ConstellationDef): void {
    this.clearGuideTubes();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.3,
      roughness: 0.9,
    });

    for (let i = 0; i < constellation.segments.length; i++) {
      const curve = getCurveForSegment(constellation, i);
      const points = curve.getPoints(30);
      const catmull = new THREE.CatmullRomCurve3(points);
      const tubeGeom = new THREE.TubeGeometry(catmull, 20, 0.02, 6, false);
      const tube = new THREE.Mesh(tubeGeom, mat);
      this.scene.add(tube);
      this.guideTubes.push(tube);
    }
  }

  illuminateStar(index: number): void {
    for (let i = 0; i < this.starMeshes.length; i++) {
      const mesh = this.starMeshes[i];
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (i === index) {
        mat.emissive.set(0x6366f1);
        mat.emissiveIntensity = 0.8;
        mesh.scale.setScalar(1.15);
      } else {
        mat.emissive.set(0x000000);
        mat.emissiveIntensity = 0;
        mesh.scale.setScalar(1.0);
      }
    }
  }

  resetStarVisuals(): void {
    for (const mesh of this.starMeshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.set(0x000000);
      mat.emissiveIntensity = 0;
      mesh.scale.setScalar(1.0);
    }
  }

  updateCursor(position: { x: number; y: number; z: number }, visible: boolean, isPinching = false): void {
    this.cursorMesh.visible = visible;
    if (visible) {
      this.cursorMesh.position.set(position.x, position.y, position.z);
      const mat = this.cursorMesh.material as THREE.MeshStandardMaterial;
      if (isPinching) {
        mat.color.set(0x22c55e);
        mat.emissive.set(0x22c55e);
        this.cursorMesh.scale.setScalar(1.4);
      } else {
        mat.color.set(0x6366f1);
        mat.emissive.set(0x6366f1);
        this.cursorMesh.scale.setScalar(1.0);
      }
    }
  }

  updateActiveTube(points: THREE.Vector3[]): void {
    if (this.activeTube) {
      this.scene.remove(this.activeTube);
      this.activeTube.geometry.dispose();
      this.activeTube = null;
    }

    if (points.length < 2) return;

    const curve = new THREE.CatmullRomCurve3(points);
    const geom = new THREE.TubeGeometry(curve, Math.max(4, points.length * 2), 0.04, 8, false);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.7,
      roughness: 0.4,
      metalness: 0.2,
      emissive: 0x6366f1,
      emissiveIntensity: 0.2,
    });
    this.activeTube = new THREE.Mesh(geom, mat);
    this.scene.add(this.activeTube);
  }

  completeSegment(points: THREE.Vector3[]): void {
    if (this.activeTube) {
      this.scene.remove(this.activeTube);
      this.activeTube.geometry.dispose();
      this.activeTube = null;
    }

    if (points.length < 2) return;

    const curve = new THREE.CatmullRomCurve3(points);
    const geom = new THREE.TubeGeometry(curve, Math.max(4, points.length * 2), 0.04, 8, false);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.85,
      roughness: 0.4,
      metalness: 0.3,
      emissive: 0x6366f1,
      emissiveIntensity: 0.3,
    });
    const tube = new THREE.Mesh(geom, mat);
    this.scene.add(tube);
    this.completedTubes.push(tube);
  }

  markStarConnected(starIndex: number): void {
    if (starIndex >= 0 && starIndex < this.starMeshes.length) {
      const mat = this.starMeshes[starIndex].material as THREE.MeshStandardMaterial;
      mat.emissive.set(0x6366f1);
      mat.emissiveIntensity = 0.5;
      mat.color.set(0x6366f1);
    }
  }

  update(state: ConstelacionState, _deltaTime: number): void {
    if (state.phase === "OBSERVING" && state.currentStarIlluminated >= 0 && this.constellation) {
      const starIdx = this.constellation.order[state.currentStarIlluminated];
      this.illuminateStar(starIdx);
    } else if (state.phase === "OBSERVING" && state.currentStarIlluminated < 0) {
      this.resetStarVisuals();
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose(): void {
    this.clearConstellation();
    this.renderer.dispose();
  }

  private clearConstellation(): void {
    for (const mesh of this.starMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.starMeshes = [];
    this.clearNumberSprites();
    this.clearGuideTubes();
    this.clearTubes();
  }

  private clearNumberSprites(): void {
    for (const sprite of this.numberSprites) {
      this.scene.remove(sprite);
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
    this.numberSprites = [];
  }

  private clearGuideTubes(): void {
    for (const tube of this.guideTubes) {
      this.scene.remove(tube);
      tube.geometry.dispose();
      (tube.material as THREE.Material).dispose();
    }
    this.guideTubes = [];
  }

  private clearTubes(): void {
    if (this.activeTube) {
      this.scene.remove(this.activeTube);
      this.activeTube.geometry.dispose();
      this.activeTube = null;
    }
    for (const tube of this.completedTubes) {
      this.scene.remove(tube);
      tube.geometry.dispose();
      (tube.material as THREE.Material).dispose();
    }
    this.completedTubes = [];
  }

  private createNumberSprite(num: number): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 64, 64);
    ctx.font = "bold 40px sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(num), 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    return new THREE.Sprite(mat);
  }
}
