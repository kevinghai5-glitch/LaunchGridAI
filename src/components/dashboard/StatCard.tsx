"use client";

import { useEffect, useRef, useState } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  sub?: string;
  trend?: string;
  tone?: "neutral" | "accent";
}

function useCountUp(target: number, dur = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return val;
}

export function StatCard({
  label,
  value,
  prefix = "",
  suffix = "",
  sub,
  trend,
  tone = "neutral",
}: StatCardProps) {
  const numeric = typeof value === "number";
  const display = useCountUp(numeric ? (value as number) : 0, 900);
  return (
    <div
      className="lg-hover-lift relative overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
      }}
    >
      {tone === "accent" && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 120,
            height: 120,
            background:
              "radial-gradient(circle at top right, var(--accent-soft), transparent 70%)",
            pointerEvents: "none",
          }}
        />
      )}
      <div className="relative">
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
          {label}
        </div>
        <div
          style={{
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-0.028em",
            marginTop: 6,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {numeric ? `${prefix}${display.toLocaleString()}${suffix}` : value}
        </div>
        <div
          className="flex justify-between items-center"
          style={{ marginTop: 10 }}
        >
          {sub && (
            <span style={{ fontSize: 12.5, color: "var(--text-subtle)" }}>{sub}</span>
          )}
          {trend && (
            <span
              style={{
                fontSize: 11.5,
                color: "var(--success)",
                fontWeight: 600,
              }}
            >
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
