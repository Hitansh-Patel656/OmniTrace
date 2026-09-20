"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GitFork,
  Flame,
  AlertOctagon,
  RefreshCw,
  Layers,
  Database,
  ArrowRight,
  Activity,
} from "lucide-react";
import { api } from "@/lib/api";
import { EngineStatus } from "@/lib/types";

const NAV_ITEMS = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    label: "Customer Explorer",
    href: "/customers",
    icon: Users,
    badge: "7 Seeded",
  },
  {
    label: "Drop-off Funnel",
    href: "/analytics/dropoffs",
    icon: GitFork,
    badge: null,
  },
  {
    label: "Escalation Trends",
    href: "/analytics/escalations",
    icon: Flame,
    badge: null,
  },
  {
    label: "Churn Risk Radar",
    href: "/analytics/churn",
    icon: AlertOctagon,
    badge: "ADR-005",
  },
  {
    label: "Repeat Contacts",
    href: "/analytics/repeat",
    icon: RefreshCw,
    badge: "Threshold",
  },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        const s = await api.getEngineStatus();
        if (mounted) setEngineStatus(s);
      } catch {
        // Backend might be warming up
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#1e293b]/70 bg-[#080d16] backdrop-blur-xl">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-[#1e293b]/70 px-5">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 text-white shadow-[0_0_16px_rgba(99,102,241,0.4)]">
          <Layers size={20} className="shrink-0" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold tracking-tight text-white text-base">OmniTrace</span>
            <span className="rounded bg-indigo-950/80 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-300 border border-indigo-700/60">
              v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-none">Cross-Channel Stitching</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Observability
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
                isActive
                  ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                  : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  size={16}
                  className={`transition-colors ${
                    isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-300"
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                    isActive
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : "bg-slate-800/80 text-slate-400"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Engine & Pipeline Status Widget */}
      <div className="border-t border-[#1e293b]/70 p-4 space-y-3 bg-[#0a0f19]/70">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <Activity size={13} className="text-cyan-400" />
            <span>Stitching Engine</span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-telemetry-pulse" />
            Active
          </span>
        </div>

        <div className="rounded-lg bg-[#070b12] border border-[#1e293b]/60 p-2.5 space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Processed Events:</span>
            <span className="font-mono text-slate-200 font-semibold">
              {engineStatus?.processed ?? 47}
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-slate-400">Pending Ingest:</span>
            <span className="font-mono text-cyan-400 font-semibold">
              {engineStatus?.pending ?? 0}
            </span>
          </div>
          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-500"
              style={{
                width: `${
                  engineStatus && engineStatus.total > 0
                    ? Math.round((engineStatus.processed / engineStatus.total) * 100)
                    : 100
                }%`,
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Database size={11} /> Dual-Store (PG+Mongo)
          </span>
          <span className="text-[10px] text-slate-400">Port 3001</span>
        </div>
      </div>
    </aside>
  );
};
