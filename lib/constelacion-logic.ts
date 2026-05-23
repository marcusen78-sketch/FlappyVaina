import * as THREE from "three";
import type { PinchResult } from "./pinch-detector";
import { getRandomConstellation, getCurveForSegment, type ConstellationDef } from "./constellations-pool";

export type GamePhase = "IDLE" | "CALIBRATING" | "OBSERVING" | "TRACING" | "RESULTS";

export interface CalibrationData {
  palmSize: number;
  pinchRange: { min: number; max: number };
}

export interface ConstelacionState {
  phase: GamePhase;
  constellation: ConstellationDef | null;
  observeProgress: number;
  currentStarIlluminated: number;
  tracingCurrentSegment: number;
  tracingAnchored: boolean;
  starsConnected: number;
  sequenceErrors: number;
  pinchInterruptions: number;
  elapsedMs: number;
  phaseElapsedMs: number;
  calibration: CalibrationData | null;
}

export interface ConstelacionMetrics {
  sessionId: string;
  timestamp: number;
  constellationId: string;
  sequenceCorrect: number;
  sequenceErrors: number;
  firstErrorPosition: number | null;
  pinchStabilityMean: number;
  pinchInterruptions: number;
  meanJerk: number;
  jerkPerSegment: number[];
  tremorPower: number;
  tremorPeakFreq: number;
  meanTrajectoryDeviation: number;
  maxTrajectoryDeviation: number;
  wristRotationRangeDeg: number;
  wristRotationSmoothness: number;
  distalActivationIndex: number;
  segmentTimeMeans: number[];
  segmentTimeStd: number;
  totalDurationMs: number;
  completionRate: number;
  calibration: CalibrationData;
}

interface FrameSample {
  t: number;
  pos: THREE.Vector3;
  pinchDist: number;
  distalRatios: number[];
  wristAngleDeg: number;
}

const CALIBRATION_DURATION = 5000;
const OBSERVE_STAR_DURATION = 1800;
const OBSERVE_GAP_DURATION = 600;
const TRACING_DURATION = 60000;
const STAR_RADIUS = 0.25;

export class ConstelacionEngine {
  private state: ConstelacionState;
  private calibSamples: { palmSizes: number[]; pinchDists: number[] } = { palmSizes: [], pinchDists: [] };
  private frameSamples: FrameSample[] = [];
  private segmentStartTime = 0;
  private segmentTimes: number[] = [];
  private jerkPerSegment: number[] = [];
  private currentSegmentJerkAccum = 0;
  private currentSegmentJerkCount = 0;
  private posBuffer: { t: number; x: number; y: number; z: number }[] = [];
  private deviationAccum = 0;
  private deviationCount = 0;
  private maxDeviation = 0;
  private pinchDistSamples: number[] = [];
  private distalSamples: number[] = [];
  private wristAngles: number[] = [];
  private firstErrorPos: number | null = null;
  private wasTracingActive = false;
  private tracingStartTime = 0;

  constructor() {
    this.state = {
      phase: "IDLE",
      constellation: null,
      observeProgress: 0,
      currentStarIlluminated: -1,
      tracingCurrentSegment: 0,
      tracingAnchored: false,
      starsConnected: 0,
      sequenceErrors: 0,
      pinchInterruptions: 0,
      elapsedMs: 0,
      phaseElapsedMs: 0,
      calibration: null,
    };
  }

  getState(): ConstelacionState {
    return { ...this.state, tracingAnchored: this.tracingAnchored };
  }

  startCalibration(): void {
    this.state.phase = "CALIBRATING";
    this.state.phaseElapsedMs = 0;
    this.calibSamples = { palmSizes: [], pinchDists: [] };
  }

  update(
    pinch: PinchResult | null,
    landmarks: { x: number; y: number; z: number }[] | null,
    deltaMs: number
  ): ConstelacionState {
    this.state.elapsedMs += deltaMs;
    this.state.phaseElapsedMs += deltaMs;

    switch (this.state.phase) {
      case "IDLE":
        if (landmarks && landmarks.length >= 21) {
          this.startCalibration();
        }
        break;

      case "CALIBRATING":
        this.updateCalibration(landmarks, pinch);
        break;

      case "OBSERVING":
        this.updateObserving();
        break;

      case "TRACING":
        this.updateTracing(pinch, landmarks);
        break;

      case "RESULTS":
        break;
    }

    return this.getState();
  }

