"use client";

import dynamic from "next/dynamic";

const FlappyGame = dynamic(() => import("@/components/FlappyGame"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen w-screen bg-[#eaf0f4]">
      <p className="text-slate-400 text-lg font-light tracking-wide">Cargando juego...</p>
    </div>
  ),
});

export default function FlappyPage() {
  return <FlappyGame />;
}
