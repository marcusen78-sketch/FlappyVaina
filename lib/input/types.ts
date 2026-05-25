export type InputEventType = "down" | "move" | "up";
export interface InputEvent {
  type: InputEventType;
  x: number;        // in CSS pixels relative to canvas top-left
  y: number;
  pressure?: number; // 0..1, optional; mouse leaves this undefined
  timestamp: number; // performance.now()
}
export interface InputProvider {
  start(canvas: HTMLCanvasElement): void;
  stop(): void;
  subscribe(cb: (e: InputEvent) => void): () => void; // returns unsubscribe
}
