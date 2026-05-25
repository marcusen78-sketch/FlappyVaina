import { TelemetryFrame } from "./datalogger";

export interface FlappyMetrics {
  maxExtension: number; // Lowest fistStrength (closer to 0 is flat open hand)
  maxFlexion: number;   // Highest fistStrength (closer to 1+ is tightly closed fist)
  activationCount: number; // Intentional closures (crossings of threshold)
  fatigueIndex: number; // Diff in peak flexion (last 25% vs first 25% of the game)
  smoothnessJerk: number; // Derivative of acceleration of fistStrength
}

export interface WaterMetrics {
  maxSupination: number; // Max tilt left (positive)
  maxPronation: number;  // Max tilt right (negative)
  smoothnessJerk: number; // Jerk of pitcherRotationZ
  waterAccuracy: number; // Average percentage of target volume reached
  poisonError: number; // Total poison volume spilled into the glass
  averagePouringTime: number; // Average ms spent in pouring phase per round
}

export interface SlingshotMetrics {
  maxPinchOpen: number; // Max pinchRatio (open fingers)
  maxPullDistance: number; // Euclidean distance from anchor
  pullTremor: number; // Jerk of XY while pinched
  accuracyRatio: number; // Targets hit / Birds fired
}

export class BiomechanicsDSP {
  
  static processFlappyMetrics(frames: TelemetryFrame[]): FlappyMetrics {
    // Only analyze frames when the game is actually playing
    const activeFrames = frames.filter(f => f.phase === "playing" && f.fistStrength !== undefined);
    
    if (activeFrames.length < 10) {
      return {
        maxExtension: 0,
        maxFlexion: 0,
        activationCount: 0,
        fatigueIndex: 0,
        smoothnessJerk: 0
      };
    }

    const strengths = activeFrames.map(f => f.fistStrength!);
    
    // 1. ROM: Extension (Min Strength) and Flexion (Max Strength)
    const maxExtension = Math.min(...strengths);
    const maxFlexion = Math.max(...strengths);

    // 2. Activation Count (crossings of 0.5 threshold)
    let activationCount = 0;
    let isSqueezing = false;
    for (const s of strengths) {
      if (s > 0.5 && !isSqueezing) {
        activationCount++;
        isSqueezing = true;
      } else if (s < 0.4) {
        isSqueezing = false;
      }
    }

    // 3. Fatigue Index
    // Split into first 25% of game and last 25%
    const quarter = Math.max(1, Math.floor(strengths.length / 4));
    const firstQuarter = strengths.slice(0, quarter);
    const lastQuarter = strengths.slice(-quarter);
    
    const peakFirstQuarter = Math.max(...firstQuarter);
    const peakLastQuarter = Math.max(...lastQuarter);
    
    // Negative value indicates they got weaker
    const fatigueIndex = peakLastQuarter - peakFirstQuarter;

    // 4. Smoothness (Jerk approximation)
    // Jerk is the derivative of acceleration (third derivative of position).
    // Here we treat fistStrength as a 1D position variable.
    let totalJerk = 0;
    for (let i = 3; i < activeFrames.length; i++) {
      // dt in seconds
      const dt = (activeFrames[i].timestamp - activeFrames[i-1].timestamp) / 1000; 
      if (dt > 0.001) { // Prevent division by zero or microscopic dt noise
        // v = ds / dt
        const v1 = (strengths[i-2] - strengths[i-3]) / dt;
        const v2 = (strengths[i-1] - strengths[i-2]) / dt;
        const v3 = (strengths[i] - strengths[i-1]) / dt;
        
        // a = dv / dt
        const a1 = (v2 - v1) / dt;
        const a2 = (v3 - v2) / dt;
        
        // jerk = da / dt
        const jerk = (a2 - a1) / dt;
        totalJerk += Math.abs(jerk);
      }
    }
    
    // Average jerk over the session. Lower is smoother.
    const smoothnessJerk = totalJerk / activeFrames.length;

    return {
      maxExtension,
      maxFlexion,
      activationCount,
      fatigueIndex,
      smoothnessJerk
    };
  }

