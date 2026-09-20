import React from "react";
import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive?: boolean;
  };
  accentColor?: "indigo" | "emerald" | "amber" | "rose" | "cyan" | "purple";
}

export const MetricCard: React.FC<Props> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accentColor = "indigo",
}) => {
  const accentStyles = {
    indigo: {
      border: "border-indigo-900/40 hover:border-indigo-700/60",
      iconBg: "bg-indigo-950/70 text-indigo-400",
      glow: "hover:shadow-[0_0_25px_-5px_rgba(99,102,241,0.25)]",
    },
    emerald: {
      border: "border-emerald-900/40 hover:border-emerald-700/60",
      iconBg: "bg-emerald-950/70 text-emerald-400",
      glow: "hover:shadow-[0_0_25px_-5px_rgba(16,185,129,0.25)]",
    },
    amber: {
      border: "border-amber-900/40 hover:border-amber-700/60",
      iconBg: "bg-amber-950/70 text-amber-400",
      glow: "hover:shadow-[0_0_25px_-5px_rgba(245,158,11,0.25)]",
    },
    rose: {
      border: "border-rose-900/40 hover:border-rose-700/60",
      iconBg: "bg-rose-950/70 text-rose-400",
      glow: "hover:shadow-[0_0_25px_-5px_rgba(244,63,94,0.25)]",
    },
    cyan: {
      border: "border-cyan-900/40 hover:border-cyan-700/60",
      iconBg: "bg-cyan-950/70 text-cyan-400",
      glow: "hover:shadow-[0_0_25px_-5px_rgba(56,189,248,0.25)]",
    },
    purple: {
      border: "border-purple-900/40 hover:border-purple-700/60",
      iconBg: "bg-purple-950/70 text-purple-400",
      glow: "hover:shadow-[0_0_25px_-5px_rgba(168,85,247,0.25)]",
    },
  }[accentColor];

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-[#0c121e]/90 border p-5 backdrop-blur-md transition-all duration-200 ${accentStyles.border} ${accentStyles.glow}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white font-mono">{value}</span>
            {trend && (
              <span
                className={`text-xs font-medium ${
                  trend.positive ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {trend.value}
              </span>
            )}
          </div>
        </div>
        <div className={`rounded-lg p-2.5 ${accentStyles.iconBg}`}>
          <Icon size={20} />
        </div>
      </div>
      {subtitle && <p className="mt-3 text-xs text-slate-400 line-clamp-1">{subtitle}</p>}
    </div>
  );
};
