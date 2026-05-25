'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Matter from 'matter-js';
import { createWorld } from '@/lib/physics/world';
import { buildLevel, TARGET_DEFS, type LevelBodies } from '@/lib/physics/level';
import { Slingshot } from '@/lib/physics/slingshot';
import { InputProvider } from '@/lib/input/types';
import { MouseInputProvider } from '@/lib/input/MouseInput';
import PaperPlane from './PaperPlane';
import PaperTarget from './PaperTarget';
import type { SlingshotState } from '@/lib/types';
import { SessionLogger } from '@/lib/telemetry/datalogger';
import { BiomechanicsDSP } from '@/lib/telemetry/biomechanics';

const ANCHOR = { x: 450, y: 520 };
const WORLD_W = 1280;
const WORLD_H = 720;
const TOTAL_TARGETS = TARGET_DEFS.length;

type Props = { inputProvider?: InputProvider };

export default function SlingshotGame({ inputProvider }: Props) {
  const containerRef      = useRef<HTMLDivElement>(null);
  const birdsRef          = useRef<(HTMLDivElement | null)[]>([]);
  const targetsRef        = useRef<(HTMLDivElement | null)[]>([]);
  const targetInnerRefs   = useRef<(HTMLDivElement | null)[]>([]);

  const [gameState, setGameState] = useState<SlingshotState>({ birdsLeft: 5, score: 0, phase: 'playing' });
  // Which targets are still alive (indexed by TARGET_DEFS order)
  const [aliveTargets, setAliveTargets] = useState<boolean[]>(() => TARGET_DEFS.map(() => true));

  const resetRef = useRef<() => void>(() => {});
  const handleReset = useCallback(() => resetRef.current(), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let score = 0;
    let birdsLeft = 5;
    let phase: SlingshotState['phase'] = 'playing';
    let levelBodies: LevelBodies;
    let slingshot: Slingshot;
    const sessionLogger = new SessionLogger();

    // Per-target fall animation state: once hit, target falls with physics
    const hitTimers = new Map<Matter.Body, ReturnType<typeof setTimeout>>();

    function pushState() { 
      setGameState({ birdsLeft, score, phase }); 
      if (phase === 'gameover' || phase === 'win') {
        const frames = sessionLogger.stop();
        const metrics = BiomechanicsDSP.processSlingshotMetrics(frames);
        console.log("CLINICAL METRICS (Slingshot):", metrics);
        try {
          const history = JSON.parse(localStorage.getItem("clinical_metrics_slingshot") || "[]");
          history.push({ date: new Date().toISOString(), ...metrics });
          localStorage.setItem("clinical_metrics_slingshot", JSON.stringify(history));
        } catch (e) {
          console.error("Error saving clinical metrics:", e);
        }

        // Test Mode Auto-Routing
        if (typeof window !== "undefined" && window.location.search.includes('mode=test')) {
          setTimeout(() => {
            window.location.href = '/flappy?mode=test';
          }, 3500); // 3.5s delay to let them see the Win/Loss screen
        }
      }
    }

    const { engine, runner, render, world } = createWorld(container);

    function initLevel() {
      score = 0;
      birdsLeft = 5;
      phase = 'playing';
      hitTimers.forEach(t => clearTimeout(t));
      hitTimers.clear();
      setAliveTargets(TARGET_DEFS.map(() => true));
      // Reset inner rotateY on all targets
      targetInnerRefs.current.forEach(div => {
        if (!div) return;
        div.style.transition = 'none';
        div.style.transform  = 'rotateY(35deg)';
      });
      levelBodies = buildLevel(world);
      sessionLogger.start();
      pushState();
    }

    function initSlingshot() {
      if (slingshot) slingshot.destroy();
      slingshot = new Slingshot({
        world, engine,
        onBirdFired: (left) => { birdsLeft = left; pushState(); },
        onAllBirdsUsed: () => { setTimeout(() => setGameState(s => ({ ...s, phase: 'gameover' })), 2000); },
      });
    }

    let currentProvider = inputProvider ?? new MouseInputProvider();
    currentProvider.start(render.canvas);
    const unsubscribe = currentProvider.subscribe(e => {
      slingshot.handleInput(e);
      sessionLogger.logFrame(phase, {
        pullX: e.x,
        pullY: e.y,
        isPinching: e.type !== 'up' && e.type !== 'hover',
        pinchRatio: e.pinchRatio,
        score,
        birdsLeft
      });
    });

    // ── Collision: bird hits target → make it dynamic so it falls ──────────
    function handleCollisions(event: Matter.IEventCollision<Matter.Engine>) {
      if (phase !== 'playing') return;

      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        const birdBody   = bodyA.label === 'bird'   ? bodyA : bodyB.label === 'bird'   ? bodyB : null;
        const targetBody = bodyA.label === 'target' ? bodyA : bodyB.label === 'target' ? bodyB : null;

        if (!birdBody || !targetBody) continue;
        if (hitTimers.has(targetBody)) continue; // already hit

        const idx = levelBodies.targets.indexOf(targetBody);
        if (idx === -1) continue;

        // Unpin the target so gravity takes it
        Matter.Body.setStatic(targetBody, false);
        Matter.Body.setInertia(targetBody, Infinity * 0.01); // allow rotation but damped
        Matter.Body.setVelocity(targetBody, {
          x: birdBody.velocity.x * 0.5,
          y: birdBody.velocity.y * 0.5,
        });
        Matter.Body.setAngularVelocity(targetBody, (Math.random() - 0.5) * 0.15);

        // Animate the inner div's rotateY to 0 so the target lies flat as it falls
        const innerDiv = targetInnerRefs.current[idx];
        if (innerDiv) {
          innerDiv.style.transition = 'transform 0.6s ease-out';
          innerDiv.style.transform  = 'rotateY(0deg)';
        }

        const timer = setTimeout(() => {
          Matter.Composite.remove(world, targetBody);
          setAliveTargets(prev => {
            const next = [...prev];
            next[idx] = false;
            return next;
          });
          score++;
          pushState();
          if (score >= TOTAL_TARGETS) {
            phase = 'win';
            pushState();
          }
        }, 1400);
        hitTimers.set(targetBody, timer);
      }
    }

    Matter.Events.on(engine, 'collisionStart', handleCollisions);

    // ── afterRender: slingshot fork + rubber band + trajectory + bird DOM ──
    Matter.Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      ctx.save();

      // Fork
      ctx.strokeStyle = '#3B1F0E';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ANCHOR.x, ANCHOR.y + 60); ctx.lineTo(ANCHOR.x - 20, ANCHOR.y - 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ANCHOR.x, ANCHOR.y + 60); ctx.lineTo(ANCHOR.x + 20, ANCHOR.y - 20); ctx.stroke();

      // Rubber band
      if (slingshot?.isStretched) {
        const bx = slingshot.birdPos.x;
        const by = slingshot.birdPos.y;
        ctx.strokeStyle = '#5C3A1E';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(ANCHOR.x - 8, ANCHOR.y); ctx.lineTo(bx - 14, by - 10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ANCHOR.x + 8, ANCHOR.y); ctx.lineTo(bx + 14, by - 10); ctx.stroke();

        // Trajectory dots
        const trajectory = slingshot.getTrajectory();
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        trajectory.forEach((pt, i) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, Math.max(2, 6 - i * 0.35), 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.restore();

      // Bird DOM layer
      const allBodies = Matter.Composite.allBodies(world);
      const birdBodies = allBodies.filter(b => b.label === 'bird');
      const scaleX = render.canvas.clientWidth / WORLD_W;
      const scaleY = render.canvas.clientHeight / WORLD_H;

      birdsRef.current.forEach((div, i) => {
        if (!div) return;
        const body = birdBodies[i];
        if (body) {
          div.style.display = 'block';
          const sx = body.position.x * scaleX;
          const sy = body.position.y * scaleY;
          const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
          const angle = speed > 0.5 ? Math.atan2(body.velocity.y, body.velocity.x) : 0;
          div.style.transform = `translate(${sx}px, ${sy}px) rotate(${angle}rad) scale(${scaleX}, ${scaleY})`;
        } else {
          div.style.display = 'none';
        }
      });

      // Target DOM layer — follow physics body while falling
      const targetBodies = allBodies.filter(b => b.label === 'target');
      targetsRef.current.forEach((div, i) => {
        if (!div) return;
        const body = targetBodies[i];
        if (body) {
          div.style.display = 'block';
          const sx = body.position.x * scaleX;
          const sy = body.position.y * scaleY;
          div.style.transform = `translate(${sx}px, ${sy}px) rotate(${body.angle}rad) scale(${scaleX}, ${scaleY})`;
        } else {
          div.style.display = 'none';
        }
      });
    });

    // ── Reset ──────────────────────────────────────────────────────────────
    function fullReset() {
      // Remove all non-static bodies and constraints
      const bodies = Matter.Composite.allBodies(world);
      for (const b of bodies) { if (!b.isStatic) Matter.Composite.remove(world, b); }
      const constraints = Matter.Composite.allConstraints(world);
      for (const c of constraints) Matter.Composite.remove(world, c);
      // Remove static targets too (we'll re-add them in buildLevel)
      const statics = Matter.Composite.allBodies(world).filter(b => b.label === 'target');
      for (const b of statics) Matter.Composite.remove(world, b);

      hitTimers.forEach(t => clearTimeout(t));
      hitTimers.clear();
      if (slingshot) slingshot.destroy();
      initLevel();
      initSlingshot();
    }

    resetRef.current = fullReset;
    initLevel();
    initSlingshot();

    return () => {
      unsubscribe();
      currentProvider?.stop();
      Matter.Events.off(engine, 'collisionStart', handleCollisions);
      hitTimers.forEach(t => clearTimeout(t));
      if (slingshot) slingshot.destroy();
      Matter.Runner.stop(runner);
      Matter.Render.stop(render);
      Matter.Engine.clear(engine);
      render.canvas.remove();
      render.textures = {};
    };
  }, []);

  const isOver = gameState.phase === 'gameover';
  const isWin  = gameState.phase === 'win';

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#f5f0e8' }}>
      <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f5f0e8' }}>

        {/* Bird DOM layer */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} ref={el => { birdsRef.current[i] = el; }}
              style={{ position: 'absolute', display: 'none', width: 75, height: 56, left: -37, top: -28, transformOrigin: 'center' }}>
              <PaperPlane size={56} />
            </div>
          ))}
        </div>

        {/* Target DOM layer */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4, perspective: 800 }}>
          {TARGET_DEFS.map((def, i) => {
            const size = def.radius * 2;
            return (
              <div key={i} ref={el => { targetsRef.current[i] = el; }}
                style={{ position: 'absolute', display: 'none', width: size, height: size, left: -def.radius, top: -def.radius, transformOrigin: 'center', transformStyle: 'preserve-3d' }}>
                <div ref={el => { targetInnerRefs.current[i] = el; }}
                  style={{ width: '100%', height: '100%', transform: 'rotateY(35deg)', transformStyle: 'preserve-3d' }}>
                  <PaperTarget size={size} />
                </div>
              </div>
            );
          })}
        </div>

        {/* HUD */}
        <div style={{ position: 'absolute', top: 12, left: 16, background: 'rgba(0,0,0,0.35)', color: '#fff', padding: '6px 14px', borderRadius: 8, fontSize: 15, fontFamily: 'system-ui, sans-serif', fontWeight: 500, letterSpacing: '0.03em', pointerEvents: 'none', zIndex: 10 }}>
          ✈️ {gameState.birdsLeft} &nbsp;|&nbsp; 🎯 {gameState.score}/{TOTAL_TARGETS}
        </div>

        {/* Game Over */}
        {isOver && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', zIndex: 20 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '40px 56px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
              {typeof window !== 'undefined' && window.location.search.includes('mode=test') ? (
                <>
                  <p style={{ fontSize: 24, fontWeight: 700, color: '#6366f1', marginBottom: 16 }}>Test completado</p>
                  <p style={{ color: '#555', fontWeight: 500 }}>Guardando métricas... Siguiente prueba en breve.</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 32, fontWeight: 700, color: '#D62828', marginBottom: 8 }}>💀 Game Over</p>
                  <p style={{ fontSize: 16, color: '#555', marginBottom: 24 }}>Dianas: {gameState.score} / {TOTAL_TARGETS}</p>
                  <button onClick={handleReset} style={{ background: '#D62828', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
                    Jugar de nuevo
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Win */}
        {isWin && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', zIndex: 20 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '40px 56px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
              {typeof window !== 'undefined' && window.location.search.includes('mode=test') ? (
                <>
                  <p style={{ fontSize: 24, fontWeight: 700, color: '#6366f1', marginBottom: 16 }}>Test completado</p>
                  <p style={{ color: '#555', fontWeight: 500 }}>Guardando métricas... Siguiente prueba en breve.</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 36, fontWeight: 700, color: '#52B788', marginBottom: 8 }}>🎉 ¡Todas las dianas!</p>
                  <p style={{ fontSize: 16, color: '#555', marginBottom: 24 }}>Con {5 - gameState.birdsLeft} aviones</p>
                  <button onClick={handleReset} style={{ background: '#52B788', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
                    Jugar de nuevo
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
