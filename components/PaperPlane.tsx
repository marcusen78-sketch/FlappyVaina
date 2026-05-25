// PaperPlane.tsx — Avión de papel low-poly simple (SVG)
// 4 facetas grandes: ala superior (luz), ala lateral (sombra media),
// muesca trasera (sombra profunda), quilla colgante.

type Props = { size?: number; className?: string };

const C = {
  light: "#f4f7fa",
  mid:   "#b8c0cb",
  shade: "#7c8693",
  dark:  "#4a525e",
  edge:  "#252b35",
};

// size controls height; width is derived from the 240:180 viewBox ratio
export default function PaperPlane({ size = 54, className }: Props) {
  const h = size;
  const w = Math.round(size * (240 / 180));
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 240 180"
      className={className}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <radialGradient id="pp-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#0e1622" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#0e1622" stopOpacity="0" />
        </radialGradient>

        <style>{`
          .pp-face { stroke: ${C.edge}; stroke-width: 1.3; stroke-linejoin: round; stroke-linecap: round; }
        `}</style>
      </defs>

      {/*
        Vértices (vista 3/4 lateral, avión apunta arriba-derecha):
          N  = (225,  40)  nariz
          A  = ( 25,  78)  wingtip trasero arriba
          B  = ( 60, 120)  wingtip trasero abajo
          M  = (105,  92)  muesca trasera centro
          K  = ( 95, 130)  punta quilla colgante
      */}

      {/* Ala superior — cara iluminada */}
      <polygon className="pp-face"
        points="225,40 25,78 105,92"
        fill={C.light}
      />

      {/* Ala lateral / inferior — sombra media */}
      <polygon className="pp-face"
        points="225,40 105,92 60,120"
        fill={C.mid}
      />

      {/* Muesca trasera — cara interna del pliegue */}
      <polygon className="pp-face"
        points="25,78 105,92 60,120"
        fill={C.shade}
      />

      {/* Quilla colgante */}
      <polygon className="pp-face"
        points="225,40 105,92 95,130"
        fill={C.dark}
      />

      {/* Pliegue central */}
      <line
        x1="225" y1="40" x2="105" y2="92"
        stroke={C.edge} strokeWidth="1.4" opacity="0.9"
      />

      {/* Highlight borde de ataque */}
      <polyline
        points="225,40 25,78"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1"
        opacity="0.7"
      />
    </svg>
  );
}
