"use client";

import { Bell, ChevronRight, Search, Settings } from "lucide-react";

interface TopBarProps {
  title: string;
  /** Breadcrumb shown after the title (e.g. "Charleston, SC · Day Spa"). */
  subtitle?: string;
}

export function TopBar({ title, subtitle = "Today" }: TopBarProps) {
  return (
    <div
      className="flex items-center sticky top-0 z-30"
      style={{
        height: 60,
        padding: "0 32px",
        gap: 20,
        background: "rgba(12, 13, 16, 0.75)",
        borderBottom: "1px solid var(--line)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
      }}
    >
      <div className="flex items-center" style={{ gap: 10, minWidth: 220 }}>
        <div
          className="lg-display"
          style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}
        >
          {title}
        </div>
        {subtitle && (
          <>
            <ChevronRight size={11} strokeWidth={1.75} style={{ color: "var(--text-4)" }} />
            <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{subtitle}</div>
          </>
        )}
      </div>

      {/* center search */}
      <div className="flex justify-center" style={{ flex: 1 }}>
        <button
          className="flex items-center text-left"
          style={{
            width: "min(520px, 100%)",
            gap: 10,
            height: 34,
            padding: "0 14px",
            background: "rgba(255,255,255,0.025)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "background var(--t)",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)")
          }
        >
          <Search size={14} strokeWidth={1.75} style={{ color: "var(--text-3)" }} />
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>Search</span>
          <span style={{ flex: 1 }} />
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </button>
      </div>

      <div className="flex items-center justify-end" style={{ gap: 6, minWidth: 220 }}>
        <IconButton ariaLabel="Notifications" dot>
          <Bell size={15} strokeWidth={1.6} />
        </IconButton>
        <IconButton ariaLabel="Settings">
          <Settings size={15} strokeWidth={1.6} />
        </IconButton>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="lg-mono grid place-items-center"
      style={{
        minWidth: 18,
        height: 18,
        padding: "0 4px",
        fontSize: 10.5,
        color: "var(--text-3)",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--line-strong)",
        borderRadius: 4,
      }}
    >
      {children}
    </span>
  );
}

function IconButton({
  children,
  ariaLabel,
  dot,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  dot?: boolean;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="grid place-items-center cursor-pointer relative"
      style={{
        width: 32,
        height: 32,
        padding: 0,
        background: "transparent",
        border: "none",
        color: "var(--text-3)",
        borderRadius: 8,
        transition: "background var(--t), color var(--t)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
        (e.currentTarget as HTMLElement).style.color = "var(--text)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
      }}
    >
      {children}
      {dot && (
        <span
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 5,
            height: 5,
            borderRadius: 99,
            background: "var(--accent)",
          }}
        />
      )}
    </button>
  );
}