  private updateCalibration(
    landmarks: { x: number; y: number; z: number }[] | null,
    pinch: PinchResult | null
  ): void {
    if (landmarks && landmarks.length >= 21) {
      const wrist = landmarks[0];
      const middleMcp = landmarks[9];
      const palmSize = Math.sqrt(
        (wrist.x - middleMcp.x) ** 2 +
        (wrist.y - middleMcp.y) ** 2 +
        (wrist.z - middleMcp.z) ** 2
      );
      this.calibSamples.palmSizes.push(palmSize);

      if (pinch) {
        this.calibSamples.pinchDists.push(pinch.distance);
      }
    }

    if (this.state.phaseElapsedMs >= CALIBRATION_DURATION) {
      const palmSizes = this.calibSamples.palmSizes;
      const pinchDists = this.calibSamples.pinchDists;

      const avgPalm = palmSizes.length > 0
        ? palmSizes.reduce((a, b) => a + b, 0) / palmSizes.length
        : 0.5;

      let minPinch = 0.02;
      let maxPinch = 0.2;
      if (pinchDists.length > 0) {
        minPinch = Math.min(...pinchDists);
        maxPinch = Math.max(...pinchDists);
      }

      this.state.calibration = {
        palmSize: avgPalm,
        pinchRange: { min: minPinch, max: maxPinch },
      };

      this.state.constellation = getRandomConstellation();
      this.state.phase = "OBSERVING";
      this.state.phaseElapsedMs = 0;
      this.state.currentStarIlluminated = -1;
    }
  }

  private updateObserving(): void {
    const totalObserveDuration = 5 * OBSERVE_STAR_DURATION + 4 * OBSERVE_GAP_DURATION;
    this.state.observeProgress = Math.min(1, this.state.phaseElapsedMs / totalObserveDuration);

    const cycleTime = OBSERVE_STAR_DURATION + OBSERVE_GAP_DURATION;
    const currentCycle = Math.floor(this.state.phaseElapsedMs / cycleTime);
    const withinCycle = this.state.phaseElapsedMs % cycleTime;

    if (currentCycle < 5 && withinCycle < OBSERVE_STAR_DURATION) {
      this.state.currentStarIlluminated = currentCycle;
    } else {
      this.state.currentStarIlluminated = -1;
    }

    if (this.state.phaseElapsedMs >= totalObserveDuration) {
      this.state.phase = "TRACING";
      this.state.phaseElapsedMs = 0;
      this.state.currentStarIlluminated = -1;
      this.state.tracingCurrentSegment = 0;
      this.state.starsConnected = 0;
      this.segmentStartTime = this.state.elapsedMs;
      this.tracingStartTime = this.state.elapsedMs;
      this.wasTracingActive = false;
    }
  }

  // Tracing sub-state: whether the player has anchored on the origin star
  private tracingAnchored = false;

  private updateTracing(
    pinch: PinchResult | null,
    landmarks: { x: number; y: number; z: number }[] | null
  ): void {
    if (this.state.phaseElapsedMs >= TRACING_DURATION || this.state.starsConnected >= 4) {
      this.finishTracing();
      return;
    }

    if (!pinch || !landmarks || landmarks.length < 21) return;

    const cursorPos = new THREE.Vector3(
      pinch.position.x,
      pinch.position.y,
      pinch.position.z
    );

    // Record frame sample for metrics
    const wristAngle = this.computeWristAngle(landmarks);
    const distalRatios = this.computeDistalRatios(landmarks);
    this.frameSamples.push({
      t: this.state.elapsedMs,
      pos: cursorPos.clone(),
      pinchDist: pinch.distance,
      distalRatios,
      wristAngleDeg: wristAngle,
    });

    const c = this.state.constellation;
    if (!c) return;
    const segIdx = this.state.tracingCurrentSegment;
    if (segIdx >= c.segments.length) return;

    const originStarIdx = c.segments[segIdx].from;
    const targetStarIdx = c.segments[segIdx].to;
    const originPos = c.stars[originStarIdx].position;
    const targetPos = c.stars[targetStarIdx].position;

    if (pinch.state === "pinching") {
      const distToOrigin = this.dist2DXY(cursorPos, originPos);
      const distToTarget = this.dist2DXY(cursorPos, targetPos);

      if (!this.tracingAnchored) {
        // Must start pinch inside the origin star to begin tracing
        if (distToOrigin < STAR_RADIUS) {
          this.tracingAnchored = true;
          this.wasTracingActive = true;
        }
      }

      if (this.tracingAnchored) {
        // Collect metrics while tracing
        this.pinchDistSamples.push(pinch.distance);
        this.distalSamples.push(...distalRatios);
        this.wristAngles.push(wristAngle);

        this.posBuffer.push({ t: this.state.elapsedMs, x: cursorPos.x, y: cursorPos.y, z: cursorPos.z });
        if (this.posBuffer.length > 60) this.posBuffer.shift();

        if (this.posBuffer.length >= 4) {
          const jerk = this.computeInstantJerk();
          this.currentSegmentJerkAccum += jerk;
          this.currentSegmentJerkCount++;
        }

        // Trajectory deviation from guide curve
        const curve = getCurveForSegment(c, segIdx);
        const deviation = this.distanceToCurve(cursorPos, curve);
        this.deviationAccum += deviation;
        this.deviationCount++;
        if (deviation > this.maxDeviation) this.maxDeviation = deviation;

        // Check if cursor reached target star
        if (distToTarget < STAR_RADIUS) {
          this.completeSegment();
          return;
        }

        // Check if touching a wrong star (error)
        for (let i = 0; i < c.stars.length; i++) {
          if (i === originStarIdx || i === targetStarIdx) continue;
          const d = this.dist2DXY(cursorPos, c.stars[i].position);
          if (d < STAR_RADIUS) {
            this.state.sequenceErrors++;
            if (this.firstErrorPos === null) {
              this.firstErrorPos = segIdx;
            }
            break;
          }
        }
      }
    } else {
      // Pinch released
      if (this.tracingAnchored && this.wasTracingActive) {
        this.state.pinchInterruptions++;
      }
      this.tracingAnchored = false;
      this.wasTracingActive = false;
    }
  }

