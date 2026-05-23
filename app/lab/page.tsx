"use client";

import dynamic from "next/dynamic";

const LabGame = dynamic(() => import("@/components/LabGame"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen w-screen bg-white">
      <p className="text-gray-400 text-lg">Cargando laboratorio...</p>
    </div>
  ),
});

export default function LabPage() {
  return <LabGame />;
}
