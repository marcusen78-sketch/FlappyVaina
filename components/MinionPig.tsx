// MinionPig.tsx — Cerdo verde estilo Angry Birds (rediseñado + animado)
// Componente puro React + SVG. Copia y pega en tu proyecto.

type Props = { size?: number; className?: string };

export default function MinionPig({ size = 100, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 220 220"
      className={className}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        {/* Cuerpo: verde con volumen pronunciado */}
        <radialGradient id="mp-body" cx="0.4" cy="0.32" r="0.95">
          <stop offset="0%" stopColor="#c8f29a" />
          <stop offset="25%" stopColor="#a8e372" />
          <stop offset="55%" stopColor="#6cc23d" />
          <stop offset="82%" stopColor="#2f8a18" />
          <stop offset="100%" stopColor="#0e4a06" />
        </radialGradient>

        {/* Panza más clara con tinte amarillento */}
        <radialGradient id="mp-belly" cx="0.5" cy="0.55" r="0.7">
          <stop offset="0%" stopColor="#eaf8c4" />
          <stop offset="55%" stopColor="#b9e387" />
          <stop offset="100%" stopColor="#6cc23d" stopOpacity="0" />
        </radialGradient>

        {/* Hocico abombado */}
        <radialGradient id="mp-snout" cx="0.5" cy="0.35" r="0.7">
          <stop offset="0%" stopColor="#c8f29a" />
          <stop offset="60%" stopColor="#8ed762" />
          <stop offset="100%" stopColor="#3d9920" />
        </radialGradient>

        {/* Ojos blancos con brillo */}
        <radialGradient id="mp-eye" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f4f8ec" />
          <stop offset="100%" stopColor="#c4d0bb" />
        </radialGradient>

        {/* Oreja: gradiente sutil */}
        <linearGradient id="mp-ear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7fcf4d" />
          <stop offset="100%" stopColor="#2f8a18" />
        </linearGradient>

        {/* Highlight superior */}
        <radialGradient id="mp-shine" cx="0.5" cy="0" r="0.6">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* Sombra suelta */}
        <filter id="mp-drop" x="-30%" y="-20%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" />
          <feOffset dx="0" dy="3.5" result="off" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.55" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Sombra interna sutil al borde */}
        <filter id="mp-inner" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>

        <style>{`
          @keyframes mp-bob { 0%,100%{transform:translateY(0) rotate(0)} 25%{transform:translateY(-3px) rotate(-1.2deg)} 50%{transform:translateY(-5px) rotate(0)} 75%{transform:translateY(-3px) rotate(1.2deg)} }
          @keyframes mp-squash { 0%,100%{transform:scale(1,1)} 50%{transform:scale(1.03,0.97)} }
          @keyframes mp-shadow { 0%,100%{transform:scaleX(1);opacity:.28} 50%{transform:scaleX(0.82);opacity:.16} }
          @keyframes mp-blink { 0%,92%,100%{transform:scaleY(1)} 95%,97%{transform:scaleY(0.08)} }
          @keyframes mp-pupils { 0%,30%{transform:translate(0,0)} 35%,55%{transform:translate(-6px,1px)} 60%,80%{transform:translate(5px,-1px)} 85%,100%{transform:translate(0,0)} }
          @keyframes mp-brow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-1.8px)} }
          @keyframes mp-ear-l { 0%,100%{transform:rotate(0)} 50%{transform:rotate(-6deg)} }
          @keyframes mp-ear-r { 0%,100%{transform:rotate(0)} 50%{transform:rotate(6deg)} }
          @keyframes mp-belly { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
          @keyframes mp-smirk { 0%,100%{transform:translateX(0) rotate(0)} 50%{transform:translateX(1.5px) rotate(2deg)} }

          .mp-root { transform-box: fill-box; transform-origin: center bottom; animation: mp-bob 2.6s ease-in-out infinite; }
          .mp-body-g { transform-box: fill-box; transform-origin: center; animation: mp-squash 2.6s ease-in-out infinite; }
          .mp-shadow { transform-box: fill-box; transform-origin: center; animation: mp-shadow 2.6s ease-in-out infinite; }
          .mp-eyes { transform-box: fill-box; transform-origin: center; animation: mp-blink 4.2s ease-in-out infinite; }
          .mp-pupils { animation: mp-pupils 5.4s ease-in-out infinite; }
          .mp-brows { transform-box: fill-box; transform-origin: center; animation: mp-brow 2.6s ease-in-out infinite; }
          .mp-ear-l { transform-box: fill-box; transform-origin: 52px 60px; animation: mp-ear-l 3.8s ease-in-out infinite; }
          .mp-ear-r { transform-box: fill-box; transform-origin: 168px 60px; animation: mp-ear-r 3.8s ease-in-out infinite; }
          .mp-belly-g { transform-box: fill-box; transform-origin: center; animation: mp-belly 2.6s ease-in-out infinite; }
          .mp-mouth { transform-box: fill-box; transform-origin: 110px 168px; animation: mp-smirk 3.2s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .mp-root,.mp-body-g,.mp-shadow,.mp-eyes,.mp-pupils,.mp-brows,
            .mp-ear-l,.mp-ear-r,.mp-belly-g,.mp-mouth { animation:none; }
          }
        `}</style>
      </defs>

      {/* Sombra en el suelo */}
      <ellipse className="mp-shadow" cx="110" cy="200" rx="62" ry="8" fill="#000" opacity="0.28" />

      <g className="mp-root">
        {/* Orejas (detrás) */}
        <g className="mp-ear-l">
          <path
            d="M52 60 Q40 28 30 14 Q48 22 64 38 Q66 50 60 60 Z"
            fill="url(#mp-ear)"
            stroke="#0e4a06"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M48 52 Q42 36 38 26 Q50 34 56 44 Z" fill="#b6e88a" opacity="0.85" />
        </g>
        <g className="mp-ear-r">
          <path
            d="M168 60 Q180 28 190 14 Q172 22 156 38 Q154 50 160 60 Z"
            fill="url(#mp-ear)"
            stroke="#0e4a06"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M172 52 Q178 36 182 26 Q170 34 164 44 Z" fill="#b6e88a" opacity="0.85" />
        </g>

        {/* Cuerpo */}
        <g className="mp-body-g" filter="url(#mp-drop)">
          {/* base */}
          <ellipse
            cx="110"
            cy="118"
            rx="78"
            ry="74"
            fill="url(#mp-body)"
            stroke="#0e4a06"
            strokeWidth="2.8"
          />
          {/* highlight superior */}
          <ellipse cx="110" cy="62" rx="60" ry="34" fill="url(#mp-shine)" />
          {/* sombra inferior */}
          <path
            d="M40 140 Q110 215 180 140 Q165 195 110 198 Q55 195 40 140 Z"
            fill="#0e4a06"
            opacity="0.18"
          />
        </g>

        {/* Panza */}
        <ellipse
          className="mp-belly-g"
          cx="110"
          cy="138"
          rx="48"
          ry="34"
          fill="url(#mp-belly)"
        />

        {/* Cejas pobladas */}
        <g className="mp-brows">
          <path
            d="M58 86 Q86 70 110 92"
            stroke="#0a2a04"
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M162 86 Q134 70 110 92"
            stroke="#0a2a04"
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
          />
          {/* destello en cejas */}
          <path d="M65 84 Q80 76 92 84" stroke="#2b5a16" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
          <path d="M155 84 Q140 76 128 84" stroke="#2b5a16" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
        </g>

        {/* Ojos grandes */}
        <g className="mp-eyes">
          <ellipse cx="86" cy="108" rx="22" ry="23" fill="url(#mp-eye)" stroke="#0a2a04" strokeWidth="2.2" />
          <ellipse cx="134" cy="108" rx="22" ry="23" fill="url(#mp-eye)" stroke="#0a2a04" strokeWidth="2.2" />
          {/* sombra interior superior */}
          <path d="M68 96 Q86 88 104 96" stroke="#0a2a04" strokeWidth="1" fill="none" opacity="0.25" />
          <path d="M116 96 Q134 88 152 96" stroke="#0a2a04" strokeWidth="1" fill="none" opacity="0.25" />

          <g className="mp-pupils">
            <circle cx="92" cy="112" r="7.5" fill="#0a0a0a" />
            <circle cx="140" cy="112" r="7.5" fill="#0a0a0a" />
            <circle cx="94.5" cy="109" r="2.6" fill="#ffffff" />
            <circle cx="142.5" cy="109" r="2.6" fill="#ffffff" />
            <circle cx="89" cy="115" r="1.2" fill="#ffffff" opacity="0.7" />
            <circle cx="137" cy="115" r="1.2" fill="#ffffff" opacity="0.7" />
          </g>
        </g>

        {/* Hocico */}
        <g>
          <ellipse cx="110" cy="148" rx="32" ry="22" fill="url(#mp-snout)" stroke="#0e4a06" strokeWidth="2.2" />
          {/* sombra inferior del hocico */}
          <path d="M82 152 Q110 174 138 152 Q132 168 110 170 Q88 168 82 152 Z" fill="#1a5c0a" opacity="0.25" />
          {/* orificios */}
          <ellipse cx="99" cy="146" rx="5.2" ry="7.5" fill="#08200a" />
          <ellipse cx="121" cy="146" rx="5.2" ry="7.5" fill="#08200a" />
          {/* brillo */}
          <ellipse cx="104" cy="138" rx="14" ry="4.5" fill="#ffffff" opacity="0.35" />
        </g>

        {/* Boca — sonrisa maliciosa con diente */}
        <g className="mp-mouth">
          <path
            d="M84 168 Q110 184 136 166"
            stroke="#0a2a04"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          {/* labio inferior sutil */}
          <path
            d="M92 172 Q110 180 128 170"
            stroke="#0a2a04"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.4"
          />
          {/* dientecillo */}
          <path
            d="M104 176 L110 184 L116 176 Z"
            fill="#ffffff"
            stroke="#0a2a04"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </g>

        {/* Patitas */}
        <g stroke="#0a2a04" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M78 188 L74 200 M82 188 L82 202 M86 188 L90 200" />
          <path d="M134 188 L130 200 M138 188 L138 202 M142 188 L146 200" />
        </g>
      </g>
    </svg>
  );
}
