"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// Shared Apple-Calendar-style date navigator: ‹  [label]  ›  · Today, with an
// optional Day/Week segmented control. Used by both the Call Queue and the
// Calendar so they read as one system.

export type CalScale = "day" | "week";

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Sunday-start week (matches Apple Calendar's default).
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function DateNav({
  date,
  onChange,
  scale,
  onScaleChange,
}: {
  date: Date;
  onChange: (d: Date) => void;
  /** When provided, renders the Day/Week segmented control. */
  scale?: CalScale;
  onScaleChange?: (s: CalScale) => void;
}) {
  const step = scale === "week" ? 7 : 1;
  const today = new Date();
  const atToday =
    scale === "week"
      ? isSameDay(startOfWeek(date), startOfWeek(today))
      : isSameDay(date, today);

  const label =
    scale === "week"
      ? weekLabel(date)
      : date.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: isSameDay(startOfDay(date), startOfDay(today)) ? undefined : "numeric",
        });

  return (
    <div className="flex items-center" style={{ gap: 10 }}>
      <div
        className="flex items-center"
        style={{
          gap: 2,
          background: "var(--surface)",
          border: "1px solid var(--line-strong)",
          borderRadius: 10,
          padding: 2,
        }}
      >
        <NavBtn ariaLabel="Previous" onClick={() => onChange(addDays(date, -step))}>
          <ChevronLeft size={16} strokeWidth={2} />
        </NavBtn>
        <button
          onClick={() => onChange(new Date())}
          style={{
            padding: "5px 14px",
            fontSize: 12.5,
            fontWeight: 600,
            color: atToday ? "var(--text)" : "var(--text-2)",
            background: atToday ? "var(--surface-hi)" : "transparent",
            border: "none",
            borderRadius: 7,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "background var(--t), color var(--t)",
          }}
        >
          Today
        </button>
        <NavBtn ariaLabel="Next" onClick={() => onChange(addDays(date, step))}>
          <ChevronRight size={16} strokeWidth={2} />
        </NavBtn>
      </div>

      <div
        className="lg-display"
        style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text)" }}
      >
        {label}
      </div>

      {scale && onScaleChange && (
        <div
          className="flex items-center"
          style={{
            marginLeft: "auto",
            gap: 2,
            background: "var(--surface)",
            border: "1px solid var(--line-strong)",
            borderRadius: 10,
            padding: 2,
          }}
        >
          <ScaleBtn active={scale === "day"} onClick={() => onScaleChange("day")}>
            Day
          </ScaleBtn>
          <ScaleBtn active={scale === "week"} onClick={() => onScaleChange("week")}>
            Week
          </ScaleBtn>
        </div>
      )}
    </div>
  );
}

function weekLabel(date: Date): string {
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endStr = end.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

function NavBtn({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      className="grid place-items-center"
      style={{
        width: 30,
        height: 28,
        borderRadius: 7,
        background: "transparent",
        border: "none",
        color: "var(--text-2)",
        cursor: "pointer",
        transition: "background var(--t), color var(--t)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--surface-hi)";
        (e.currentTarget as HTMLElement).style.color = "var(--text)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = "var(--text-2)";
      }}
    >
      {children}
    </button>
  );
}

function ScaleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 13px",
        fontSize: 12.5,
        fontWeight: 600,
        color: active ? "var(--text)" : "var(--text-3)",
        background: active ? "var(--surface-hi)" : "transparent",
        border: "none",
        borderRadius: 7,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background var(--t), color var(--t)",
      }}
    >
      {children}
    </button>
  );
}
