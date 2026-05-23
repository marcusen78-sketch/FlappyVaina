export type GameStatus = "ready" | "playing" | "gameover";

export interface ColumnState {
  id: number;
  x: number;
  gapY: number; // center of gap
  gapSize: number;
  passed: boolean;
}

export interface FlappyState {
  status: GameStatus;
  score: number;
  highScore: number;
  planeY: number;
  planeVelocityY: number;
  columns: ColumnState[];
}

export class FlappyEngine {
  public state: FlappyState;
  private nextColumnId = 1;

  // Constants
  public readonly planeX = -0.4;
  public readonly planeRadius = 0.06;
  public readonly columnWidth = 0.16;
  public readonly minY = -1.1;
  public readonly maxY = 1.1;

  private readonly gravity = 0.8;
  private readonly thrust = 2.0;
  private readonly maxVelocity = 0.6;
  private readonly scrollSpeed = 0.25;
  private readonly columnSpacing = 1.8;
  private readonly gapSize = 0.90;

  constructor() {
    let savedHighScore = 0;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("flappy_highscore");
      if (saved) savedHighScore = parseInt(saved, 10) || 0;
    }

    this.state = {
      status: "ready",
      score: 0,
      highScore: savedHighScore,
      planeY: 0,
      planeVelocityY: 0,
      columns: [],
    };
  }

  start(): void {
    this.state.status = "playing";
    this.state.score = 0;
    this.state.planeY = 0;
    this.state.planeVelocityY = 0.2; // slight push up at start
    this.state.columns = [];
    this.nextColumnId = 1;
    this.spawnColumn(2.0); // spawn first column offscreen
  }

  update(fistStrength: number, deltaTime: number): FlappyState {
    if (this.state.status !== "playing") {
      return this.getState();
    }

    // 1. Plane Physics
    const accel = fistStrength * this.thrust - this.gravity;
    this.state.planeVelocityY += accel * deltaTime;
    this.state.planeVelocityY = Math.max(
      -this.maxVelocity,
      Math.min(this.maxVelocity, this.state.planeVelocityY)
    );
    this.state.planeY += this.state.planeVelocityY * deltaTime;

    // 2. Bound Collision
    if (this.state.planeY < this.minY) {
      this.state.planeY = this.minY;
      this.gameOver();
      return this.getState();
    }
    if (this.state.planeY > this.maxY) {
      this.state.planeY = this.maxY;
      this.state.planeVelocityY = Math.max(-0.2, this.state.planeVelocityY * -0.5); // bounce off ceiling
    }

    // 3. Move Columns
    for (const col of this.state.columns) {
      col.x -= this.scrollSpeed * deltaTime;

      // Score point if passed plane
      if (!col.passed && col.x < this.planeX) {
        col.passed = true;
        this.state.score++;
        if (this.state.score > this.state.highScore) {
          this.state.highScore = this.state.score;
          if (typeof window !== "undefined") {
            localStorage.setItem("flappy_highscore", String(this.state.highScore));
          }
        }
      }
    }

    // 4. Filter off-screen columns
    this.state.columns = this.state.columns.filter((col) => col.x > -2.2);

    // 5. Spawn new columns
    let lastColX = 0.6;
    if (this.state.columns.length > 0) {
      lastColX = this.state.columns[this.state.columns.length - 1].x;
    }
    if (lastColX < 2.0 - this.columnSpacing) {
      this.spawnColumn(2.0);
    }

    // 6. Check Obstacle Collision
    this.checkCollisions();

    return this.getState();
  }

  private spawnColumn(xPos: number): void {
    // Gap center range: [-0.4, 0.4] to keep columns balanced
    const gapY = (Math.random() - 0.5) * 0.8;
    this.state.columns.push({
      id: this.nextColumnId++,
      x: xPos,
      gapY,
      gapSize: this.gapSize,
      passed: false,
    });
  }

  private checkCollisions(): void {
    const px = this.planeX;
    const py = this.state.planeY;
    const pr = this.planeRadius;
    const cw = this.columnWidth;

    for (const col of this.state.columns) {
      // Check X overlap
      const inXRange = px + pr > col.x - cw / 2 && px - pr < col.x + cw / 2;
      if (inXRange) {
        // Check Y gap collision
        const topEdge = col.gapY + col.gapSize / 2;
        const bottomEdge = col.gapY - col.gapSize / 2;

        if (py + pr > topEdge || py - pr < bottomEdge) {
          this.gameOver();
          break;
        }
      }
    }
  }

  private gameOver(): void {
    this.state.status = "gameover";
  }

  getState(): FlappyState {
    return {
      status: this.state.status,
      score: this.state.score,
      highScore: this.state.highScore,
      planeY: this.state.planeY,
      planeVelocityY: this.state.planeVelocityY,
      columns: this.state.columns.map((c) => ({ ...c })),
    };
  }
}