  private completeSegment(): void {
    this.state.starsConnected++;
    const segTime = this.state.elapsedMs - this.segmentStartTime;
    this.segmentTimes.push(segTime);

    const segJerk = this.currentSegmentJerkCount > 0
      ? this.currentSegmentJerkAccum / this.currentSegmentJerkCount
      : 0;
    this.jerkPerSegment.push(segJerk);
    this.currentSegmentJerkAccum = 0;
    this.currentSegmentJerkCount = 0;

    this.state.tracingCurrentSegment++;
    this.segmentStartTime = this.state.elapsedMs;
    this.posBuffer = [];
    this.tracingAnchored = false;
    this.wasTracingActive = false;

    if (this.state.starsConnected >= 4) {
      this.finishTracing();
    }
  }

  private dist2DXY(a: THREE.Vector3, b: THREE.Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private computeInstantJerk(): number {
    const buf = this.posBuffer;
    const n = buf.length;
    if (n < 4) return 0;

    const p3 = buf[n - 1];
    const p2 = buf[n - 2];
    const p1 = buf[n - 3];
    const p0 = buf[n - 4];

    const dt = (p3.t - p0.t) / 3000; // in seconds
    if (dt < 0.001) return 0;

    const jx = (p3.x - 3 * p2.x + 3 * p1.x - p0.x) / (dt * dt * dt);
    const jy = (p3.y - 3 * p2.y + 3 * p1.y - p0.y) / (dt * dt * dt);
    const jz = (p3.z - 3 * p2.z + 3 * p1.z - p0.z) / (dt * dt * dt);

    return Math.sqrt(jx * jx + jy * jy + jz * jz);
  }

  private distanceToCurve(point: THREE.Vector3, curve: THREE.QuadraticBezierCurve3): number {
    let minDist = Infinity;
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = curve.getPoint(t);
      const d = point.distanceTo(p);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  private computeWristAngle(landmarks: { x: number; y: number; z: number }[]): number {
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    const dx = middleMcp.x - wrist.x;
    const dy = middleMcp.y - wrist.y;
    const angle = Math.atan2(dx, dy) * (180 / Math.PI);
    return angle;
  }

  private computeDistalRatios(landmarks: { x: number; y: number; z: number }[]): number[] {
    const palmSize = Math.sqrt(
      (landmarks[0].x - landmarks[9].x) ** 2 +
      (landmarks[0].y - landmarks[9].y) ** 2 +
      (landmarks[0].z - landmarks[9].z) ** 2
    );
    if (palmSize < 0.001) return [0, 0, 0];

    const tips = [12, 16, 20];
    const mcps = [9, 13, 17];
    const ratios: number[] = [];

    for (let i = 0; i < 3; i++) {
      const tip = landmarks[tips[i]];
      const mcp = landmarks[mcps[i]];
      const dist = Math.sqrt(
        (tip.x - mcp.x) ** 2 + (tip.y - mcp.y) ** 2 + (tip.z - mcp.z) ** 2
      );
      ratios.push(dist / palmSize);
    }
    return ratios;
  }

  private finishTracing(): void {
    this.state.phase = "RESULTS";
    const metrics = this.computeMetrics();
    console.log("ConstelacionMetrics:", metrics);
  }

  private computeMetrics(): ConstelacionMetrics {
    const pinchStd = this.computeStdDev(this.pinchDistSamples);

    const meanJerk = this.jerkPerSegment.length > 0
      ? this.jerkPerSegment.reduce((a, b) => a + b, 0) / this.jerkPerSegment.length
      : 0;

    const meanDev = this.deviationCount > 0 ? this.deviationAccum / this.deviationCount : 0;

    // Tremor: simplified spectral estimate from position residuals
    const { power, peakFreq } = this.estimateTremor();

    // Wrist rotation range and smoothness
    let wristRange = 0;
    let wristSmoothness = 0;
    if (this.wristAngles.length > 1) {
      wristRange = Math.max(...this.wristAngles) - Math.min(...this.wristAngles);
      // Angular jerk estimate
      const angularJerks: number[] = [];
      for (let i = 3; i < this.wristAngles.length; i++) {
        const j = this.wristAngles[i] - 3 * this.wristAngles[i - 1] + 3 * this.wristAngles[i - 2] - this.wristAngles[i - 3];
        angularJerks.push(Math.abs(j));
      }
      wristSmoothness = angularJerks.length > 0
        ? angularJerks.reduce((a, b) => a + b, 0) / angularJerks.length
        : 0;
    }

    // Distal activation
    const threshold = 0.5;
    let closedCount = 0;
    let totalSamples = 0;
    for (let i = 0; i < this.distalSamples.length; i += 3) {
      for (let j = 0; j < 3 && i + j < this.distalSamples.length; j++) {
        if (this.distalSamples[i + j] < threshold) closedCount++;
        totalSamples++;
      }
    }
    const distalActivation = totalSamples > 0 ? closedCount / totalSamples : 0;

    // Segment time stats
    const segTimeMean = this.segmentTimes.length > 0
      ? this.segmentTimes.reduce((a, b) => a + b, 0) / this.segmentTimes.length
      : 0;
    const segTimeStd = this.computeStdDev(this.segmentTimes);

    const totalDuration = this.state.elapsedMs - this.tracingStartTime;

    return {
      sessionId: crypto.randomUUID(),
      timestamp: Date.now(),
      constellationId: this.state.constellation?.id ?? "unknown",
      sequenceCorrect: this.state.starsConnected,
      sequenceErrors: this.state.sequenceErrors,
      firstErrorPosition: this.firstErrorPos,
      pinchStabilityMean: pinchStd,
      pinchInterruptions: this.state.pinchInterruptions,
      meanJerk,
      jerkPerSegment: this.jerkPerSegment,
      tremorPower: power,
      tremorPeakFreq: peakFreq,
      meanTrajectoryDeviation: meanDev,
      maxTrajectoryDeviation: this.maxDeviation,
      wristRotationRangeDeg: wristRange,
      wristRotationSmoothness: wristSmoothness,
      distalActivationIndex: distalActivation,
      segmentTimeMeans: this.segmentTimes,
      segmentTimeStd: segTimeStd,
      totalDurationMs: totalDuration,
      completionRate: (this.state.starsConnected + 1) / 5,
      calibration: this.state.calibration ?? { palmSize: 0, pinchRange: { min: 0, max: 0 } },
    };
  }

  private computeStdDev(arr: number[]): number {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
  }

  private estimateTremor(): { power: number; peakFreq: number } {
    // Simplified: compute power in 4-8Hz band from position residuals
    // We use the perpendicular deviation signal sampled during tracing
    const samples = this.frameSamples.filter(
      (s) => s.t >= this.tracingStartTime
    );

    if (samples.length < 64) return { power: 0, peakFreq: 0 };

    // Use last 128 samples for FFT-like analysis
    const window = samples.slice(-128);
    const dt = window.length > 1
      ? (window[window.length - 1].t - window[0].t) / (window.length - 1) / 1000
      : 1 / 30;
    const fs = 1 / dt;

    // Compute signal: magnitude of frame-to-frame displacement (high-pass proxy)
    const signal: number[] = [];
    for (let i = 1; i < window.length; i++) {
      const dx = window[i].pos.x - window[i - 1].pos.x;
      const dy = window[i].pos.y - window[i - 1].pos.y;
      signal.push(Math.sqrt(dx * dx + dy * dy));
    }

    // DFT for frequencies 4-8Hz
    const N = signal.length;
    let maxPower = 0;
    let peakFreq = 0;
    let totalPower = 0;

    for (let k = 0; k < N / 2; k++) {
      const freq = (k * fs) / N;
      if (freq < 3 || freq > 9) continue;

      let re = 0;
      let im = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        re += signal[n] * Math.cos(angle);
        im -= signal[n] * Math.sin(angle);
      }
      const power = (re * re + im * im) / N;
      totalPower += power;

      if (freq >= 4 && freq <= 8 && power > maxPower) {
        maxPower = power;
        peakFreq = freq;
      }
    }

    return { power: totalPower, peakFreq };
  }
}
