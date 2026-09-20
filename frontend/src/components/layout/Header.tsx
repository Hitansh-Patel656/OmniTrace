"use client";

import React, { useState, useEffect } from "react";
import { Play, Plus, CheckCircle2, AlertCircle, RefreshCw, Radio } from "lucide-react";
import { api } from "@/lib/api";
import { IngestModal } from "../modals/IngestModal";

export const Header: React.FC = () => {
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [isRunningEngine, setIsRunningEngine] = useState(false);
  const [engineNotification, setEngineNotification] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        await api.getHealth();
        if (mounted) setApiOnline(true);
      } catch {
        if (mounted) setApiOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRunEngine = async () => {
    setIsRunningEngine(true);
    setEngineNotification(null);
    try {
      const res = await api.runEngine(1000);
      setEngineNotification(`Processed ${res.totalProcessed} pending event(s)`);
      setTimeout(() => setEngineNotification(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Engine execution failed";
      setEngineNotification(`Error: ${msg}`);
      setTimeout(() => setEngineNotification(null), 5000);
    } finally {
      setIsRunningEngine(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#1e293b]/70 bg-[#080d16]/80 px-8 backdrop-blur-md">
        {/* Left Side: System Telemetry Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full bg-[#0d131f] border border-[#1e293b] px-3 py-1 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                apiOnline === true
                  ? "bg-emerald-400 animate-telemetry-pulse"
                  : apiOnline === false
                  ? "bg-rose-500"
                  : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="font-mono text-[11px] text-slate-300">
              {apiOnline === true
                ? "API GATEWAY ONLINE (PORT 3001)"
                : apiOnline === false
                ? "API GATEWAY DISCONNECTED"
                : "CONNECTING..."}
            </span>
          </div>

          {engineNotification && (
            <div className="flex items-center gap-1.5 rounded-md bg-indigo-950/80 border border-indigo-700/60 px-2.5 py-1 text-xs text-indigo-300 animate-fadeIn">
              <CheckCircle2 size={13} className="text-cyan-400" />
              <span>{engineNotification}</span>
            </div>
          )}
        </div>

        {/* Right Side: Quick Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Manual Batch Engine Trigger */}
          <button
            onClick={handleRunEngine}
            disabled={isRunningEngine}
            title="Triggers POST /api/engine/run to stitch pending MongoDB events into Postgres"
            className="flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-950/40 px-3.5 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-900/50 hover:border-indigo-400/60 disabled:opacity-50 transition-all shadow-[0_0_12px_rgba(99,102,241,0.15)]"
          >
            {isRunningEngine ? (
              <RefreshCw size={13} className="animate-spin text-indigo-400" />
            ) : (
              <Play size={13} className="text-cyan-400 fill-cyan-400/40" />
            )}
            <span>{isRunningEngine ? "Stitching..." : "Run Engine Batch"}</span>
          </button>

          {/* Ingest Event Modal Trigger */}
          <button
            onClick={() => setIsIngestOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 hover:brightness-110 transition-all"
          >
            <Plus size={14} />
            <span>Simulate Ingest</span>
          </button>
        </div>
      </header>

      <IngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onSuccess={() => {
          setEngineNotification("Event ingested & auto-stitched!");
          setTimeout(() => setEngineNotification(null), 4000);
        }}
      />
    </>
  );
};
