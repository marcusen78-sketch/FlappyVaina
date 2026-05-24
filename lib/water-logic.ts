export type WaterPhase = "ready" | "waiting" | "filling" | "pouring" | "sliding" | "success" | "gameover";

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
  glassTargetVolume: number;
  glassCurrentVolume: number;
  spilledDrops: number;
  maxSpills: number;
  glassWidth: number; // For collision
  glassX: number; // Position offset
  particles: Particle[];
  timeLeft: number;
  stabilityTimer: number;
  round: number;
  waitingTimer: number;
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
      glassX: -0.8,
      particles: [],
      timeLeft: 15,
      stabilityTimer: 0,
      round: 1,
      waitingTimer: 0,
    };
  }

  startLevel() {
    this.state.score = 0;
    this.state.round = 1;
    this.startRound();
  }

  startRound() {
    this.state.phase = "waiting";
    this.state.waitingTimer = 2.0;
    this.state.pitcherVolume = 0;
    this.state.glassCurrentVolume = 0;
    this.state.spilledDrops = 0;
    this.state.glassTargetVolume = 0.4 + Math.random() * 0.5; // Random glass size
    this.state.glassWidth = 0.2 + Math.random() * 0.2; // Random glass width
    this.state.glassX = -0.8;
    this.state.timeLeft = 15;
    this.state.stabilityTimer = 0;
    this.deactivateAllParticles();
  }

  update(pitcherRotationZ: number, deltaTime: number): WaterState {
    if (this.state.phase === "ready" || this.state.phase === "success" || this.state.phase === "gameover") {
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
      // Tap emits from top center
      if (this.emitTimer <= 0) {
        this.emitParticle(0, 1.2, (Math.random() - 0.5) * 0.2, -1.0);
        this.emitTimer = this.emitRate;
      }

      // Check if pitcher is upright to catch (generous ~45 degree allowance)
      const isUpright = Math.abs(pitcherRotationZ) < 0.8;

      this.updateParticles(deltaTime, (p) => {
        // Pitcher is at (-0.1, 0.5), bottom is around y=0.15.
        // Catch box adjusted to new position.
        if (isUpright && p.x > -0.3 && p.x < 0.2 && p.y < 0.4 && p.y > 0.0) {
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
      this.state.timeLeft -= deltaTime;
      if (this.state.timeLeft <= 0) {
        this.state.phase = "gameover";
        return this.getState();
      }

      // Pitcher is at x=-0.1, y=0.5
      const tiltDirection = Math.sign(pitcherRotationZ);
      const tiltMagnitude = Math.abs(pitcherRotationZ);
      
      // Calculate accurate water level using tilted cylinder lowest/highest points
      const pVol = this.state.pitcherVolume;
      const lowestWorldY = 0.5 - 0.22 * Math.sin(tiltMagnitude) - 0.34 * Math.cos(pitcherRotationZ);
      const highestWorldY = 0.5 + 0.22 * Math.sin(tiltMagnitude) + 0.26 * Math.cos(pitcherRotationZ);
      const worldFillHeight = lowestWorldY + pVol * (highestWorldY - lowestWorldY);
      
      // Exact local position of emission (Spout left vs Handle right)
      const localX = tiltDirection > 0 ? -0.18 : 0.25;
      const localY = tiltDirection > 0 ? 0.3 : 0.0;
      
      // Transform local to world space using exact rotation matrix
      const worldX = -0.1 + localX * Math.cos(pitcherRotationZ) - localY * Math.sin(pitcherRotationZ);
      const spoutWorldY = 0.5 + localX * Math.sin(pitcherRotationZ) + localY * Math.cos(pitcherRotationZ);
      
      // Real Physics: Water pours only if its surface level is higher than the opening
      // AND we only allow pouring towards the spout (tiltDirection > 0), blocking the handle side
      const isPouring = worldFillHeight >= spoutWorldY && tiltDirection > 0;

      if (isPouring && pVol > 0 && this.emitTimer <= 0) {
        // Dynamic arc: more tilt = more force
        // Reduced base force so it falls more accurately into the glass
        const force = 0.2 + 0.8 * (tiltMagnitude / Math.PI); 
        const vx = tiltDirection > 0 ? -force : force;
        const vy = -0.1 - force * 0.2;
        
        this.emitParticle(worldX, spoutWorldY, vx + (Math.random()-0.5)*0.1, vy);
        this.state.pitcherVolume -= 0.005; // Drain pitcher
        this.emitTimer = this.emitRate / 2; // Pour fast
      }

      this.updateParticles(deltaTime, (p) => {
        const halfW = this.state.glassWidth / 2;
        // Only interact if falling down
        if (p.vy <= 0 && p.x > this.state.glassX - halfW && p.x < this.state.glassX + halfW && p.y < -0.8 && p.y > -1.2) {
          if (this.state.glassCurrentVolume < this.state.glassTargetVolume * 1.0) {
            p.active = false; // Caught in glass!
            this.state.glassCurrentVolume += 0.005;
          } else {
            // Glass exceeds 100%! Splash and Fail!
            p.y = -0.8; 
            p.vy = 0.4 + Math.random() * 0.4;
            p.vx = (Math.random() - 0.5) * 1.5;
            this.state.phase = "gameover";
          }
        } else if (p.y < -1.5) {
          p.active = false; // Spilled!
          this.state.spilledDrops++;
        }
      });
      
      const fillRatio = this.state.glassCurrentVolume / this.state.glassTargetVolume;
      const particlesSettled = this.getActiveParticles() === 0;

      // Evaluate Stability Win Condition (No tilt required, just stop pouring for 1 second)
      if (fillRatio >= 0.8 && fillRatio <= 1.0) {
        if (!isPouring && particlesSettled) {
          this.state.stabilityTimer += deltaTime;
          if (this.state.stabilityTimer >= 1.0) {
            this.state.phase = "sliding";
            this.state.score++;
          }
        } else {
          this.state.stabilityTimer = 0;
        }
      } else {
        this.state.stabilityTimer = 0;
      }
      
      // Early fail if out of water and under 80%
      if (this.state.pitcherVolume <= 0 && particlesSettled && fillRatio < 0.8) {
         this.state.phase = "gameover";
      }
    }

    // Phase 3: Sliding Glass
    if (this.state.phase === "sliding") {
      this.state.glassX -= deltaTime * 3.0; // Slide speed
      if (this.state.glassX < -4.0) {
        if (this.state.round >= 3) {
          this.state.phase = "success";
        } else {
          this.state.round++;
          this.startRound();
        }
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
