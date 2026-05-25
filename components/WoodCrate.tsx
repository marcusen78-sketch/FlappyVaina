// WoodCrate.tsx — Caja de madera estilo Angry Birds
// Componente puro CSS/SVG. Copia y pega en tu proyecto.
// Props: size (px), hp (0-100) para mostrar grietas, className.

type Props = {
  size?: number;
  hp?: number; // 100 = intacta, 0 = destruida
  className?: string;
};

export default function WoodCrate({ size = 80, hp = 100, className }: Props) {
  const cracks = hp < 66;
  const heavyCracks = hp < 33;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="wood-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c68a4a" />
          <stop offset="50%" stopColor="#a86a32" />
          <stop offset="100%" stopColor="#7a4a1f" />
        </linearGradient>
        <pattern id="wood-grain" width="100" height="20" patternUnits="userSpaceOnUse">
          <rect width="100" height="20" fill="url(#wood-grad)" />
          <path d="M0 10 Q25 6 50 10 T100 10" stroke="#6b3d18" strokeWidth="0.5" fill="none" opacity="0.5" />
          <path d="M0 16 Q25 13 50 16 T100 16" stroke="#5a2f10" strokeWidth="0.4" fill="none" opacity="0.4" />
        </pattern>
      </defs>

      {/* Caja */}
      <rect x="4" y="4" width="92" height="92" rx="4" fill="url(#wood-grain)" stroke="#4a2810" strokeWidth="2" />

      {/* Tablones horizontales */}
      <line x1="4" y1="28" x2="96" y2="28" stroke="#4a2810" strokeWidth="1.5" />
      <line x1="4" y1="52" x2="96" y2="52" stroke="#4a2810" strokeWidth="1.5" />
      <line x1="4" y1="76" x2="96" y2="76" stroke="#4a2810" strokeWidth="1.5" />

      {/* Clavos en esquinas */}
      {[[12, 12], [88, 12], [12, 88], [88, 88]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.5" fill="#3a2010" stroke="#1a0a00" strokeWidth="0.5" />
      ))}

      {/* Grietas según HP */}
      {cracks && (
        <path d="M30 10 L35 40 L28 60 L40 90" stroke="#2a1505" strokeWidth="1.2" fill="none" opacity="0.7" />
      )}
      {heavyCracks && (
        <>
          <path d="M70 5 L60 35 L75 55 L65 95" stroke="#2a1505" strokeWidth="1.5" fill="none" opacity="0.8" />
          <path d="M50 20 L45 50 L55 80" stroke="#2a1505" strokeWidth="1" fill="none" opacity="0.6" />
        </>
      )}
    </svg>
  );
}
