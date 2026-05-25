import Matter from 'matter-js';
import { GROUND_Y } from './world';

// Target radius matches the visual size of each PaperTarget (half of finalSize)
// PaperTarget at size=120: near=120→r=60, mid=93→r=46, far=70→r=35
export interface TargetDef {
  x: number;
  y: number;
  radius: number;
  distance: 'near' | 'mid' | 'far';
}

export const TARGET_DEFS: TargetDef[] = [
  { x: 750,  y: GROUND_Y - 110, radius: 60, distance: 'near' },
  { x: 970,  y: GROUND_Y - 250, radius: 46, distance: 'mid'  },
  { x: 1170, y: GROUND_Y - 390, radius: 35, distance: 'far'  },
];

export interface LevelBodies {
  targets: Matter.Body[];
}

export function buildLevel(world: Matter.World): LevelBodies {
  const targets: Matter.Body[] = [];

  for (const def of TARGET_DEFS) {
    const body = Matter.Bodies.circle(def.x, def.y, def.radius, {
      isStatic: true,
      label: 'target',
      render: { visible: false },
      restitution: 0.3,
      friction: 0.5,
    });
    Matter.Composite.add(world, body);
    targets.push(body);
  }

  return { targets };
}
