"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col justify-center items-center py-12 px-4 select-none relative">
      
      {/* Header Section */}
      <div className="mb-20 text-center">
        <h1 className="text-3xl sm:text-4xl font-extralight text-slate-800 tracking-[0.25em] lowercase">
          fixedgap
        </h1>
      </div>

      {/* Game Cards Grid */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-10 md:gap-16 max-w-5xl w-full">
        
        {/* Card 1: Pinch Game */}
        <Link
          href="/game"
          className="group flex flex-col items-center justify-center w-48 h-48 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          <div className="text-slate-300 group-hover:text-indigo-500 transition-colors duration-300 mb-6">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </div>
          <h3 className="text-xs font-light text-slate-500 tracking-widest uppercase text-center">
            Pellizco
          </h3>
        </Link>

        {/* Card 2: Lab Game */}
        <Link
          href="/lab"
          className="group flex flex-col items-center justify-center w-48 h-48 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          <div className="text-slate-300 group-hover:text-teal-500 transition-colors duration-300 mb-6">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h3 className="text-xs font-light text-slate-500 tracking-widest uppercase text-center">
            Laboratorio
          </h3>
        </Link>

        {/* Card 3: Flappy Plane */}
        <Link
          href="/flappy"
          className="group flex flex-col items-center justify-center w-48 h-48 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          <div className="text-slate-300 group-hover:text-sky-500 transition-colors duration-300 mb-6">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h3 className="text-xs font-light text-slate-500 tracking-widest uppercase text-center">
            Avión
          </h3>
        </Link>

      </div>

      {/* Footer Section */}
      <div className="absolute bottom-10">
        <Link
          href="/tracker"
          className="text-[10px] uppercase tracking-[0.2em] text-slate-300 hover:text-slate-500 transition-colors duration-200"
        >
          calibración
        </Link>
      </div>

    </div>
  );
}
