'use client';

/**
 * HandCursor.tsx
 *
 * Overlay that renders a full skeletal hand based on MediaPipe landmarks.
 * Renders as an absolutely-positioned SVG over the game canvas.
 * pointer-events: none — never interferes with the canvas.
 */

import type { HandCursorState } from '@/lib/input/HandInputProvider';

const WORLD_W = 1280;
const WORLD_H = 720;

// MediaPipe hand connections (pairs of landmark indices that form a bone)
const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
];

interface Props {
  state: HandCursorState;
}

export default function HandCursor({ state }: Props) {
  const { isPinching, visible, landmarks } = state;

  if (!visible || !landmarks || landmarks.length !== 21) return null;

  // Caricature style colors
  const boneColor = isPinching ? 'rgba(50, 255, 120, 0.8)' : 'rgba(255, 255, 255, 0.7)';
  const jointColor = isPinching ? 'rgba(50, 255, 120, 1)' : 'rgba(255, 255, 255, 1)';
  const outlineColor = 'rgba(0, 0, 0, 0.4)';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Draw Bones (Lines) */}
        {HAND_CONNECTIONS.map(([startIdx, endIdx], i) => {
          const start = landmarks[startIdx];
          const end = landmarks[endIdx];
          
          // Highlight thumb and index bones when pinching
          const isPinchBone = isPinching && (
            (startIdx >= 1 && startIdx <= 4) || // Thumb bones
            (startIdx >= 5 && startIdx <= 8)    // Index bones
          );

          const currentBoneColor = isPinchBone ? 'rgba(50, 255, 120, 0.9)' : boneColor;
          const strokeWidth = isPinchBone ? 8 : 5;

          return (
            <g key={`bone-${i}`}>
              {/* Outline */}
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={outlineColor}
                strokeWidth={strokeWidth + 3}
                strokeLinecap="round"
              />
              {/* Inner bone */}
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={currentBoneColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                style={{ transition: 'stroke 150ms ease, stroke-width 150ms ease' }}
              />
            </g>
          );
        })}

        {/* Draw Joints (Circles) */}
        {landmarks.map((lm, i) => {
          // Highlight thumb tip (4) and index tip (8) when pinching
          const isPinchJoint = isPinching && (i === 4 || i === 8);
          const currentJointColor = isPinchJoint ? '#32FF78' : jointColor;
          const radius = isPinchJoint ? 8 : 5;

          return (
            <g key={`joint-${i}`}>
              <circle
                cx={lm.x}
                cy={lm.y}
                r={radius + 2}
                fill={outlineColor}
              />
              <circle
                cx={lm.x}
                cy={lm.y}
                r={radius}
                fill={currentJointColor}
                style={{ transition: 'fill 150ms ease, r 150ms ease' }}
              />
            </g>
          );
        })}

        {/* Action point (the actual grab point) */}
        {isPinching && (
          <circle
            cx={state.x}
            cy={state.y}
            r={16}
            fill="rgba(50, 255, 120, 0.4)"
            stroke="#32FF78"
            strokeWidth="3"
            style={{ filter: 'drop-shadow(0 0 8px rgba(50,255,120,0.8))' }}
          />
        )}
      </svg>
    </div>
  );
}
