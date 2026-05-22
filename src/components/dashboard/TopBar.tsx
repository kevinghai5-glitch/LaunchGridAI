"use client";

import { Bell, Search, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface TopBarProps {
  title: string;
  subtitle?: string;
  status?: string;
}

export function TopBar({
  title,
  subtitle,
  status = "Google Places API: connected",
}: TopBarProps) {
  return (
    <div
      className="flex items-center justify-between sticky top-0 z-20"
      style={{
        height: 52,
        borderBottom: "1px solid var(--border)",
        background: "var(--bg)",
        padding: "0 24px",
        gap: 16,
      }}
    >
      <div className="flex items-center" style={{ gap: 16 }}>
        <div className="flex items-baseline" style={{ gap: 10 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <div
          className="flex items-center whitespace-nowrap"
          style={{
            gap: 7,
            padding: "4px 10px",
            fontSize: 11.5,
            color: "var(--text-muted)",
            background: "var(--surface-active)",
            border: "1px solid var(--border)",
            borderRadius: 99,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              background: "var(--success)",
            }}
          />
          {status}
        </div>
      </div>

      <div className="relative" style={{ flex: "0 1 320px" }}>
        <Search
          size={14}
          strokeWidth={1.75}
          style={{
            position: "absolute",
            top: "50%",
            left: 10,
            transform: "translateY(-50%)",
            color: "var(--text-subtle)",
            pointerEvents: "none",
          }}
        />
        <input
          placeholder="Search businesses, proposals, deals…"
          style={{
            width: "100%",
            height: 32,
            padding: "0 12px 0 32px",
            fontSize: 12.5,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            color: "var(--text)",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <span
          style={{
            position: "absolute",
            top: "50%",
            right: 8,
            transform: "translateY(-50%)",
            fontSize: 10.5,
            color: "var(--text-subtle)",
            fontFamily: "var(--font-mono), monospace",
            background: "var(--surface-active)",
            padding: "1px 5px",
            borderRadius: 4,
            border: "1px solid var(--border)",
          }}
        >
          ⌘K
        </span>
      </div>

      <div className="flex items-center" style={{ gap: 6 }}>
        <ThemeToggle />
        <IconButton ariaLabel="Notifications">
          <Bell size={15} strokeWidth={1.75} />
        </IconButton>
        <IconButton ariaLabel="Settings">
          <Settings size={15} strokeWidth={1.75} />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  children,
  ariaLabel,
}: {
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="grid place-items-center cursor-pointer"
      style={{
        width: 32,
        height: 32,
        padding: 0,
        background: "transparent",
        border: "none",
        color: "var(--text-muted)",
        borderRadius: "var(--radius-sm)",
        transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--surface-active)";
        (e.currentTarget as HTMLElement).style.color = "var(--text)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
      }}
    >
      {children}
    </button>
  );
}
