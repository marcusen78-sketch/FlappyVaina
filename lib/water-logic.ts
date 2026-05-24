export type WaterPhase = "ready" | "filling" | "pouring" | "success" | "gameover";

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

export interface WaterState {
  phase: WaterPhase;
  score: number;
  pitcherVolume: number; // 0 to 1
  glassTargetVolume: number; // Random capacity required to win the round
  glassCurrentVolume: number;
  spilledDrops: number;
  maxSpills: number;
  glassWidth: number; // For collision
  particles: Particle[];
}

export class WaterEngine {
  public state: WaterState;
  
  private particlesPool: Particle[] = [];
  private nextParticleId = 0;
  
  // Physics constants
  private readonly gravity = 4.0;
  private readonly maxParticles = 300;
  private readonly emitRate = 0.05; // seconds per particle
  private emitTimer = 0;

  constructor() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particlesPool.push({ id: i, x: 0, y: 0, vx: 0, vy: 0, active: false });
    }

    this.state = {
      phase: "ready",
      score: 0,
      pitcherVolume: 0,
      glassTargetVolume: 0.5,
      glassCurrentVolume: 0,
      spilledDrops: 0,
      maxSpills: 30,
      glassWidth: 0.3,
      particles: [],
    };
  }

  startLevel() {
    this.state.phase = "filling";
    this.state.pitcherVolume = 0;
    this.state.glassCurrentVolume = 0;
    this.state.spilledDrops = 0;
    this.state.glassTargetVolume = 0.4 + Math.random() * 0.5; // Random glass size
    this.state.glassWidth = 0.2 + Math.random() * 0.2; // Random glass width
    this.deactivateAllParticles();
  }

  update(pitcherRotationZ: number, isPouring: boolean, deltaTime: number): WaterState {
    if (this.state.phase === "ready" || this.state.phase === "success" || this.state.phase === "gameover") {
      return this.getState();
    }

    this.emitTimer -= deltaTime;

    // Phase 1: Filling from Tap
    if (this.state.phase === "filling") {
      // Tap emits from top center
      if (this.emitTimer <= 0) {
        this.emitParticle(0, 1.2, (Math.random() - 0.5) * 0.2, -1.0);
        this.emitTimer = this.emitRate;
      }

      // Check if pitcher is upright to catch
      const isUpright = Math.abs(pitcherRotationZ) < 0.3;

      this.updateParticles(deltaTime, (p) => {
        // Pitcher collision box (approx center bottom)
        if (isUpright && p.x > -0.2 && p.x < 0.2 && p.y < -0.2 && p.y > -0.5) {
          p.active = false; // Caught!
          this.state.pitcherVolume += 0.01;
          if (this.state.pitcherVolume >= 1.0) {
            this.state.pitcherVolume = 1.0;
            this.state.phase = "pouring"; // Transition to Phase 2
            this.deactivateAllParticles();
          }
        } else if (p.y < -1.5) {
          p.active = false; // Missed pitcher
        }
      });
    }

    // Phase 2: Pouring into Glass
    if (this.state.phase === "pouring") {
      // Glass is at bottom center. Pitcher is controlled by user.
      if (isPouring && this.state.pitcherVolume > 0 && this.emitTimer <= 0) {
        // Spout position depends on tilt direction
        const spoutX = Math.sign(pitcherRotationZ) * 0.2;
        const spoutY = 0.5; // High up
        const vx = Math.sign(pitcherRotationZ) * 1.5;
        const vy = -0.5;
        
        this.emitParticle(spoutX, spoutY, vx + (Math.random()-0.5)*0.2, vy);
        this.state.pitcherVolume -= 0.005; // Drain pitcher
        this.emitTimer = this.emitRate / 2; // Pour fast
      }

      this.updateParticles(deltaTime, (p) => {
        // Glass collision box
        const halfW = this.state.glassWidth / 2;
        if (p.x > -halfW && p.x < halfW && p.y < -0.8 && p.y > -1.2) {
          p.active = false; // Caught in glass!
          this.state.glassCurrentVolume += 0.005;
          
          if (this.state.glassCurrentVolume >= this.state.glassTargetVolume) {
            // Level Complete!
            this.state.phase = "success";
            this.state.score++;
          }
        } else if (p.y < -1.5) {
          p.active = false; // Spilled!
          this.state.spilledDrops++;
          if (this.state.spilledDrops > this.state.maxSpills) {
            this.state.phase = "gameover";
          }
        }
      });
      
      // Auto gameover if pitcher empty but glass not full
      if (this.state.pitcherVolume <= 0 && this.state.glassCurrentVolume < this.state.glassTargetVolume && this.getActiveParticles() === 0) {
         this.state.phase = "gameover";
      }
    }

    return this.getState();
  }

  private emitParticle(x: number, y: number, vx: number, vy: number) {
    const p = this.particlesPool.find(p => !p.active);
    if (p) {
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
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
      particles: this.particlesPool.filter((p) => p.active).map(p => ({...p})),
    };
  }
}
