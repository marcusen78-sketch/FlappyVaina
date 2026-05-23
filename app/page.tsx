"use client";

import dynamic from "next/dynamic";

const HandTracker = dynamic(() => import("@/components/HandTracker"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen w-screen bg-white">
      <p className="text-gray-400 text-lg">Cargando...</p>
    </div>
  ),
});

export default function Home() {
  return <HandTracker />;
}
