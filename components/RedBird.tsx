// RedBird.tsx — Pájaro rojo estilo Angry Birds (SVG puro, mejorado)
type Props = { size?: number; className?: string };

export default function RedBird({ size = 100, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      style={{ display: "block" }}
    >
      <defs>
        {/* Cuerpo rojo con volumen */}
        <radialGradient id="rb-body" cx="0.38" cy="0.32" r="0.85">
          <stop offset="0%" stopColor="#ff8b7a" />
          <stop offset="35%" stopColor="#ef3a2c" />
          <stop offset="75%" stopColor="#b91515" />
          <stop offset="100%" stopColor="#6e0606" />
        </radialGradient>
        {/* Panza */}
        <radialGradient id="rb-belly" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor="#fff1ea" />
          <stop offset="70%" stopColor="#f5c9b7" />
          <stop offset="100%" stopColor="#e09a82" />
        </radialGradient>
        {/* Pico */}
        <linearGradient id="rb-beak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd97a" />
          <stop offset="60%" stopColor="#f4a83b" />
          <stop offset="100%" stopColor="#c97a16" />
        </linearGradient>
        {/* Brillo del ojo */}
        <radialGradient id="rb-eye" cx="0.5" cy="0.45" r="0.55">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e6ecf2" />
        </radialGradient>
        <filter id="rb-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="3" result="off" />
          <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Sombra en el suelo */}
      <ellipse cx="100" cy="180" rx="55" ry="6" fill="#000" opacity="0.18" />

      {/* Cola (3 plumas) */}
      <g stroke="#5a0707" strokeWidth="2" strokeLinejoin="round">
        <path d="M168 90 L195 78 L182 95 Z" fill="#8a1414" />
        <path d="M170 102 L198 102 L182 112 Z" fill="#a01818" />
        <path d="M168 114 L195 126 L180 118 Z" fill="#8a1414" />
      </g>

      {/* Cuerpo principal */}
      <g filter="url(#rb-shadow)">
        <ellipse
          cx="100"
          cy="108"
          rx="72"
          ry="66"
          fill="url(#rb-body)"
          stroke="#3a0606"
          strokeWidth="2.5"
        />
      </g>

      {/* Panza */}
      <ellipse cx="100" cy="128" rx="42" ry="32" fill="url(#rb-belly)" opacity="0.95" />

      {/* Plumas en la cabeza (tuft) */}
      <g stroke="#3a0606" strokeWidth="2" strokeLinejoin="round">
        <path d="M82 38 L88 60 L74 56 Z" fill="#a01818" />
        <path d="M100 30 L106 58 L92 58 Z" fill="#c01a1a" />
        <path d="M118 38 L124 58 L110 60 Z" fill="#a01818" />
      </g>

      {/* Cejas enfadadas */}
      <path
        d="M52 78 Q72 70 92 88"
        stroke="#2a0303"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M148 78 Q128 70 108 88"
        stroke="#2a0303"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />

      {/* Ojos: blanco grande compartido (estilo Red) */}
      <g>
        <ellipse cx="82" cy="100" rx="20" ry="22" fill="url(#rb-eye)" stroke="#2a0303" strokeWidth="2" />
        <ellipse cx="118" cy="100" rx="20" ry="22" fill="url(#rb-eye)" stroke="#2a0303" strokeWidth="2" />
        {/* Pupilas mirando al frente, ligeramente juntas */}
        <circle cx="90" cy="103" r="7" fill="#0d0d0d" />
        <circle cx="110" cy="103" r="7" fill="#0d0d0d" />
        {/* Brillo */}
        <circle cx="92.5" cy="100" r="2.3" fill="#ffffff" />
        <circle cx="112.5" cy="100" r="2.3" fill="#ffffff" />
      </g>

      {/* Pico */}
      <g>
        <path
          d="M84 122 Q100 116 116 122 L108 138 Q100 142 92 138 Z"
          fill="url(#rb-beak)"
          stroke="#6b3d05"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Separación entre mandíbulas */}
        <path d="M86 130 Q100 134 114 130" stroke="#6b3d05" strokeWidth="1.5" fill="none" />
        {/* Brillo del pico */}
        <path d="M90 121 Q96 119 102 120" stroke="#fff2c2" strokeWidth="1.2" fill="none" opacity="0.8" />
      </g>

      {/* Pequeñas patitas */}
      <g stroke="#6b3d05" strokeWidth="2.5" strokeLinecap="round" fill="#f4a83b">
        <path d="M82 170 L78 178 M82 170 L86 178 M82 170 L82 180" />
        <path d="M118 170 L114 178 M118 170 L122 178 M118 170 L118 180" />
      </g>
    </svg>
  );
}
