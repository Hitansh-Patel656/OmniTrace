import React from "react";
import { Channel } from "@/lib/types";
import { CHANNEL_CONFIG } from "@/lib/formatters";
import { Globe, Smartphone, Headphones, Store } from "lucide-react";

interface Props {
  channel: Channel;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export const ChannelBadge: React.FC<Props> = ({
  channel,
  size = "md",
  showIcon = true,
}) => {
  const config = CHANNEL_CONFIG[channel] || {
    label: channel,
    badgeBg: "bg-slate-900/60",
    badgeText: "text-slate-400",
    badgeBorder: "border-slate-800",
    dotBg: "bg-slate-400",
  };

  const getIcon = () => {
    const iconSize = size === "sm" ? 11 : size === "lg" ? 16 : 13;
    switch (channel) {
      case "web":
        return <Globe size={iconSize} className="shrink-0" />;
      case "mobile_app":
        return <Smartphone size={iconSize} className="shrink-0" />;
      case "call_center":
        return <Headphones size={iconSize} className="shrink-0" />;
      case "in_person":
        return <Store size={iconSize} className="shrink-0" />;
      default:
        return <Globe size={iconSize} className="shrink-0" />;
    }
  };

  const sizeClasses = {
    sm: "text-[11px] px-2 py-0.5 gap-1.5 font-medium",
    md: "text-xs px-2.5 py-1 gap-1.5 font-medium",
    lg: "text-sm px-3 py-1.5 gap-2 font-semibold",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border backdrop-blur-sm ${config.badgeBg} ${config.badgeText} ${config.badgeBorder} ${sizeClasses[size]}`}
    >
      {showIcon && getIcon()}
      <span>{config.label}</span>
    </span>
  );
};
