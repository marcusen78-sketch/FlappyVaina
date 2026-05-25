"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center py-20 px-4 gap-24 select-none relative overflow-hidden">
      
      {/* Background Orbs for Premium Medical Aesthetic */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Section */}
      <div className="text-center z-10">
        <h1 className="text-4xl sm:text-5xl font-extralight text-slate-100 tracking-[0.3em] lowercase">
          fixed<span className="font-semibold text-indigo-400">gap</span>
        </h1>
        <p className="mt-4 text-sm font-light tracking-widest text-slate-400 uppercase">
          Plataforma de Rehabilitación Neuromotora
        </p>
      </div>

      {/* Primary Action: TEST MODE */}
      <div className="z-10 w-full max-w-md flex flex-col items-center">
        <button
          onClick={() => router.push('/game?mode=test')}
          className="group relative w-full flex items-center justify-center gap-4 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white rounded-2xl py-6 px-8 shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <svg className="w-8 h-8 text-indigo-100 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-xl font-medium tracking-widest uppercase">
            Iniciar Test
          </span>
        </button>
      </div>

      {/* Secondary Actions: Individual Games */}
      <div className="z-10 w-full max-w-3xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-slate-700" />
          <h2 className="text-xs font-light text-slate-500 tracking-[0.2em] uppercase">
            Práctica Libre
          </h2>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-slate-700" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 px-4">
          
          {/* Card 1: Slingshot Game */}
          <Link
            href="/game"
            className="group flex flex-col items-center justify-center w-full py-8 rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="text-slate-400 group-hover:text-red-400 transition-colors duration-300 mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xs font-light text-slate-300 tracking-widest uppercase text-center">
              Tirachinas
            </h3>
          </Link>

          {/* Card 2: Flappy Plane */}
          <Link
            href="/flappy"
            className="group flex flex-col items-center justify-center w-full py-8 rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="text-slate-400 group-hover:text-sky-400 transition-colors duration-300 mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <h3 className="text-xs font-light text-slate-300 tracking-widest uppercase text-center">
              Avión
            </h3>
          </Link>

          {/* Card 3: Water Pouring */}
          <Link
            href="/water"
            className="group flex flex-col items-center justify-center w-full py-8 rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="text-slate-400 group-hover:text-blue-400 transition-colors duration-300 mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
            </div>
            <h3 className="text-xs font-light text-slate-300 tracking-widest uppercase text-center">
              Agua
            </h3>
          </Link>

        </div>
      </div>

      {/* Footer Section */}
      <div className="absolute bottom-6 z-10">
        <Link
          href="/tracker"
          className="text-[10px] uppercase tracking-[0.2em] text-slate-500 hover:text-slate-300 transition-colors duration-200"
        >
          calibración
        </Link>
      </div>

    </div>
  );
}
