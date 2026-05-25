export type WaterPhase = "ready" | "waiting" | "filling" | "pouring" | "sliding" | "success";
export type LiquidType = "water" | "poison";

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  type: LiquidType;
}

export interface LiquidLayer {
  type: LiquidType;
  volume: number;
}

export interface WaterState {
  phase: WaterPhase;
  score: number;
  pitcherLayers: LiquidLayer[];
  fillingPlan: LiquidLayer[];
  fillingIndex: number;
  glassTargetVolume: number;
  glassCurrentVolume: number;
  glassPoisonVolume: number;
  totalPoisonInRound: number;
  glassWidth: number;
  glassX: number;
  trashWidth: number;
  trashX: number;
  particles: Particle[];
  stabilityTimer: number;
  round: number;
  waitingTimer: number;
  lastRoundResult: 'success' | 'fail' | null;
}

export class WaterEngine {
  public state: WaterState;
  
  private particlesPool: Particle[] = [];
  private nextParticleId = 0;
  
  // Physics constants
  private readonly gravity = 4.0;
  private readonly maxParticles = 400;
  private readonly emitRate = 0.05; // seconds per particle
  private emitTimer = 0;

  constructor() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particlesPool.push({ id: i, x: 0, y: 0, vx: 0, vy: 0, active: false, type: "water" });
    }

    this.state = {
      phase: "ready",
      score: 0,
      pitcherLayers: [],
      fillingPlan: [],
      fillingIndex: 0,
      glassTargetVolume: 0.5,
      glassCurrentVolume: 0,
      glassPoisonVolume: 0,
      totalPoisonInRound: 0.3,
      glassWidth: 0.3,
      glassX: -0.8,
      trashWidth: 0.3,
      trashX: 0.8,
      particles: [],
      stabilityTimer: 0,
      round: 1,
      waitingTimer: 0,
      lastRoundResult: null
    };
  }

  startLevel() {
    this.state.score = 0;
    this.state.round = 1;
    this.startRound();
  }

  private generateLayers(): LiquidLayer[] {
    const poisonVolume = 0.2 + Math.random() * 0.1; // Exactly 20-30% dirty water
    const waterVolume1 = 0.2 + Math.random() * 0.3; 
    const waterVolume2 = 1.0 - poisonVolume - waterVolume1;
    
    // Always 3 layers, exactly 1 poison layer, randomly ordered
    const plan: LiquidLayer[] = [
      { type: 'water', volume: waterVolume1 },
      { type: 'poison', volume: poisonVolume },
      { type: 'water', volume: waterVolume2 }
    ];
    
    // Simple shuffle so poison can be anywhere
    for (let i = plan.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [plan[i], plan[j]] = [plan[j], plan[i]];
    }
    
    return plan;
  }

  startRound() {
    this.state.phase = "waiting";
    this.state.waitingTimer = 2.0;
    this.state.pitcherLayers = [];
    
    const plan = this.generateLayers();
    this.state.fillingPlan = plan;
    this.state.fillingIndex = 0;
    this.state.totalPoisonInRound = plan.filter(l => l.type === 'poison').reduce((acc, l) => acc + l.volume, 0);

    // Clinical requirement: Glass fits exactly the clean water amount
    this.state.glassTargetVolume = 1.0 - this.state.totalPoisonInRound;

    this.state.glassCurrentVolume = 0;
    this.state.glassPoisonVolume = 0;
    this.state.glassWidth = 0.25;
    this.state.glassX = -0.8;
    
    this.state.trashWidth = 0.6; // Wider sink
    this.state.trashX = 0.8;
    
    this.state.stabilityTimer = 0;
    this.state.lastRoundResult = null;
    this.deactivateAllParticles();
  }

  getTotalPitcherVolume(): number {
    return this.state.pitcherLayers.reduce((acc, layer) => acc + layer.volume, 0);
  }

  update(pitcherRotationZ: number, deltaTime: number): WaterState {
    if (this.state.phase === "ready" || this.state.phase === "success") {
      return this.getState();
    }

    this.emitTimer -= deltaTime;

    // Phase 0: Waiting for user to be ready
    if (this.state.phase === "waiting") {
      this.state.waitingTimer -= deltaTime;
      if (this.state.waitingTimer <= 0) {
        this.state.phase = "filling";
      }
      return this.getState();
    }

    // Phase 1: Filling from Tap
    if (this.state.phase === "filling") {
      const currentPlanLayer = this.state.fillingPlan[this.state.fillingIndex];
      
      // Tap emits from top center
      if (this.emitTimer <= 0 && currentPlanLayer) {
        this.emitParticle(0, 1.2, (Math.random() - 0.5) * 0.2, -1.0, currentPlanLayer.type);
        this.emitTimer = this.emitRate;
      }

      // Check if pitcher is upright to catch (generous ~45 degree allowance)
      const isUpright = Math.abs(pitcherRotationZ) < 0.8;

      this.updateParticles(deltaTime, (p) => {
        // Transform particle to Pitcher's local space
        const dx = p.x - (-0.1);
        const dy = p.y - 0.5;
        const localX = dx * Math.cos(pitcherRotationZ) + dy * Math.sin(pitcherRotationZ);
        const localY = -dx * Math.sin(pitcherRotationZ) + dy * Math.cos(pitcherRotationZ);

        // Pitcher body is roughly localY from -0.3 to +0.3, radius 0.2
        if (localY > 0.0 && localY < 0.35 && Math.abs(localX) < 0.18) {
          if (isUpright) {
            // Caught perfectly inside the opening
            p.active = false; 
            
            let topLayer = this.state.pitcherLayers[this.state.pitcherLayers.length - 1];
            if (!topLayer || topLayer.type !== p.type) {
              this.state.pitcherLayers.push({ type: p.type, volume: 0 });
              topLayer = this.state.pitcherLayers[this.state.pitcherLayers.length - 1];
            }
            topLayer.volume += 0.01;

            if (currentPlanLayer) {
              currentPlanLayer.volume -= 0.01;
              if (currentPlanLayer.volume <= 0) {
                this.state.fillingIndex++;
                if (this.state.fillingIndex >= this.state.fillingPlan.length) {
                  this.state.phase = "pouring";
                  this.deactivateAllParticles();
                }
              }
            }
          } else {
            // Upside down, spills out
            p.vx = localX > 0 ? 0.2 : -0.2;
          }
        } else if (localY > -0.3 && localY < 0.35 && Math.abs(localX) >= 0.18 && Math.abs(localX) < 0.26) {
          // Hit the exterior wall of the pitcher! Bounce off.
          p.vx = localX > 0 ? 0.15 : -0.15;
        } else if (p.y < -1.5) {
          p.active = false; // Missed entirely
        }
      });
    }

    // Phase 2: Pouring into Glass or Trash
    if (this.state.phase === "pouring") {
      const pVol = this.getTotalPitcherVolume();
      const tiltDirection = Math.sign(pitcherRotationZ);
      const tiltMagnitude = Math.abs(pitcherRotationZ);
      
      // Calculate robust water level bounds for ANY rotation angle
      const Y1 = 0.5 - 0.22 * Math.sin(pitcherRotationZ) - 0.34 * Math.cos(pitcherRotationZ);
      const Y2 = 0.5 + 0.22 * Math.sin(pitcherRotationZ) - 0.34 * Math.cos(pitcherRotationZ);
      const Y3 = 0.5 - 0.22 * Math.sin(pitcherRotationZ) + 0.26 * Math.cos(pitcherRotationZ);
      const Y4 = 0.5 + 0.22 * Math.sin(pitcherRotationZ) + 0.26 * Math.cos(pitcherRotationZ);
      
      const lowestWorldY = Math.min(Y1, Y2, Y3, Y4);
      const highestWorldY = Math.max(Y1, Y2, Y3, Y4);
      const worldFillHeight = lowestWorldY + pVol * (highestWorldY - lowestWorldY);
      
      // Exact local position of emission (Spout left vs Spout right)
      const localX = tiltDirection > 0 ? -0.18 : 0.18; // Dual spout
      const localY = 0.3;
      
      // Transform local to world space using exact rotation matrix
      const worldX = -0.1 + localX * Math.cos(pitcherRotationZ) - localY * Math.sin(pitcherRotationZ);
      const spoutWorldY = 0.5 + localX * Math.sin(pitcherRotationZ) + localY * Math.cos(pitcherRotationZ);
      
      // Real Physics: Water pours if its surface level (plus a small assist buffer) is higher than the opening
      // This prevents tiny amounts of liquid from getting stuck and refusing to pour
      const isPouring = (worldFillHeight + 0.15) >= spoutWorldY && tiltMagnitude > 0.1;

      if (isPouring && pVol > 0 && this.emitTimer <= 0) {
        const topLayer = this.state.pitcherLayers[this.state.pitcherLayers.length - 1];
        if (topLayer) {
          const force = 0.2 + 0.8 * (tiltMagnitude / Math.PI); 
          const vx = tiltDirection > 0 ? -force : force;
          const vy = -0.1 - force * 0.2;
          
          this.emitParticle(worldX, spoutWorldY, vx + (Math.random()-0.5)*0.1, vy, topLayer.type);
          
          topLayer.volume -= 0.005; // Drain layer
          if (topLayer.volume <= 0) {
            this.state.pitcherLayers.pop(); // Remove empty layer
          }
          this.emitTimer = this.emitRate / 2; // Pour fast
        }
      }

      this.updateParticles(deltaTime, (p) => {
        // Hit glass (Left)
        if (p.vy <= 0 && p.x > this.state.glassX - this.state.glassWidth/2 && p.x < this.state.glassX + this.state.glassWidth/2 && p.y < -0.8 && p.y > -1.2) {
          if (p.type === 'water') {
            if (this.state.glassCurrentVolume < this.state.glassTargetVolume) {
              p.active = false; 
              this.state.glassCurrentVolume += 0.005;
            } else {
              // Ignore visually overflowing liquid without causing failure
              p.active = false;
            }
          } else if (p.type === 'poison') {
            p.active = false; 
            this.state.glassPoisonVolume += 0.005;
          }
        } 
        // Hit trash (Right)
        else if (p.vy <= 0 && p.x > this.state.trashX - this.state.trashWidth/2 && p.x < this.state.trashX + this.state.trashWidth/2 && p.y < -0.8 && p.y > -1.2) {
          p.active = false; // Infinite capacity, just destroy it
        } 
        // Spilled floor
        else if (p.y < -1.5) {
          p.active = false;
        }
      });
      
      const particlesSettled = this.getActiveParticles() === 0;

      // Clinical flow: Transition smoothly out of the pouring phase
      // Wait for pitcher to be empty AND all drops to settle in the glass
      if (this.state.phase === "pouring") {
        this.state.stabilityTimer += deltaTime;
        if ((pVol <= 0.02 && particlesSettled) || this.state.stabilityTimer >= 20.0) {
          this.state.phase = "sliding";
        }
      }
    }

    // Phase 3: Sliding Glass (Resetting round)
    if (this.state.phase === "sliding") {
      this.state.glassX -= deltaTime * 3.0; // Slide left (Glass only)
      // The sink is architectural, it does not move.
      if (this.state.glassX < -4.0) {
        if (this.state.round >= 3) {
          this.state.phase = "success"; // End of entire session
        } else {
          this.state.round++;
          this.startRound(); // Next round, no sudden game overs!
        }
      }
    }

    return this.getState();
  }

  private emitParticle(x: number, y: number, vx: number, vy: number, type: LiquidType) {
    const p = this.particlesPool.find(p => !p.active);
    if (p) {
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.type = type;
    }
  }

  private updateParticles(dt: number, collisionFn: (p: Particle) => void) {
    for (const p of this.particlesPool) {
      if (!p.active) continue;
      
      p.vy -= this.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      
      collisionFn(p);
    }
  }

  private deactivateAllParticles() {
    for (const p of this.particlesPool) p.active = false;
  }
  
  private getActiveParticles(): number {
     return this.particlesPool.filter(p => p.active).length;
  }

  getState(): WaterState {
    return {
      ...this.state,
      pitcherLayers: this.state.pitcherLayers.map(l => ({...l})), // clone array
      particles: this.particlesPool.filter((p) => p.active).map(p => ({...p})),
    };
  }
}
