import { cpSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "node_modules/@mediapipe/tasks-vision/wasm");
const dest = resolve(root, "public/wasm");

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("✓ MediaPipe WASM files copied to public/wasm/");
