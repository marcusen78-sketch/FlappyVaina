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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 max-w-5xl w-full px-8">
        
        {/* Card 1: Slingshot Game */}
        <Link
          href="/game"
          className="group flex flex-col items-center justify-center w-full aspect-square rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          <div className="text-slate-300 group-hover:text-red-500 transition-colors duration-300 mb-6">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xs font-light text-slate-500 tracking-widest uppercase text-center">
            Tirachinas
          </h3>
        </Link>


        {/* Card 3: Flappy Plane */}
        <Link
          href="/flappy"
          className="group flex flex-col items-center justify-center w-full aspect-square rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
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

        {/* Card 4: Water Pouring */}
        <Link
          href="/water"
          className="group flex flex-col items-center justify-center w-full aspect-square rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
          <div className="text-slate-300 group-hover:text-blue-500 transition-colors duration-300 mb-6">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 3v1m0 16a4 4 0 100-8 4 4 0 000 8z" />
            </svg>
          </div>
          <h3 className="text-xs font-light text-slate-500 tracking-widest uppercase text-center">
            Agua
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
