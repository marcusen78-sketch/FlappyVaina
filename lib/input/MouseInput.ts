import { InputProvider, InputEvent } from './types';

export class MouseInputProvider implements InputProvider {
  private canvas: HTMLCanvasElement | null = null;
  private subscribers: Set<(e: InputEvent) => void> = new Set();
  
  private boundDown: (e: MouseEvent) => void;
  private boundMove: (e: MouseEvent) => void;
  private boundUp: (e: MouseEvent) => void;

  private isDown = false;
  private readonly WORLD_W = 1280;
  private readonly WORLD_H = 720;

  constructor() {
    this.boundDown = this.onMouseDown.bind(this);
    this.boundMove = this.onMouseMove.bind(this);
    this.boundUp = this.onMouseUp.bind(this);
  }

  start(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.canvas.addEventListener('mousedown', this.boundDown);
    this.canvas.addEventListener('mousemove', this.boundMove);
    window.addEventListener('mouseup', this.boundUp);
  }

  stop(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.boundDown);
      this.canvas.removeEventListener('mousemove', this.boundMove);
    }
    window.removeEventListener('mouseup', this.boundUp);
    this.canvas = null;
    this.isDown = false;
  }

  subscribe(cb: (e: InputEvent) => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private toWorld(e: MouseEvent): { x: number; y: number } {
    if (!this.canvas) return { x: 0, y: 0 };
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.WORLD_W / rect.width;
    const scaleY = this.WORLD_H / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  private emit(type: "down" | "move" | "up", e: MouseEvent) {
    const { x, y } = this.toWorld(e);
    const event: InputEvent = {
      type,
      x,
      y,
      timestamp: performance.now(),
    };
    this.subscribers.forEach(cb => cb(event));
  }

  private onMouseDown(e: MouseEvent) {
    this.isDown = true;
    this.emit('down', e);
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isDown) return;
    this.emit('move', e);
  }

  private onMouseUp(e: MouseEvent) {
    if (!this.isDown) return;
    this.isDown = false;
    this.emit('up', e);
  }
}

