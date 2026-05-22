"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  Sparkles,
  FileText,
  Columns3,
  ChevronRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";

const NAV_ITEMS = [
  { id: "dashboard", label: "Home", icon: Home, href: "/dashboard" },
  { id: "businesses", label: "Find Businesses", icon: Search, href: "/businesses" },
  { id: "studio", label: "AI Studio", icon: Sparkles, href: "/studio" },
  { id: "proposals", label: "Proposals", icon: FileText, href: "/proposals" },
  { id: "deals", label: "Pipeline", icon: Columns3, href: "/deals" },
];

interface SidebarProps {
  totalMRR: number;
  userName: string;
  userPlan: string;
}

export function Sidebar({ totalMRR, userName, userPlan }: SidebarProps) {
  const pathname = usePathname();
  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <aside
      className="flex flex-col flex-none sticky top-0"
      style={{
        width: 232,
        background: "var(--sidebar)",
        borderRight: "1px solid var(--border)",
        padding: "18px 12px",
        height: "100vh",
      }}
    >
      <Link
        href="/"
        className="cursor-pointer text-left"
        style={{ padding: "4px 8px", marginBottom: 20 }}
      >
        <Logo />
      </Link>

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
              className="flex items-center relative whitespace-nowrap"
              style={{
                gap: 10,
                padding: "8px 10px",
                fontSize: 13.5,
                fontWeight: 500,
                background: active ? "var(--surface)" : "transparent",
                color: active ? "var(--text)" : "var(--text-muted)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                textDecoration: "none",
                boxShadow: active ? "var(--shadow-sm)" : "none",
                transition: "background 0.2s, color 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--surface-active)";
              }}
              onMouseLeave={(e) => {
                if (!active)
                  (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: -8,
                    top: 8,
                    bottom: 8,
                    width: 3,
                    background: "var(--accent)",
                    borderRadius: "0 3px 3px 0",
                    transformOrigin: "left center",
                    animation: "lg-active-bar 0.32s cubic-bezier(0.2, 0.7, 0.3, 1) both",
                    boxShadow:
                      "0 0 12px color-mix(in oklch, var(--accent) 50%, transparent)",
                  }}
                />
              )}
              <Icon
                size={15}
                strokeWidth={1.75}
                style={{
                  color: active ? "var(--accent)" : "currentColor",
                  transition: "color 0.2s",
                  flex: "none",
                }}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        className="flex flex-col"
        style={{ gap: 12, paddingTop: 14, borderTop: "1px solid var(--border)" }}
      >
        <div
          style={{
            padding: "12px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--text-subtle)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            MRR this month
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.022em",
              marginTop: 2,
              color: "var(--text)",
            }}
          >
            ${totalMRR.toLocaleString()}
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              /mo
            </span>
          </div>
        </div>
        <button
          className="flex items-center w-full"
          style={{
            gap: 10,
            padding: "8px 6px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            color: "var(--text)",
          }}
        >
          <div
            className="grid place-items-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 99,
              background: "color-mix(in oklch, var(--accent) 30%, var(--accent-soft))",
              color: "var(--accent)",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--font-sans), sans-serif",
              flex: "none",
            }}
          >
            {initials || "U"}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {userName}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{userPlan}</div>
          </div>
          <ChevronRight
            size={12}
            strokeWidth={1.75}
            style={{ color: "var(--text-subtle)" }}
          />
        </button>
      </div>
    </aside>
  );
}
