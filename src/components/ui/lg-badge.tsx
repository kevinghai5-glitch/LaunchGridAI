import * as React from "react";
import { cn } from "@/lib/utils";

export type LgBadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

interface LgBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: LgBadgeTone;
}

const toneMap: Record<LgBadgeTone, React.CSSProperties> = {
  neutral: {
    background: "var(--surface-active)",
    color: "var(--text-muted)",
    border: "1px solid var(--border)",
  },
  accent: {
    background: "var(--accent-soft)",
    color: "var(--accent)",
    border: "1px solid color-mix(in oklch, var(--accent) 20%, transparent)",
  },
  success: {
    background: "var(--success-soft)",
    color: "var(--success)",
    border: "1px solid color-mix(in oklch, var(--success) 20%, transparent)",
  },
  warning: {
    background: "var(--warning-soft)",
    color: "color-mix(in oklch, var(--warning) 60%, black)",
    border: "1px solid color-mix(in oklch, var(--warning) 20%, transparent)",
  },
  danger: {
    background: "var(--danger-soft)",
    color: "var(--danger)",
    border: "1px solid color-mix(in oklch, var(--danger) 20%, transparent)",
  },
};

export function LgBadge({
  tone = "neutral",
  children,
  className,
  style,
  ...rest
}: LgBadgeProps) {
  return (
    <span
      {...rest}
      className={cn("inline-flex items-center", className)}
      style={{
        gap: 5,
        padding: "3px 8px",
        fontSize: 11.5,
        fontWeight: 600,
        borderRadius: 999,
        lineHeight: 1.4,
        ...toneMap[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