  static processWaterMetrics(frames: TelemetryFrame[]): WaterMetrics {
    const activeFrames = frames.filter(f => f.pitcherRotationZ !== undefined);
    
    if (activeFrames.length < 10) {
      return {
        maxSupination: 0,
        maxPronation: 0,
        smoothnessJerk: 0,
        waterAccuracy: 0,
        poisonError: 0,
        averagePouringTime: 0
      };
    }

    const rotations = activeFrames.map(f => f.pitcherRotationZ!);
    
    // 1. ROM: Max Supination (positive tilt) and Max Pronation (negative tilt)
    const maxSupination = Math.max(...rotations);
    const maxPronation = Math.min(...rotations);

    // 2. Smoothness (Jerk of pitcherRotationZ during pouring)
    const pouringFrames = activeFrames.filter(f => f.phase === "pouring");
    let totalJerk = 0;
    if (pouringFrames.length > 3) {
      for (let i = 3; i < pouringFrames.length; i++) {
        const dt = (pouringFrames[i].timestamp - pouringFrames[i-1].timestamp) / 1000;
        if (dt > 0.001) {
          const v1 = (pouringFrames[i-2].pitcherRotationZ! - pouringFrames[i-3].pitcherRotationZ!) / dt;
          const v2 = (pouringFrames[i-1].pitcherRotationZ! - pouringFrames[i-2].pitcherRotationZ!) / dt;
          const v3 = (pouringFrames[i].pitcherRotationZ! - pouringFrames[i-1].pitcherRotationZ!) / dt;
          
          const a1 = (v2 - v1) / dt;
          const a2 = (v3 - v2) / dt;
          
          const jerk = (a2 - a1) / dt;
          totalJerk += Math.abs(jerk);
        }
      }
    }
    const smoothnessJerk = pouringFrames.length > 0 ? totalJerk / pouringFrames.length : 0;

    // 3. Accuracy & Error
    let totalWaterAccuracy = 0;
    let totalPoisonError = 0;
    const rounds = new Set(activeFrames.map(f => f.round).filter(r => r !== undefined));
    let totalPouringTime = 0;

    rounds.forEach(roundNum => {
      // Get frames for this specific round
      const roundFrames = activeFrames.filter(f => f.round === roundNum);
      if (roundFrames.length === 0) return;

      // Accuracy: Look at the very last frame of this round to see final volumes
      const lastFrame = roundFrames[roundFrames.length - 1];
      const target = lastFrame.glassTargetVolume || 1;
      const current = lastFrame.glassCurrentVolume || 0;
      const poison = lastFrame.glassPoisonVolume || 0;

      // Accuracy is percentage filled, capped at 100%
      const accuracy = Math.min(1.0, current / target);
      totalWaterAccuracy += accuracy;
      totalPoisonError += poison;

      // Pouring time for this round
      const roundPouringFrames = roundFrames.filter(f => f.phase === "pouring");
      if (roundPouringFrames.length > 1) {
        const pTime = roundPouringFrames[roundPouringFrames.length - 1].timestamp - roundPouringFrames[0].timestamp;
        totalPouringTime += pTime;
      }
    });

    const numRounds = rounds.size || 1;
    
    return {
      maxSupination,
      maxPronation,
      smoothnessJerk,
      waterAccuracy: totalWaterAccuracy / numRounds,
      poisonError: totalPoisonError,
      averagePouringTime: totalPouringTime / numRounds
    };
  }

  static processSlingshotMetrics(frames: TelemetryFrame[]): SlingshotMetrics {
    const activeFrames = frames.filter(f => f.pinchRatio !== undefined);
    
    if (activeFrames.length < 10) {
      return { maxPinchOpen: 0, maxPullDistance: 0, pullTremor: 0, accuracyRatio: 0 };
    }

    // 1. Pinch ROM
    const maxPinchOpen = Math.max(...activeFrames.map(f => f.pinchRatio!));

    // 2. Max Pull Distance
    const ANCHOR_X = 450;
    const ANCHOR_Y = 520;
    
    let maxPullDistance = 0;
    const pinchedFrames = activeFrames.filter(f => f.isPinching && f.pullX !== undefined && f.pullY !== undefined);
    
    pinchedFrames.forEach(f => {
      const dist = Math.hypot(f.pullX! - ANCHOR_X, f.pullY! - ANCHOR_Y);
      if (dist > maxPullDistance) maxPullDistance = dist;
    });

    // 3. Pull Tremor (Stability while aiming)
    let totalTremor = 0;
    if (pinchedFrames.length > 3) {
      for (let i = 3; i < pinchedFrames.length; i++) {
        const dt = (pinchedFrames[i].timestamp - pinchedFrames[i-1].timestamp) / 1000;
        if (dt > 0.001) {
          const vx1 = (pinchedFrames[i-2].pullX! - pinchedFrames[i-3].pullX!) / dt;
          const vy1 = (pinchedFrames[i-2].pullY! - pinchedFrames[i-3].pullY!) / dt;
          
          const vx2 = (pinchedFrames[i-1].pullX! - pinchedFrames[i-2].pullX!) / dt;
          const vy2 = (pinchedFrames[i-1].pullY! - pinchedFrames[i-2].pullY!) / dt;

          const vx3 = (pinchedFrames[i].pullX! - pinchedFrames[i-1].pullX!) / dt;
          const vy3 = (pinchedFrames[i].pullY! - pinchedFrames[i-1].pullY!) / dt;

          const ax1 = (vx2 - vx1) / dt;
          const ay1 = (vy2 - vy1) / dt;
          
          const ax2 = (vx3 - vx2) / dt;
          const ay2 = (vy3 - vy2) / dt;

          const jx = (ax2 - ax1) / dt;
          const jy = (ay2 - ay1) / dt;
          
          totalTremor += Math.hypot(jx, jy);
        }
      }
    }
    const pullTremor = pinchedFrames.length > 0 ? totalTremor / pinchedFrames.length : 0;

    // 4. Accuracy
    const lastFrame = activeFrames[activeFrames.length - 1];
    const score = lastFrame.score || 0;
    const birdsLeft = lastFrame.birdsLeft === undefined ? 5 : lastFrame.birdsLeft;
    const fired = 5 - birdsLeft;
    
    const accuracyRatio = fired > 0 ? Math.min(1.0, score / fired) : 0;

    return {
      maxPinchOpen,
      maxPullDistance,
      pullTremor,
      accuracyRatio
    };
  }
}
