"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Flame,
  ArrowRight,
  AlertOctagon,
  BarChart3,
  Sparkles,
  RefreshCw,
  Headphones,
  Globe,
  Smartphone,
  Store,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { EscalationItem, Channel } from "@/lib/types";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChannelBadge } from "@/components/ui/ChannelBadge";

const CHANNEL_META: Record<
  Channel,
  { name: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  web: { name: "Web Browser", icon: Globe },
  mobile_app: { name: "Mobile App", icon: Smartphone },
  call_center: { name: "Call Center", icon: Headphones },
  in_person: { name: "In-Person Store", icon: Store },
};

export default function EscalationsPage() {
  const [data, setData] = useState<EscalationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEscalations = async () => {
    setLoading(true);
    try {
      const res = await api.getEscalations();
      setData(res.data || []);
    } catch (err) {
      console.error("Failed to load escalations:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEscalations();
  }, []);

  const totalEscalations = data.reduce((sum, d) => sum + Number(d.escalation_count), 0);

  const byChannel = data.reduce<Record<string, number>>((acc, item) => {
    acc[item.channel] = (acc[item.channel] || 0) + Number(item.escalation_count);
    return acc;
  }, {});
  const topChannel = Object.entries(byChannel).sort((a, b) => b[1] - a[1])[0];

  const byDay = data.reduce<Record<string, EscalationItem[]>>((acc, item) => {
    const day = item.day ? item.day.split("T")[0] : "Unknown";
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});
  const sortedDays = Object.keys(byDay).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b]/70 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
            <Flame size={14} />
            <span>Support Escalation Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Escalation Incidents
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Tier-2 escalations detected across all channels. Each entry represents a customer
            interaction that exceeded first-line resolution capacity.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={loadEscalations}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1e293b] bg-[#0c121e] text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <Link
            href="/customers"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-700/60 to-rose-700/60 border border-amber-700/50 text-xs font-semibold text-amber-200 hover:brightness-110 transition-all"
          >
            <span>Customer Directory</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Total Escalations"
          value={loading ? "—" : totalEscalations}
          subtitle="Across all channels"
          icon={Flame}
          accentColor="amber"
        />
        <MetricCard
          title="Days With Escalations"
          value={loading ? "—" : sortedDays.length}
          subtitle="Distinct calendar days"
          icon={Calendar}
          accentColor="rose"
        />
        <MetricCard
          title="Top Escalation Channel"
          value={loading || !topChannel ? "—" : topChannel[0].replace(/_/g, " ")}
          subtitle={topChannel ? `${topChannel[1]} escalations` : "No data"}
          icon={TrendingUp}
          accentColor="indigo"
        />
      </div>

      {!loading && Object.keys(byChannel).length > 0 && (
        <div className="rounded-xl border border-[#1e293b] bg-[#0c121e]/80 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200 uppercase tracking-wider">
            <BarChart3 size={14} className="text-amber-400" />
            <span>Escalations by Channel</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(["call_center", "web", "mobile_app", "in_person"] as Channel[]).map((ch) => {
              const count = byChannel[ch] || 0;
              const Icon = CHANNEL_META[ch].icon;
              const pct = totalEscalations > 0 ? Math.round((count / totalEscalations) * 100) : 0;
              return (
                <div key={ch} className="rounded-lg bg-[#080d16] border border-[#1e293b]/70 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-slate-400" />
                    <span className="text-xs text-slate-400">{CHANNEL_META[ch].name}</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{count}</div>
                  <div className="text-[11px] text-slate-500">{pct}% of total</div>
                  <div className="h-1 rounded-full bg-[#1e293b] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-600 to-rose-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
          <Sparkles size={14} className="text-amber-400" />
          <span>Escalation Feed</span>
          <span className="ml-2 rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-normal text-slate-400">
            {data.length} records
          </span>
        </div>

        {loading ? (
          <div className="rounded-xl border border-[#1e293b] bg-[#0c121e]/80 p-12 flex items-center justify-center">
            <RefreshCw size={20} className="animate-spin text-slate-500 mr-3" />
            <span className="text-slate-400 text-sm">Loading escalation data…</span>
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-[#1e293b] bg-[#0c121e]/80 p-12 text-center">
            <AlertOctagon size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No escalation incidents found.</p>
            <p className="text-slate-500 text-xs mt-1">Run the engine benchmark to populate data.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {sortedDays.map((day) => (
              <div key={day}>
                <div className="flex items-center gap-3 mb-3">
                  <Calendar size={13} className="text-slate-500" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {new Date(day + "T00:00:00Z").toLocaleDateString("en-US", {
                      weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
                    })}
                  </span>
                  <div className="flex-1 h-px bg-[#1e293b]" />
                  <span className="text-[11px] text-slate-500">
                    {byDay[day].reduce((s, d) => s + Number(d.escalation_count), 0)} escalations
                  </span>
                </div>
                <div className="space-y-2">
                  {byDay[day].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-[#1e293b] bg-[#0c121e]/80 px-4 py-3 hover:border-amber-700/40 hover:bg-[#111927] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                        <ChannelBadge channel={item.channel} size="sm" />
                        <span className="text-xs text-slate-300 font-medium">
                          {item.channel.replace(/_/g, " ")} escalation
                        </span>
                      </div>
                      <span className="text-xs font-bold text-amber-300">x{item.escalation_count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
