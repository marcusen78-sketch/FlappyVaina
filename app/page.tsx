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

        {/* Card 2: Constelacion Memoria */}
        <Link
          href="/lab"
          className="group flex flex-col items-center justify-center w-48 h-48 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          <div className="text-slate-300 group-hover:text-indigo-500 transition-colors duration-300 mb-6">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <h3 className="text-xs font-light text-slate-500 tracking-widest uppercase text-center">
            Memoria
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
