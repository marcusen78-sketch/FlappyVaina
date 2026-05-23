"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const FINGERTIPS = [4, 8, 12, 16, 20];
const PALM_INDICES = [0, 1, 5, 9, 13, 17];

function getJointRadius(i: number): number {
  if (i === 0) return 0.038;
  if (FINGERTIPS.includes(i)) return 0.022;
  return 0.028;
}

function getBoneRadius(a: number, b: number): number {
  const distal = [3, 4, 7, 8, 11, 12, 15, 16, 19, 20];
  if (distal.includes(a) || distal.includes(b)) return 0.016;
  return 0.022;
}

interface HandMeshes {
  group: THREE.Group;
  joints: THREE.Mesh[];
  bones: THREE.Mesh[];
  palm: THREE.Mesh;
}

export default function HandTracker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Cargando modelo de manos...");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    let disposed = false;

    // Three.js setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      50
    );
    camera.position.set(0, 0, 4.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(3, 5, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xeeeeff, 0.3);
    fillLight.position.set(-3, 2, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffeedd, 0.4);
    rimLight.position.set(0, -2, -3);
    scene.add(rimLight);

    // Materials
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf5c6a0,
      roughness: 0.55,
      metalness: 0.02,
    });

    const skinMatDark = new THREE.MeshStandardMaterial({
      color: 0xe8b090,
      roughness: 0.5,
      metalness: 0.02,
    });

    // Create hand meshes
    function createHandMeshes(): HandMeshes {
      const group = new THREE.Group();

      const joints: THREE.Mesh[] = [];
      for (let i = 0; i < 21; i++) {
        const geo = new THREE.SphereGeometry(getJointRadius(i), 24, 24);
        const mesh = new THREE.Mesh(geo, skinMat);
        group.add(mesh);
        joints.push(mesh);
      }

      const bones: THREE.Mesh[] = [];
      for (let i = 0; i < CONNECTIONS.length; i++) {
        const [a, b] = CONNECTIONS[i];
        const r = getBoneRadius(a, b);
        const geo = new THREE.CylinderGeometry(r, r * 0.9, 1, 16);
        const mesh = new THREE.Mesh(geo, skinMat);
        group.add(mesh);
        bones.push(mesh);
      }

      const palmGeo = new THREE.SphereGeometry(0.12, 24, 24);
      palmGeo.scale(1, 0.3, 0.8);
      const palm = new THREE.Mesh(palmGeo, skinMatDark);
      group.add(palm);

      group.visible = false;
      scene.add(group);
      return { group, joints, bones, palm };
    }

    const handMeshes: HandMeshes[] = [createHandMeshes(), createHandMeshes()];

    // Vectors for bone orientation
    const _a = new THREE.Vector3();
    const _b = new THREE.Vector3();
    const _dir = new THREE.Vector3();
    const _yAxis = new THREE.Vector3(0, 1, 0);

    function mapLandmark(
      lm: { x: number; y: number; z: number },
      out: THREE.Vector3
    ) {
      out.x = (lm.x - 0.5) * 5;
      out.y = -(lm.y - 0.5) * 4;
      out.z = -lm.z * 4;
    }

    function updateHand(
      hand: HandMeshes,
      landmarks: { x: number; y: number; z: number }[]
    ) {
      hand.group.visible = true;

      for (let i = 0; i < 21; i++) {
        mapLandmark(landmarks[i], hand.joints[i].position);
      }

      for (let i = 0; i < CONNECTIONS.length; i++) {
        const [aIdx, bIdx] = CONNECTIONS[i];
        _a.copy(hand.joints[aIdx].position);
        _b.copy(hand.joints[bIdx].position);

        const bone = hand.bones[i];
        bone.position.copy(_a).add(_b).multiplyScalar(0.5);

        _dir.subVectors(_b, _a);
        const len = _dir.length();
        bone.scale.set(1, len, 1);
        bone.quaternion.setFromUnitVectors(_yAxis, _dir.normalize());
      }

      const palmPos = hand.palm.position;
      palmPos.set(0, 0, 0);
      for (const idx of PALM_INDICES) {
        palmPos.add(hand.joints[idx].position);
      }
      palmPos.multiplyScalar(1 / PALM_INDICES.length);
    }

    // Render loop
    let animId: number;
    function animate() {
      if (disposed) return;
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    // Resize
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", onResize);

    // MediaPipe + webcam
    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");
    video.muted = true;

    let lastVideoTime = -1;
    let results: ReturnType<HandLandmarker["detectForVideo"]> | null = null;

    async function startDetection() {
      setStatus("Cargando modelo de manos...");

      const vision = await FilesetResolver.forVisionTasks("/wasm");

      setStatus("Inicializando detector...");

      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      setStatus("Solicitando cámara...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });

      video.srcObject = stream;
      await new Promise<void>((r) =>
        video.addEventListener("loadeddata", () => r(), { once: true })
      );

      setReady(true);

      function detect() {
        if (disposed) return;
        const now = performance.now();

        if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
          lastVideoTime = video.currentTime;
          results = handLandmarker.detectForVideo(video, now);
        }

        handMeshes.forEach((h) => (h.group.visible = false));

        if (results && results.landmarks && results.landmarks.length > 0) {
          const count = Math.min(results.landmarks.length, 2);
          for (let i = 0; i < count; i++) {
            updateHand(handMeshes[i], results.landmarks[i]);
          }
        }

        requestAnimationFrame(detect);
      }

      detect();
    }

    startDetection().catch((err) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("HandTracker error:", err);
      setStatus("Error: " + msg);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="relative w-screen h-screen bg-white">
      <canvas ref={canvasRef} className="block w-full h-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <p className="text-gray-400 text-lg">{status}</p>
        </div>
      )}
    </div>
  );
}
