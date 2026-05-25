export interface TelemetryFrame {
  timestamp: number;
  phase: string;
  fistStrength?: number; // Flappy
  pitcherRotationZ?: number; // Water
  glassCurrentVolume?: number; // Water
  glassTargetVolume?: number; // Water
  glassPoisonVolume?: number; // Water
  round?: number; // Water
  pullX?: number; // Slingshot
  pullY?: number; // Slingshot
  isPinching?: boolean; // Slingshot
  pinchRatio?: number; // Slingshot
  score?: number; // Slingshot
  birdsLeft?: number; // Slingshot
}

export class SessionLogger {
  private frames: TelemetryFrame[] = [];
  private isRecording: boolean = false;
  private startTime: number = 0;

  start() {
    this.frames = [];
    this.isRecording = true;
    this.startTime = performance.now();
    console.log("Telemetry recording started");
  }

  logFrame(phase: string, metrics: Partial<TelemetryFrame>) {
    if (!this.isRecording) return;
    
    this.frames.push({
      timestamp: performance.now() - this.startTime,
      phase,
      ...metrics
    });
  }

  stop(): TelemetryFrame[] {
    this.isRecording = false;
    console.log(`Telemetry recording stopped. Captured ${this.frames.length} frames.`);
    return this.frames;
  }
}
