import React from "react";
import { CheckCircle2, AlertTriangle, Clock, ArrowDownRight, Flame } from "lucide-react";

interface Props {
  type: "resolved" | "unresolved" | "pending" | "escalation" | "dropoff" | "churn";
  label?: string;
  size?: "sm" | "md";
}

export const StatusBadge: React.FC<Props> = ({ type, label, size = "md" }) => {
  const sizeClasses = size === "sm" ? "text-[10px] px-1.5 py-0.5 gap-1" : "text-xs px-2 py-0.5 gap-1.5";

  switch (type) {
    case "resolved":
      return (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 ${sizeClasses}`}
        >
          <CheckCircle2 size={12} className="shrink-0" />
          <span>{label || "Resolved"}</span>
        </span>
      );

    case "unresolved":
      return (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-rose-950/60 text-rose-400 border border-rose-800/60 ${sizeClasses}`}
        >
          <AlertTriangle size={12} className="shrink-0" />
          <span>{label || "Unresolved"}</span>
        </span>
      );

    case "pending":
      return (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-slate-900/80 text-slate-400 border border-slate-700/60 ${sizeClasses}`}
        >
          <Clock size={12} className="shrink-0" />
          <span>{label || "Pending"}</span>
        </span>
      );

    case "escalation":
      return (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-amber-950/70 text-amber-300 border border-amber-700/80 shadow-[0_0_8px_rgba(245,158,11,0.25)] ${sizeClasses}`}
        >
          <Flame size={12} className="shrink-0 text-amber-400 animate-pulse" />
          <span>{label || "Escalation"}</span>
        </span>
      );

    case "dropoff":
      return (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-rose-950/70 text-rose-300 border border-rose-700/80 shadow-[0_0_8px_rgba(244,63,94,0.25)] ${sizeClasses}`}
        >
          <ArrowDownRight size={12} className="shrink-0 text-rose-400" />
          <span>{label || "Drop-off"}</span>
        </span>
      );

    case "churn":
      return (
        <span
          className={`inline-flex items-center font-medium rounded-full bg-red-950/80 text-red-300 border border-red-700/90 shadow-[0_0_10px_rgba(239,68,68,0.3)] ${sizeClasses}`}
        >
          <AlertTriangle size={12} className="shrink-0 text-red-400" />
          <span>{label || "High Churn Risk"}</span>
        </span>
      );
  }
};
