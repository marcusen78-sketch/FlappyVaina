import Matter from 'matter-js';

const WORLD_W = 1280;
const WORLD_H = 720;

export const GROUND_Y = 648; // exported so level.ts can import it

export interface WorldSetup {
  engine: Matter.Engine;
  runner: Matter.Runner;
  render: Matter.Render;
  world: Matter.World;
}

export function createWorld(container: HTMLElement): WorldSetup {
  // Engine — higher iterations for solid collisions (no tunneling)
  const engine = Matter.Engine.create({
    positionIterations: 12,
    velocityIterations: 8,
    constraintIterations: 4,
  });
  engine.gravity.y = 1;

  const world = engine.world;

  // Renderer — transparent background so we draw the image ourselves
  const render = Matter.Render.create({
    element: container,
    engine,
    options: {
      width: WORLD_W,
      height: WORLD_H,
      wireframes: false,
      background: 'transparent', // clearRect each frame — bodies drawn on transparent canvas
    },
  });

  // Canvas fills its container responsively
  render.canvas.style.width = '100%';
  render.canvas.style.height = '100%';
  render.canvas.style.display = 'block';
  render.canvas.style.position = 'absolute';
  render.canvas.style.top = '0';
  render.canvas.style.left = '0';

  // ── Background image drawn BEHIND all bodies via destination-over ──────
  // destination-over: "draw source where destination is transparent"
  // → image fills areas with no bodies, bodies stay on top
  const bgImg = new Image();
  bgImg.src = '/origami-background.jpg';

  Matter.Events.on(render, 'afterRender', () => {
    const ctx = render.context;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    if (bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.drawImage(bgImg, 0, 0, WORLD_W, WORLD_H);
    } else {
      // Fallback while image loads
      ctx.fillStyle = '#b8d4e8';
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
    ctx.restore();
  });

  // Runner
  const runner = Matter.Runner.create();

  // Ground — aligned with the dark dirt strip in game-background.jpg (~y=648)
  // render is invisible: the image provides the visual ground
  const ground = Matter.Bodies.rectangle(
    WORLD_W / 2,
    GROUND_Y,
    WORLD_W,
    (WORLD_H - GROUND_Y) * 2,
    {
      isStatic: true,
      label: 'ground',
      render: { visible: false },
      friction: 0.8,
    }
  );

  // Invisible walls
  const leftWall = Matter.Bodies.rectangle(
    -25, WORLD_H / 2, 50, WORLD_H,
    { isStatic: true, label: 'wall', render: { visible: false } }
  );
  const rightWall = Matter.Bodies.rectangle(
    WORLD_W + 25, WORLD_H / 2, 50, WORLD_H,
    { isStatic: true, label: 'wall', render: { visible: false } }
  );
  const ceiling = Matter.Bodies.rectangle(
    WORLD_W / 2, -25, WORLD_W, 50,
    { isStatic: true, label: 'ceiling', render: { visible: false } }
  );

  Matter.Composite.add(world, [ground, leftWall, rightWall, ceiling]);

  Matter.Render.run(render);
  Matter.Runner.run(runner, engine);

  return { engine, runner, render, world };
}
