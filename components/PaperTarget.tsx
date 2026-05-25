import { CSSProperties } from "react";

interface PaperTargetProps {
  size?: number;
  distance?: "near" | "mid" | "far";
  sway?: boolean;
  className?: string;
  style?: CSSProperties;
}

const PaperTarget = ({
  size = 140,
  distance = "near",
  sway = false,
  className,
  style,
}: PaperTargetProps) => {
  const scale = distance === "near" ? 1 : distance === "mid" ? 0.78 : 0.58;
  const finalSize = size * scale;

  return (
    <div
      className={className}
      style={{
        width: finalSize,
        height: finalSize,
        display: "inline-block",
        animation: sway ? "pt-sway 3.4s ease-in-out infinite" : undefined,
        transformOrigin: "50% 0%",
        ...style,
      }}
    >
      <style>{`
        @keyframes pt-sway {
          0%, 100% { transform: rotate(-3deg); }
          50%      { transform: rotate(3deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pt-root { animation: none !important; }
        }
      `}</style>

      <svg
        viewBox="0 0 200 200"
        width="100%"
        height="100%"
        className="pt-root"
        aria-label="Diana de papel origami"
      >
        <defs>
          <radialGradient id="pt-outer" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#dfe4ea" />
          </radialGradient>
          <radialGradient id="pt-ring2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b6fa0" />
            <stop offset="100%" stopColor="#234870" />
          </radialGradient>
          <radialGradient id="pt-ring3" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f5f3ee" />
            <stop offset="100%" stopColor="#d8d2c4" />
          </radialGradient>
          <radialGradient id="pt-center" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e85d3a" />
            <stop offset="100%" stopColor="#a83320" />
          </radialGradient>
          <pattern id="pt-folds" patternUnits="userSpaceOnUse" width="200" height="200">
            {Array.from({ length: 16 }).map((_, i) => (
              <line
                key={i}
                x1="100" y1="100" x2="100" y2="0"
                stroke="rgba(0,0,0,0.08)" strokeWidth="0.6"
                transform={`rotate(${(i * 360) / 16} 100 100)`}
              />
            ))}
          </pattern>
        </defs>

        <ellipse cx="100" cy="186" rx="70" ry="6" fill="rgba(0,0,0,0.18)" />
        <circle cx="100" cy="100" r="92" fill="url(#pt-outer)" stroke="#aab3bd" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="72" fill="url(#pt-ring2)" />
        <circle cx="100" cy="100" r="48" fill="url(#pt-ring3)" />
        <circle cx="100" cy="100" r="22" fill="url(#pt-center)" />
        <circle cx="100" cy="100" r="5"  fill="#5c1a10" />
        <circle cx="100" cy="100" r="92" fill="url(#pt-folds)" opacity="0.7" />
        <path d="M 30 70 Q 60 30, 110 30" stroke="rgba(255,255,255,0.4)" strokeWidth="3" fill="none" />
      </svg>
    </div>
  );
};

export default PaperTarget;
