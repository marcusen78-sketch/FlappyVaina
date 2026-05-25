import Matter from 'matter-js';
import { InputEvent } from '../input/types';

const ANCHOR = { x: 450, y: 520 };

const BIRD_RADIUS = 28;     // larger bird
const TOTAL_BIRDS = 5;
const MAX_PULL = 180;       // allow slightly more stretch
const MIN_FIRE_PULL = 25;
const GRAB_RADIUS = 70;
const LAUNCH_POWER = 0.20;  // slower flight speed
const SETTLE_SPEED = 0.5;


const SETTLE_DURATION = 800;

export interface SlingshotOptions {
  world: Matter.World;
  engine: Matter.Engine;
  onBirdFired: (birdsLeft: number) => void;
  onAllBirdsUsed: () => void;
}

export class Slingshot {
  private world: Matter.World;
  private engine: Matter.Engine;
  private onBirdFired: (birdsLeft: number) => void;
  private onAllBirdsUsed: () => void;

  private bird: Matter.Body | null = null;
  private birdsLeft = TOTAL_BIRDS;
  private isGrabbing = false;
  private hasPulled = false;
  private isFired = false;
  private settleTimer: number | null = null;
  private isLoadingNext = false;

  // Position we force the bird to every physics tick (world coords)
  private targetPos = { x: ANCHOR.x, y: ANCHOR.y };

  // Public data for rendering the rubber band
  public birdPos = { x: ANCHOR.x, y: ANCHOR.y };
  public isStretched = false;

  // Bound event handler so we can remove it properly
  private readonly pinHandler: () => void;

  constructor(opts: SlingshotOptions) {
    this.world = opts.world;
    this.engine = opts.engine;
    this.onBirdFired = opts.onBirdFired;
    this.onAllBirdsUsed = opts.onAllBirdsUsed;

    // Every physics step: force the un-fired bird to stay at targetPos
    this.pinHandler = () => {
      if (this.bird && !this.isFired) {
        Matter.Body.setPosition(this.bird, { x: this.targetPos.x, y: this.targetPos.y });
        Matter.Body.setVelocity(this.bird, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(this.bird, 0);
      }
    };

    this.loadNextBird();
  }

  get anchor() { return ANCHOR; }
  get birdsRemaining() { return this.birdsLeft; }

  // ── Trajectory Prediction ─────────────────────────────────────────────────
  getTrajectory(): { x: number; y: number }[] {
    if (!this.isStretched || !this.bird) return [];
    
    const points: { x: number; y: number }[] = [];
    
    // Initial release velocity
    const vx = (ANCHOR.x - this.targetPos.x) * LAUNCH_POWER;
    const vy = (ANCHOR.y - this.targetPos.y) * LAUNCH_POWER;
    
    let currentX = this.targetPos.x;
    let currentY = this.targetPos.y;
    let currentVx = vx;
    let currentVy = vy;
    
    // Replicate Matter.js Verlet integration exactly:
    //   vx = vx * frictionAir
    //   vy = vy * frictionAir + gravity * dt²
    //   pos += v
    // gravity.scale default = 0.001, dt = 16.666ms → dt² ≈ 277.78
    const g = this.engine.gravity;
    const gravityY = g.y * g.scale * 16.6666 * 16.6666;
    const frictionAir = 1 - this.bird.frictionAir;

    for (let i = 0; i < 120; i++) {
      // Order matters: friction first, then gravity (matches Matter.js source)
      currentVx = currentVx * frictionAir;
      currentVy = currentVy * frictionAir + gravityY;

      currentX += currentVx;
      currentY += currentVy;

      if (i % 3 === 0) {
        points.push({ x: currentX, y: currentY });
      }

      // Stop once below ground
      if (currentY > 680) break;
    }
    
    return points;
  }

  // ── Load Bird ─────────────────────────────────────────────────────────────


  loadNextBird() {
    if (this.birdsLeft <= 0) {
      this.onAllBirdsUsed();
      return;
    }

    this.isLoadingNext = false;
    this.isFired = false;
    this.isGrabbing = false;
    this.hasPulled = false;
    this.isStretched = false;
    this.targetPos = { x: ANCHOR.x, y: ANCHOR.y };
    this.birdPos = { x: ANCHOR.x, y: ANCHOR.y };

    // Dynamic body with collisions DISABLED until fired.
    // inertia: Infinity prevents any physics-driven rotation so the
    // paper plane visual can track velocity direction cleanly.
    const bird = Matter.Bodies.circle(ANCHOR.x, ANCHOR.y, BIRD_RADIUS, {
      density: 0.003,
      friction: 0.5,
      frictionAir: 0.001,
      restitution: 0.55,
      label: 'bird',
      render: { visible: false },
      inertia: Infinity,
      // category 0x0002 = bird. mask 0x0000 = collides with nothing while in slingshot.
      collisionFilter: { category: 0x0002, mask: 0x0000 },
    });

    Matter.Composite.add(this.world, bird);
    this.bird = bird;

    // Register beforeUpdate pin — keeps the bird glued to targetPos every tick
    Matter.Events.on(this.engine, 'beforeUpdate', this.pinHandler);
  }

  // ── Input Handling ────────────────────────────────────────────────────────

  handleInput(e: InputEvent) {
    if (e.type === 'down') {
      this.onDown(e.x, e.y);
    } else if (e.type === 'move') {
      this.onMove(e.x, e.y);
    } else if (e.type === 'up') {
      this.onUp(e.x, e.y);
    }
  }

  private onDown(wx: number, wy: number) {
    if (!this.bird || this.isFired || this.isLoadingNext) return;

    const dx = wx - this.targetPos.x;
    const dy = wy - this.targetPos.y;
    if (Math.sqrt(dx * dx + dy * dy) <= GRAB_RADIUS) {
      this.isGrabbing = true;
      this.hasPulled = false;
    }
  }

  private onMove(wx: number, wy: number) {
    if (!this.bird || !this.isGrabbing || this.isFired) return;

    let tx = wx;
    let ty = wy;

    // Cap pull to MAX_PULL from anchor
    const dx = tx - ANCHOR.x;
    const dy = ty - ANCHOR.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MAX_PULL) {
      const scale = MAX_PULL / dist;
      tx = ANCHOR.x + dx * scale;
      ty = ANCHOR.y + dy * scale;
    }

    this.targetPos = { x: tx, y: ty };
    this.birdPos = { x: tx, y: ty };

    const pull = Math.sqrt((tx - ANCHOR.x) ** 2 + (ty - ANCHOR.y) ** 2);
    this.hasPulled = pull >= MIN_FIRE_PULL;
    this.isStretched = pull > 5;
  }

