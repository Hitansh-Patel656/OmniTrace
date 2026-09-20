import React from "react";
import { ShieldCheck, Cpu } from "lucide-react";

interface Props {
  score: number; // 0.0 to 1.0
  showPercent?: boolean;
}

export const ConfidenceScore: React.FC<Props> = ({ score, showPercent = true }) => {
  const percent = Math.round(score * 100);
  const isDeterministic = score >= 0.99;

  if (isDeterministic) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/70 text-emerald-400 border border-emerald-800/80">
        <ShieldCheck size={12} className="shrink-0 text-emerald-400" />
        <span>Deterministic</span>
        {showPercent && <span className="text-emerald-500/80 font-mono text-[11px]">(100%)</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-950/70 text-purple-300 border border-purple-800/80">
      <Cpu size={12} className="shrink-0 text-purple-400" />
      <span>Probabilistic</span>
      {showPercent && (
        <span className="text-purple-400/90 font-mono text-[11px]">({percent}%)</span>
      )}
    </span>
  );
};
