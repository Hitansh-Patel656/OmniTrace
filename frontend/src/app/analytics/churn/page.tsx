"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Info,
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { ChurnRiskItem } from "@/lib/types";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { formatDateTime, formatShortUUID } from "@/lib/formatters";

export default function ChurnRiskPage() {
  const [data, setData] = useState<ChurnRiskItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChurn = async () => {
    setLoading(true);
    try {
      const res = await api.getChurnRisk();
      setData(res.data || []);
    } catch (err) {
      console.error("Failed to load churn risk:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChurn();
  }, []);

  const topAtRisk = data[0];
  const peakScore = topAtRisk ? topAtRisk.score : 0;
  const avgInactivity = data.length > 0
    ? Math.round(
        data.reduce((acc, curr) => acc + (Number(curr.details?.days_inactive) || 0), 0) /
          data.length
      )
    : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b]/70 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-400">
            <AlertOctagon size={14} />
            <span>Predictive Customer Retention</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Churn Risk Radar & Detection
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Customers flagged by cross-channel inactivity following unresolved escalations via{" "}
            <code className="text-slate-300">GET /api/analytics/churn-risk</code>.
          </p>
        </div>

        {topAtRisk && (
          <Link
            href={`/customers/${topAtRisk.customer_id}`}
            className="flex items-center gap-2 rounded-xl bg-rose-950/60 border border-rose-800/80 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 transition-all shadow-lg shadow-rose-950/50"
          >
            <ShieldAlert size={14} className="text-rose-400" />
            <span>Inspect Top At-Risk Customer ({formatShortUUID(topAtRisk.customer_id)}) →</span>
          </Link>
        )}
      </div>

      {/* ADR-005 Explanation Banner */}
      <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-4 flex items-start gap-3">
        <Info size={18} className="text-cyan-400 mt-0.5 shrink-0" />
        <div className="space-y-1 text-xs text-slate-300">
          <p className="font-semibold text-white">
            Architecture Decision ADR-005 Churn Definition:
          </p>
          <p className="leading-relaxed">
            A customer is classified as <strong>Churned</strong> when they encounter an{" "}
            <strong>unresolved escalation</strong> followed by <strong>30+ consecutive days of inactivity</strong> across all stitched channels. Standard cart abandonments without unresolved escalations (e.g. Bob) are classified as drop-offs, not churn.
          </p>
        </div>
      </div>

      {/* KPI Cards — 100% Dynamic */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="At-Risk Customers"
          value={data.length}
          subtitle="Customers meeting ADR-005 criteria"
          icon={AlertOctagon}
          accentColor="rose"
        />
        <MetricCard
          title="Peak Risk Score"
          value={peakScore > 0 ? peakScore.toFixed(2) : "—"}
          subtitle="Highest churn probability"
          icon={ShieldAlert}
          accentColor="amber"
        />
        <MetricCard
          title="Avg Silence Window"
          value={avgInactivity > 0 ? `${avgInactivity} Days` : "—"}
          subtitle="Cross-channel inactivity period"
          icon={Clock}
          accentColor="purple"
        />
      </div>

      {/* Churn Risk Ranked Table — 100% Dynamic */}
      <div className="rounded-xl border border-[#1e293b] bg-[#0c121e] shadow-xl overflow-hidden space-y-4">
        <div className="p-4 border-b border-[#1e293b] bg-[#080d16] flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Ranked Customer Churn Threat Index ({data.length})
          </h3>
          <span className="text-[11px] text-slate-400">Model: Rule-based + Timeline Heuristic (ADR-005)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
            <RefreshCw size={16} className="animate-spin text-rose-400" />
            <span className="text-xs">Querying churn risk records...</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1e293b] bg-[#080d16]/50 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3 font-semibold">Customer ID</th>
                <th className="px-5 py-3 font-semibold">Risk Meter</th>
                <th className="px-5 py-3 font-semibold">Contributing Factors</th>
                <th className="px-5 py-3 font-semibold">Inactivity Duration</th>
                <th className="px-5 py-3 text-right font-semibold">Investigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]/60">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No customers currently meeting ADR-005 churn risk thresholds.
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const days = row.details?.days_inactive;
                  const pct = Math.round(row.score * 100);
                  const rule = row.details?.rule || "Unresolved escalation followed by 30+ days silence";
                  return (
                    <tr key={row.customer_id} className="hover:bg-slate-900/40 transition-colors bg-rose-950/10">
                      <td className="px-5 py-3 font-mono text-slate-200">
                        <div className="flex items-center gap-2">
                          <span title={row.customer_id}>{formatShortUUID(row.customer_id)}</span>
                          <span className="rounded bg-rose-950/80 px-1.5 py-0.2 text-[10px] font-bold text-rose-400 border border-rose-800">
                            High Risk
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-rose-400 text-xs">
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-300 max-w-xs">
                        <div className="flex items-center gap-1.5 text-amber-300">
                          <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                          <span className="truncate" title={String(rule)}>{String(rule)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-300">
                        {days !== undefined ? `${days} days silence` : "30+ days"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/customers/${row.customer_id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-600/30 transition-all"
                        >
                          <span>Inspect Stitched Timeline</span>
                          <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