  private onUp(_wx: number, _wy: number) {
    if (!this.bird || !this.isGrabbing || this.isFired) return;
    this.isGrabbing = false;

    if (!this.hasPulled) {
      // Snap back to anchor without firing
      this.targetPos = { x: ANCHOR.x, y: ANCHOR.y };
      this.birdPos = { x: ANCHOR.x, y: ANCHOR.y };
      this.isStretched = false;
      return;
    }

    this.fire();
  }


  // ── Fire ──────────────────────────────────────────────────────────────────

  private fire() {
    if (!this.bird) return;

    // Stop pinning — bird is free now
    Matter.Events.off(this.engine, 'beforeUpdate', this.pinHandler);

    this.isFired = true;
    this.isStretched = false;
    this.birdsLeft--;

    // Enable collisions with everything EXCEPT other birds (category 0x0002)
    this.bird.collisionFilter.category = 0x0002;
    this.bird.collisionFilter.mask = 0xFFFFFFFF & ~0x0002;

    // Launch velocity: vector from bird toward anchor, scaled by LAUNCH_POWER
    const bx = this.bird.position.x;
    const by = this.bird.position.y;
    const vx = (ANCHOR.x - bx) * LAUNCH_POWER;
    const vy = (ANCHOR.y - by) * LAUNCH_POWER;
    Matter.Body.setVelocity(this.bird, { x: vx, y: vy });

    this.onBirdFired(this.birdsLeft);
    this.watchForSettle();
  }

  // ── Settle Detection ──────────────────────────────────────────────────────

  private watchForSettle() {
    if (!this.bird) return;
    const firedBird = this.bird;
    let settleStart: number | null = null;
    // Give the bird at least 600ms to be in the air before checking settle
    const launchTime = performance.now();

    const check = () => {
      if (this.isLoadingNext) return;

      const pos = firedBird.position;
      const vel = firedBird.velocity;
      const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2);
      const elapsed = performance.now() - launchTime;

      const offScreen =
        pos.x < -100 || pos.x > 1400 || pos.y > 780 || pos.y < -200;

      if (offScreen && elapsed > 300) {
        this.scheduleNextBird();
        return;
      }

      if (elapsed > 600 && speed < SETTLE_SPEED) {
        if (settleStart === null) settleStart = performance.now();
        else if (performance.now() - settleStart >= SETTLE_DURATION) {
          this.scheduleNextBird();
          return;
        }
      } else if (speed >= SETTLE_SPEED) {
        settleStart = null;
      }

      this.settleTimer = requestAnimationFrame(check) as unknown as number;
    };

    this.settleTimer = requestAnimationFrame(check) as unknown as number;
  }

  private scheduleNextBird() {
    if (this.isLoadingNext) return;
    this.isLoadingNext = true;

    if (this.settleTimer !== null) {
      cancelAnimationFrame(this.settleTimer);
      this.settleTimer = null;
    }

    setTimeout(() => this.loadNextBird(), 500);
  }

  // ── Destroy ───────────────────────────────────────────────────────────────

  destroy() {
    Matter.Events.off(this.engine, 'beforeUpdate', this.pinHandler);

    if (this.settleTimer !== null) {
      cancelAnimationFrame(this.settleTimer);
      this.settleTimer = null;
    }
    if (this.bird) {
      Matter.Composite.remove(this.world, this.bird);
      this.bird = null;
    }
  }
}
