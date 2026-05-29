"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home,
  Target,
  Sparkles,
  Library,
  FileText,
  Columns3,
  BookOpen,
  ChevronDown,
  Settings,
  Check,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";

const NAV_ITEMS: { id: string; label: string; icon: LucideIcon; href: string; hint: string }[] = [
  { id: "dashboard", label: "Home", icon: Home, href: "/dashboard", hint: "H" },
  { id: "businesses", label: "Opportunities", icon: Target, href: "/businesses", hint: "F" },
  { id: "studio", label: "Studio", icon: Sparkles, href: "/studio", hint: "S" },
  { id: "playbook", label: "Sales Playbook", icon: BookOpen, href: "/playbook", hint: "B" },
  { id: "library", label: "Library", icon: Library, href: "/library", hint: "L" },
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

  const [wsOpen, setWsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click or Escape.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) setWsOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWsOpen(false);
        setUserOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

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
      <div ref={wsRef} className="relative" style={{ marginBottom: 24 }}>
        <button
          className="flex items-center w-full text-left"
          aria-haspopup="menu"
          aria-expanded={wsOpen}
          onClick={() => {
            setWsOpen((v) => !v);
            setUserOpen(false);
          }}
          style={{
            gap: 10,
            padding: "9px 10px",
            background: wsOpen ? "rgba(255,255,255,0.04)" : "transparent",
            border: "1px solid var(--line)",
            borderRadius: 10,
            cursor: "pointer",
            transition: "background var(--t)",
            fontFamily: "inherit",
            color: "inherit",
            width: "100%",
          }}
          onMouseEnter={(e) => {
            if (!wsOpen)
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
          }}
          onMouseLeave={(e) => {
            if (!wsOpen) (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
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
          <ChevronDown
            size={11}
            strokeWidth={1.75}
            style={{
              color: "var(--text-3)",
              transition: "transform var(--t)",
              transform: wsOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>
        {wsOpen && (
          <Menu>
            <MenuLabel>Workspace</MenuLabel>
            <button
              className="flex items-center w-full text-left"
              onClick={() => setWsOpen(false)}
              style={menuItemStyle}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "transparent")
              }
            >
              <div
                className="grid place-items-center flex-none"
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
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                {firstName}&apos;s Workspace
              </span>
              <Check size={13} strokeWidth={2.5} style={{ color: "var(--accent)" }} />
            </button>
          </Menu>
        )}
      </div>

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
      <div ref={userRef} className="relative" style={{ borderTop: "1px solid var(--line)" }}>
        <button
          className="flex items-center w-full text-left"
          aria-haspopup="menu"
          aria-expanded={userOpen}
          onClick={() => {
            setUserOpen((v) => !v);
            setWsOpen(false);
          }}
          style={{
            padding: "10px 6px",
            marginTop: 6,
            gap: 10,
            width: "100%",
            background: userOpen ? "rgba(255,255,255,0.04)" : "transparent",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "inherit",
            color: "inherit",
            transition: "background var(--t)",
          }}
          onMouseEnter={(e) => {
            if (!userOpen)
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
          }}
          onMouseLeave={(e) => {
            if (!userOpen) (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <div
            className="grid place-items-center flex-none"
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
                color: "var(--text)",
              }}
            >
              {userName}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>{userPlan}</div>
          </div>
          <Settings
            size={13}
            strokeWidth={1.6}
            style={{
              color: "var(--text-3)",
              transition: "transform var(--t)",
              transform: userOpen ? "rotate(60deg)" : "rotate(0deg)",
            }}
          />
        </button>
        {userOpen && (
          <Menu up>
            <div style={{ padding: "8px 10px 6px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{userName}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                {userPlan} plan
              </div>
            </div>
            <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
            <button
              className="flex items-center w-full text-left"
              onClick={() => signOut({ callbackUrl: "/" })}
              style={{ ...menuItemStyle, color: "var(--danger, #f87171)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.10)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "transparent")
              }
            >
              <LogOut size={14} strokeWidth={1.75} style={{ flex: "none" }} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Sign out</span>
            </button>
          </Menu>
        )}
      </div>
    </aside>
  );
}

const menuItemStyle: React.CSSProperties = {
  gap: 10,
  padding: "8px 10px",
  background: "transparent",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: "inherit",
  color: "var(--text-2)",
  width: "100%",
  transition: "background var(--t)",
};

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--text-4)",
        padding: "8px 10px 4px",
      }}
    >
      {children}
    </div>
  );
}

function Menu({ children, up }: { children: React.ReactNode; up?: boolean }) {
  return (
    <div
      role="menu"
      style={{
        position: "absolute",
        ...(up ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }),
        left: 0,
        right: 0,
        zIndex: 50,
        background: "var(--surface, #16181d)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
        padding: 5,
        animation: "lg-menu-in 0.12s ease-out",
      }}
    >
      {children}
    </div>
  );
}
