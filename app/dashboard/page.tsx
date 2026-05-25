"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FlappyMetrics, WaterMetrics, SlingshotMetrics } from "@/lib/telemetry/biomechanics";

type StoredFlappy = FlappyMetrics & { date: string };
type StoredWater = WaterMetrics & { date: string };
type StoredSlingshot = SlingshotMetrics & { date: string };

function CircularGauge({ value, max, label, unit, color = "text-indigo-500", highlight = false }: { value: number, max: number, label: string, unit: string, color?: string, highlight?: boolean }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center w-24 h-24 mb-2">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
          <circle 
            cx="50" cy="50" r={radius} 
            stroke="currentColor" strokeWidth="8" fill="transparent" 
            strokeDasharray={circumference} 
            strokeDashoffset={strokeDashoffset} 
            className={`${color} transition-all duration-1000 ease-out drop-shadow-sm`} 
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className={`text-xl font-bold tracking-tight ${highlight ? color : 'text-slate-700'}`}>
            {value.toFixed(1)}
          </span>
          <span className="text-[10px] text-slate-400 font-medium uppercase">{unit}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-slate-500 uppercase tracking-widest text-center">{label}</span>
    </div>
  );
}

function ProgressBar({ label, percent, leftLabel, rightLabel, color = "bg-indigo-500" }: { label: string, percent: number, leftLabel?: string, rightLabel?: string, color?: string }) {
  const p = Math.min(100, Math.max(0, percent));
  return (
    <div className="w-full mb-5">
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        <span className="text-xs font-semibold text-slate-700">{p.toFixed(0)}%</span>
      </div>
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
        <div className={`h-full rounded-full ${color} transition-all duration-1000 ease-out`} style={{ width: `${p}%` }} />
      </div>
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px] text-slate-400">{leftLabel}</span>
          <span className="text-[10px] text-slate-400">{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 flex flex-col h-full hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] transition-shadow duration-300">
      <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-50">
        <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl">
          {icon}
        </div>
        <h2 className="text-lg font-semibold tracking-wide text-slate-700">{title}</h2>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        {children}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [flappy, setFlappy] = useState<StoredFlappy | null>(null);
  const [water, setWater] = useState<StoredWater | null>(null);
  const [slingshot, setSlingshot] = useState<StoredSlingshot | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const fHistory = JSON.parse(localStorage.getItem("clinical_metrics_flappy") || "[]");
      const wHistory = JSON.parse(localStorage.getItem("clinical_metrics_water") || "[]");
      const sHistory = JSON.parse(localStorage.getItem("clinical_metrics_slingshot") || "[]");
      
      if (fHistory.length > 0) setFlappy(fHistory[fHistory.length - 1]);
      if (wHistory.length > 0) setWater(wHistory[wHistory.length - 1]);
      if (sHistory.length > 0) setSlingshot(sHistory[sHistory.length - 1]);
    } catch (e) {
      console.error("Error reading metrics", e);
    }
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-indigo-100 flex flex-col items-center">
      
      {/* Header */}
      <div className="w-full max-w-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between mb-16 gap-6">
        <div>
          <h1 className="text-4xl font-extralight tracking-tight text-slate-900 mb-2">
            Resultados <span className="font-semibold text-indigo-600">Clínicos</span>
          </h1>
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">
            {flappy?.date ? new Date(flappy.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sesión de evaluación'}
          </p>
        </div>
        
        <Link 
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl font-medium tracking-wide shadow-sm transition-all hover:shadow"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Finalizar y Volver
        </Link>
      </div>

      <div className="w-full max-w-3xl flex flex-col gap-16 pb-20">
        
        {/* Module 1: Slingshot */}
        <MetricCard 
          title="Módulo Proximal (Tirachinas)" 
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
        >
          {slingshot ? (
            <>
              <div className="flex justify-around mb-10">
                <CircularGauge value={slingshot.maxPinchOpen * 100} max={100} label="Apertura Pinza" unit="%" color="text-sky-500" />
                <CircularGauge value={slingshot.accuracyRatio * 100} max={100} label="Visomotricidad" unit="%" color="text-emerald-500" />
              </div>
              <ProgressBar label="Extensión Proximal (Tracción)" percent={(slingshot.maxPullDistance / 300) * 100} color="bg-indigo-400" leftLabel="Contracturado" rightLabel="Óptimo (>300px)" />
              
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Temblor de Tracción</span>
                <span className={`text-sm font-bold px-3 py-1 rounded-lg ${slingshot.pullTremor > 10 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {slingshot.pullTremor > 10 ? 'Ataxia Detectada' : 'Estable'}
                </span>
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm text-center">No hay datos de este módulo.</p>
          )}
        </MetricCard>

        {/* Module 2: Flappy */}
        <MetricCard 
          title="Flexoextensión Distal (Avión)" 
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
        >
          {flappy ? (
            <>
              <div className="flex justify-around mb-10">
                <CircularGauge value={flappy.maxExtension * 100} max={100} label="Extensión ROM" unit="%" color="text-amber-500" />
                <CircularGauge value={flappy.maxFlexion * 100} max={100} label="Flexión ROM" unit="%" color="text-violet-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Activaciones</div>
                  <div className="text-2xl font-light text-slate-700">{flappy.activationCount}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fatiga (Decaimiento)</div>
                  <div className={`text-2xl font-light ${flappy.fatigueIndex < -0.15 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {Math.abs(flappy.fatigueIndex * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              <div className="mt-auto p-4 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Espasticidad (Jerk)</span>
                <span className={`text-sm font-bold px-3 py-1 rounded-lg ${flappy.smoothnessJerk > 5 ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {flappy.smoothnessJerk > 5 ? 'Rigidez Rígida' : 'Fluido'}
                </span>
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm text-center">No hay datos de este módulo.</p>
          )}
        </MetricCard>

        {/* Module 3: Water */}
        <MetricCard 
          title="Pronosupinación (Agua)" 
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16a4 4 0 100-8 4 4 0 000 8z" /></svg>}
        >
          {water ? (
            <>
              <div className="flex justify-around mb-10">
                <CircularGauge value={Math.abs(water.maxPronation * (180/Math.PI))} max={90} label="Pronación (Izq)" unit="°" color="text-blue-500" />
                <CircularGauge value={Math.abs(water.maxSupination * (180/Math.PI))} max={90} label="Supinación (Der)" unit="°" color="text-teal-500" />
              </div>
              <ProgressBar label="Precisión Llenado Limpio" percent={water.waterAccuracy * 100} color="bg-emerald-400" />
              <ProgressBar label="Error Llenado Toxina" percent={water.poisonError * 100} color="bg-rose-400" />
              
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Temblores (Jerk)</span>
                <span className={`text-sm font-bold px-3 py-1 rounded-lg ${water.smoothnessJerk > 20 ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                  {water.smoothnessJerk > 20 ? 'Intencionalidad' : 'Giro Suave'}
                </span>
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm text-center">No hay datos de este módulo.</p>
          )}
        </MetricCard>

      </div>
    </div>
  );
}
