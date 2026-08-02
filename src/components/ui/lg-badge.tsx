import * as React from "react";
import { cn } from "@/lib/utils";

export type LgBadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

interface LgBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: LgBadgeTone;
}

const toneMap: Record<LgBadgeTone, React.CSSProperties> = {
  neutral: {
    background: "var(--surface-hi)",
    color: "var(--text-2)",
    border: "1px solid transparent",
  },
  accent: {
    background: "var(--accent-grad)",
    // white on the gradient's deep end (#b05730) is 4.94:1 — passes AA
    color: "var(--accent-fill-text)",
    border: "1px solid transparent",
  },
  success: {
    background: "var(--success-soft)",
    color: "var(--success)",
    border: "1px solid transparent",
  },
  warning: {
    background: "var(--warning-soft)",
    color: "var(--warning)",
    border: "1px solid transparent",
  },
  danger: {
    background: "var(--danger-soft)",
    color: "var(--danger)",
    border: "1px solid transparent",
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
        padding: "4px 11px",
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 999,
        lineHeight: 1.3,
        letterSpacing: "-0.005em",
        ...toneMap[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
