"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Target,
  Sparkles,
  FileText,
  Columns3,
  ChevronDown,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";

const NAV_ITEMS: { id: string; label: string; icon: LucideIcon; href: string; hint: string }[] = [
  { id: "dashboard", label: "Home", icon: Home, href: "/dashboard", hint: "H" },
  { id: "businesses", label: "Opportunities", icon: Target, href: "/businesses", hint: "F" },
  { id: "studio", label: "Studio", icon: Sparkles, href: "/studio", hint: "S" },
  { id: "proposals", label: "Proposals", icon: FileText, href: "/proposals", hint: "P" },
  { id: "deals", label: "Pipeline", icon: Columns3, href: "/deals", hint: "K" },
];

interface SidebarProps {
  totalMRR: number;
  pipelineMRR: number;
  userName: string;
  userPlan: string;
}

export function Sidebar({ totalMRR, pipelineMRR, userName, userPlan }: SidebarProps) {
  const pathname = usePathname();
  const initials =
    userName
      .split(" ")
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "U";
  const firstName = userName.split(" ")[0] || "Operator";

  return (
    <aside
      className="flex flex-col flex-none sticky top-0"
      style={{
        width: 240,
        background: "var(--bg-deep)",
        borderRight: "1px solid var(--line)",
        padding: "20px 16px 18px",
        height: "100vh",
      }}
    >
      <div style={{ padding: "2px 6px 4px", marginBottom: 22 }}>
        <Link href="/" aria-label="LaunchGrid OS home">
          <Logo />
        </Link>
      </div>

      {/* workspace switcher */}
      <button
        className="flex items-center w-full text-left"
        style={{
          gap: 10,
          padding: "9px 10px",
          marginBottom: 24,
          background: "transparent",
          border: "1px solid var(--line)",
          borderRadius: 10,
          cursor: "pointer",
          transition: "background var(--t)",
          fontFamily: "inherit",
          color: "inherit",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "transparent")
        }
      >
        <div
          className="grid place-items-center"
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "oklch(0.50 0.10 60)",
            color: "white",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {firstName}&apos;s Workspace
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>Workspace</div>
        </div>
        <ChevronDown size={11} strokeWidth={1.75} style={{ color: "var(--text-3)" }} />
      </button>

      <nav className="flex flex-col flex-1" style={{ gap: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center whitespace-nowrap"
              style={{
                gap: 11,
                padding: "8px 11px",
                fontSize: 13.5,
                fontWeight: 500,
                background: active ? "rgba(255,255,255,0.04)" : "transparent",
                color: active ? "var(--text)" : "var(--text-2)",
                border: "1px solid transparent",
                borderRadius: 8,
                textDecoration: "none",
                transition: "background var(--t), color var(--t)",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-2)";
                }
              }}
            >
              <Icon
                size={15}
                strokeWidth={1.6}
                style={{ color: active ? "var(--text)" : "var(--text-3)", flex: "none" }}
              />
              <span style={{ flex: 1 }}>{item.label}</span>
              <span
                className="lg-mono"
                style={{ fontSize: 10, color: "var(--text-4)", opacity: 0.7 }}
              >
                {item.hint}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Active MRR */}
      <div style={{ padding: "16px 4px 12px", borderTop: "1px solid var(--line)" }}>
        <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 6 }}>Active MRR</div>
        <div
          className="lg-display tnum"
          style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--text)" }}
        >
          ${totalMRR.toLocaleString()}
          <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginLeft: 3 }}>
            /mo
          </span>
        </div>
        <div
          className="flex justify-between"
          style={{ marginTop: 10, fontSize: 11.5 }}
        >
          <span style={{ color: "var(--text-3)" }}>In pipeline</span>
          <span className="lg-mono tnum" style={{ color: "var(--text-2)", fontWeight: 500 }}>
            ${pipelineMRR.toLocaleString()}
          </span>
        </div>
      </div>

      {/* profile row */}
      <div
        className="flex items-center"
        style={{
          padding: "12px 4px 0",
          borderTop: "1px solid var(--line)",
          gap: 10,
          cursor: "pointer",
        }}
      >
        <div
          className="grid place-items-center"
          style={{
            width: 26,
            height: 26,
            borderRadius: 99,
            background: "oklch(0.45 0.08 250)",
            color: "white",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {userName}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{userPlan}</div>
        </div>
        <Settings size={13} strokeWidth={1.6} style={{ color: "var(--text-3)" }} />
      </div>
    </aside>
  );
}
