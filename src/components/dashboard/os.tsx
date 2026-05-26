"use client";

import * as React from "react";

/* ── Surface — solid card */
export function Surface({
  children,
  style,
  hover,
  padded = 20,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean; padded?: number }) {
  return (
    <div
      {...rest}
      className={`surface ${hover ? "hover-lift" : ""} ${className ?? ""}`}
      style={{ padding: padded, ...style }}
    >
      {children}
    </div>
  );
}

/* ── Pill */
type Tone = "neutral" | "accent" | "money" | "warn" | "danger";
const PILL_TONE: Record<Tone, { c: string; bg: string; b: string }> = {
  neutral: { c: "var(--text-2)", bg: "rgba(255,255,255,0.04)", b: "var(--line-strong)" },
  accent: { c: "oklch(0.85 0.13 248)", bg: "var(--accent-soft)", b: "oklch(0.55 0.18 248 / 0.35)" },
  money: { c: "oklch(0.85 0.13 158)", bg: "var(--money-soft)", b: "oklch(0.55 0.16 158 / 0.30)" },
  warn: { c: "oklch(0.85 0.13 75)", bg: "var(--warn-soft)", b: "oklch(0.55 0.14 75 / 0.30)" },
  danger: { c: "oklch(0.82 0.16 25)", bg: "var(--danger-soft)", b: "oklch(0.55 0.16 25 / 0.30)" },
};

export function Pill({
  tone = "neutral",
  children,
  dot,
  style,
}: {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  style?: React.CSSProperties;
}) {
  const t = PILL_TONE[tone];
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 6,
        padding: "3px 8px",
        fontSize: 11,
        fontWeight: 600,
        background: t.bg,
        color: t.c,
        border: `1px solid ${t.b}`,
        borderRadius: 99,
        lineHeight: 1.3,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {dot && <span className="live-dot" style={{ color: t.c, width: 5, height: 5 }} />}
      {children}
    </span>
  );
}

/* ── PanelHeader */
export function PanelHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: "22px 24px 18px", gap: 12 }}
    >
      <div>
        <h3
          className="lg-display"
          style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em" }}
        >
          {title}
        </h3>
        {sub && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>{sub}</div>}
      </div>
      {right && <div className="flex items-center" style={{ gap: 8 }}>{right}</div>}
    </div>
  );
}

/* ── Spark — tiny svg sparkline */
export function Spark({
  data,
  color = "var(--accent)",
  w = 80,
  h = 24,
  fill = true,
}: {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
  fill?: boolean;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const r = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / r) * (h - 2) - 1,
  ]);
  const d = pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");
  const dFill = `${d} L ${w} ${h} L 0 ${h} Z`;
  const id = React.useId().replace(/[:]/g, "");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={dFill} fill={`url(#${id})`} />}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

/* ── Stars */
export function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span
      className="inline-flex items-center"
      style={{ gap: 4, color: "oklch(0.82 0.14 75)" }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
      </svg>
      <span className="lg-mono tnum" style={{ fontWeight: 600, fontSize: 12, color: "var(--text)" }}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

/* ── countUp hook */
export function useCountUp(target: number, dur = 900) {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return val;
}

/* ── KpiCard — quiet metric tile */
export function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color?: "money";
}) {
  const c = color === "money" ? "var(--money)" : "var(--text)";
  return (
    <Surface style={{ padding: "24px 26px" }}>
      <div style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 12 }}>{label}</div>
      <div
        className="lg-display tnum"
        style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.025em", color: c, lineHeight: 1 }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>{sub}</div>
    </Surface>
  );
}
