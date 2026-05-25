"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { HandPinchProvider } from "@/lib/input/HandPinchProvider";

const SlingshotGame = dynamic(() => import("@/components/SlingshotGame"), {
  ssr: false,
});

type Status =
  | { kind: "loading"; message: string }
  | { kind: "error";   message: string }
  | { kind: "ready" };

function StatusOverlay({ status, onRetry }: { status: Status; onRetry: () => void }) {
  const baseStyle: React.CSSProperties = {
    position: "fixed", inset: 0,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    zIndex: 100,
    background: "rgba(10,20,10,0.88)", backdropFilter: "blur(6px)",
    fontFamily: "system-ui, sans-serif", color: "#fff", gap: 20,
  };

  if (status.kind === "loading") {
    return (
      <div style={baseStyle}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          border: "5px solid rgba(80,255,140,0.2)",
          borderTop: "5px solid #50ff8c",
          animation: "spin 0.9s linear infinite",
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{status.message}</p>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", margin: 0 }}>
          Necesitas permitir el acceso a la cámara
        </p>
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div style={baseStyle}>
        <span style={{ fontSize: 52 }}>📷</span>
        <p style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "#ff6b6b" }}>{status.message}</p>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", margin: 0, textAlign: "center", maxWidth: 340 }}>
          Asegúrate de que tu navegador tiene permiso para acceder a la cámara.
        </p>
        <button
          onClick={onRetry}
          style={{
            marginTop: 8, padding: "10px 28px",
            background: "#50ff8c", color: "#0a1a0a",
            border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return null;
}

export default function GamePage() {
  const providerRef = useRef<HandPinchProvider | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "loading", message: "Iniciando cámara…" });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const provider = new HandPinchProvider();
    providerRef.current = provider;

    async function init() {
      try {
        setStatus({ kind: "loading", message: "Iniciando cámara…" });
        const dummyCanvas = document.createElement("canvas");
        dummyCanvas.width = 1280;
        dummyCanvas.height = 720;
        setStatus({ kind: "loading", message: "Solicitando permiso de cámara…" });
        await provider.start(dummyCanvas);
        if (cancelled) return;
        await provider.ready;
        if (cancelled) return;
        setStatus({ kind: "ready" });
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("notallowed")) {
          setStatus({ kind: "error", message: "Permiso de cámara denegado" });
        } else {
          setStatus({ kind: "error", message: "Error al cargar la visión por computador" });
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      provider.stop();
      providerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  function handleRetry() {
    providerRef.current?.stop();
    providerRef.current = null;
    setRetryKey(k => k + 1);
  }

  return (
    <>
      {status.kind === "ready" && providerRef.current && (
        <SlingshotGame inputProvider={providerRef.current} />
      )}
      {status.kind !== "ready" && (
        <StatusOverlay status={status} onRetry={handleRetry} />
      )}
    </>
  );
}
