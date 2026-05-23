"use client";

import dynamic from "next/dynamic";

const PinchGame = dynamic(() => import("@/components/PinchGame"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen w-screen bg-white">
      <p className="text-gray-400 text-lg">Cargando juego...</p>
    </div>
  ),
});

export default function GamePage() {
  return <PinchGame />;
}
