"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ChevronDown,
  Check,
  LogOut,
  Home,
  Target,
  Workflow,
  FileText,
  Library,
  PhoneCall,
  CalendarDays,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";

// Neutral "clear" accent used across the sidebar in place of the old blue.
const SB_BRIGHT = "var(--text)"; // strongest ink — near-white in dark, near-black in light
const SB_ON_BRIGHT = "var(--secondary-foreground)"; // ink for a --secondary bright fill

// SIDEBAR OVERLAY LADDER. The sidebar canvas (--sidebar, #1f1e1d) sits BELOW the
// card in the surface ladder, so the opaque card tokens (--surface-2 / -hi) are
// too bright to use as its hover steps — and there are three distinct levels
// here (resting-emphasised < hover < active) that a single token would collapse.
// These stay proportional overlays, but of --text rather than literal white, so
// they invert correctly with the theme instead of being white forever.
const sbTint = (pct: number) => `color-mix(in oklab, var(--text) ${pct}%, transparent)`;
const SB_EMPHASIS_BG = sbTint(2.5);
const SB_HOVER_BG = sbTint(5);
const SB_ACTIVE_BG = sbTint(7);

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badgeKey?: "opportunities" | "pipeline" | "proposals";
  primary?: boolean;
};

// Ordered by the actual deal workflow: start → find a prospect → build the
// deliverable → reach out and close.
const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Overview",
    items: [{ id: "dashboard", label: "Home", icon: Home, href: "/dashboard" }],
  },
  {
    heading: "Find & Build",
    items: [
      { id: "businesses", label: "Opportunities", icon: Target, href: "/businesses", primary: true, badgeKey: "opportunities" },
      { id: "library", label: "Library", icon: Library, href: "/library" },
    ],
  },
  {
    heading: "Sell & Close",
    items: [
      { id: "call-queue", label: "Call Queue", icon: PhoneCall, href: "/call-queue" },
      { id: "calendar", label: "Calendar", icon: CalendarDays, href: "/calendar" },
      { id: "crm", label: "CRM", icon: Workflow, href: "/crm", badgeKey: "pipeline" },
      { id: "proposals", label: "Proposals", icon: FileText, href: "/proposals", badgeKey: "proposals" },
    ],
  },
];

interface SidebarProps {
  totalMRR: number;
  pipelineMRR: number;
  activeClients: number;
  opportunityCount: number;
  pipelineCount: number;
  proposalCount: number;
  userName: string;
  userPlan: string;
}

export function Sidebar({
  totalMRR,
  pipelineMRR,
  activeClients,
  opportunityCount,
  pipelineCount,
  proposalCount,
  userName,
  userPlan,
}: SidebarProps) {
  const badgeFor = (key?: NavItem["badgeKey"]): number | undefined => {
    if (key === "opportunities") return opportunityCount;
    if (key === "pipeline") return pipelineCount;
    if (key === "proposals") return proposalCount;
    return undefined;
  };
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
  const [collapsed, setCollapsed] = useState(false);
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
  const wsRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Restore persisted layout prefs.
  useEffect(() => {
    try {
      if (localStorage.getItem("lg-sidebar-collapsed") === "1") setCollapsed(true);
      const cg = localStorage.getItem("lg-sidebar-groups");
      if (cg) setClosedGroups(JSON.parse(cg));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("lg-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
    setWsOpen(false);
    setUserOpen(false);
  };

  const toggleGroup = (heading: string) => {
    setClosedGroups((prev) => {
      const next = { ...prev, [heading]: !prev[heading] };
      try {
        localStorage.setItem("lg-sidebar-groups", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

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
        width: collapsed ? 68 : 232,
        background: "var(--sidebar)",
        borderRight: "1px solid var(--line)",
        padding: collapsed ? "22px 12px 18px" : "22px 14px 18px",
        height: "100vh",
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), padding 0.22s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* header: logo + collapse toggle */}
      <div
        className="flex items-center"
        style={{
          justifyContent: collapsed ? "center" : "space-between",
          padding: collapsed ? "2px 0" : "2px 4px 2px 8px",
          marginBottom: 18,
        }}
      >
        {!collapsed && (
          <Link href="/" aria-label="ReclaimedHQ OS home">
            <Logo textOnly />
          </Link>
        )}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid place-items-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-3)",
            transition: "background var(--t), color var(--t)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = SB_HOVER_BG;
            (e.currentTarget as HTMLElement).style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
          }}
        >
          {collapsed ? (
            <PanelLeftOpen size={17} strokeWidth={1.85} />
          ) : (
            <PanelLeftClose size={17} strokeWidth={1.85} />
          )}
        </button>
      </div>

      {/* workspace switcher */}
      {!collapsed ? (
        <div ref={wsRef} className="relative" style={{ marginBottom: 14 }}>
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
              padding: "8px 10px",
              background: wsOpen ? SB_HOVER_BG : "transparent",
              border: "1px solid transparent",
              borderRadius: 10,
              cursor: "pointer",
              transition: "background var(--t)",
              fontFamily: "inherit",
              color: "inherit",
              width: "100%",
            }}
            onMouseEnter={(e) => {
              if (!wsOpen)
                (e.currentTarget as HTMLElement).style.background = SB_EMPHASIS_BG;
            }}
            onMouseLeave={(e) => {
              if (!wsOpen) (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <div
              className="grid place-items-center"
              style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                background: "var(--surface-hi)",
                color: "var(--text-2)",
                fontSize: 10.5,
                fontWeight: 700,
              }}
            >
              {initials}
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {firstName}&apos;s Workspace
            </div>
            <ChevronDown
              size={12}
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
                  ((e.currentTarget as HTMLElement).style.background = "var(--surface-2)")
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
                    background: "var(--accent-fill)",
                    color: "var(--accent-fill-text)",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {initials}
                </div>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                  {firstName}&apos;s Workspace
                </span>
                <Check size={13} strokeWidth={2.5} style={{ color: SB_BRIGHT }} />
              </button>
            </Menu>
          )}
        </div>
      ) : (
        <div
          className="grid place-items-center"
          title={`${firstName}'s Workspace`}
          style={{
            width: 28,
            height: 28,
            margin: "0 auto 14px",
            borderRadius: 8,
            background: "var(--surface-hi)",
            color: "var(--text-2)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {initials}
        </div>
      )}

      <nav className="flex flex-col flex-1" style={{ gap: collapsed ? 8 : 18 }}>
        {NAV_GROUPS.map((group) => {
          const groupClosed = !collapsed && closedGroups[group.heading];
          return (
            <div key={group.heading} className="flex flex-col" style={{ gap: 2 }}>
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.heading)}
                  aria-expanded={!groupClosed}
                  className="flex items-center w-full"
                  style={{
                    gap: 5,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: "var(--text-4)",
                    padding: "0 11px",
                    marginBottom: 6,
                    transition: "color var(--t)",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = "var(--text-3)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = "var(--text-4)")
                  }
                >
                  <span style={{ flex: 1, textAlign: "left" }}>{group.heading}</span>
                  <ChevronDown
                    size={11}
                    strokeWidth={2}
                    style={{
                      transition: "transform var(--t)",
                      transform: groupClosed ? "rotate(-90deg)" : "rotate(0deg)",
                    }}
                  />
                </button>
              )}
              {!groupClosed &&
                group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname?.startsWith(item.href));
                  const Icon = item.icon;
                  const emphasized = item.primary && !active;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className="flex items-center whitespace-nowrap relative"
                      style={{
                        gap: 11,
                        padding: collapsed ? "9px 0" : "8px 11px",
                        justifyContent: collapsed ? "center" : "flex-start",
                        fontSize: 13.5,
                        fontWeight: active || item.primary ? 600 : 480,
                        background: active
                          ? SB_ACTIVE_BG
                          : emphasized
                          ? SB_EMPHASIS_BG
                          : "transparent",
                        color: active || emphasized ? "var(--text)" : "var(--text-2)",
                        borderRadius: 9,
                        textDecoration: "none",
                        transition: "background var(--t), color var(--t)",
                      }}
                      onMouseEnter={(e) => {
                        if (!active)
                          (e.currentTarget as HTMLElement).style.background = SB_HOVER_BG;
                        (e.currentTarget as HTMLElement).style.color = "var(--text)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active)
                          (e.currentTarget as HTMLElement).style.background = emphasized
                            ? SB_EMPHASIS_BG
                            : "transparent";
                        (e.currentTarget as HTMLElement).style.color =
                          active || emphasized ? "var(--text)" : "var(--text-2)";
                      }}
                    >
                      {active && (
                        <span
                          aria-hidden
                          style={{
                            position: "absolute",
                            left: collapsed ? -12 : -14,
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: 3,
                            height: 18,
                            borderRadius: "0 3px 3px 0",
                            background: "var(--accent-grad)",
                          }}
                        />
                      )}
                      <span className="relative" style={{ display: "grid", placeItems: "center" }}>
                        <Icon
                          size={16}
                          strokeWidth={active || item.primary ? 2.1 : 1.85}
                          style={{
                            flex: "none",
                            color: active ? "var(--accent)" : item.primary ? SB_BRIGHT : "var(--text-3)",
                          }}
                        />
                      </span>
                      {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>

      {/* Revenue snapshot */}
      {!collapsed ? (
        <div style={{ padding: "16px 11px 14px", borderTop: "1px solid var(--line)" }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--text-4)",
              marginBottom: 10,
            }}
          >
            Revenue
          </div>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 12 }}>
            <span
              className="lg-display tnum"
              style={{ fontSize: 25, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text)" }}
            >
              ${totalMRR.toLocaleString()}
              <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginLeft: 3 }}>
                /mo
              </span>
            </span>
            <span style={{ fontSize: 11, color: "var(--text-4)" }}>MRR</span>
          </div>
          <div className="flex flex-col" style={{ gap: 7 }}>
            <StatLine label="Pipeline value" value={`$${pipelineMRR.toLocaleString()}`} />
            <StatLine label="Active clients" value={activeClients.toLocaleString()} accent="money" />
          </div>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--line)", margin: "0 auto", paddingTop: 14 }} />
      )}

      {/* profile row */}
      <div ref={userRef} className="relative" style={{ marginTop: 4 }}>
        <button
          className="flex items-center text-left"
          aria-haspopup="menu"
          aria-expanded={userOpen}
          title={collapsed ? userName : undefined}
          onClick={() => {
            setUserOpen((v) => !v);
            setWsOpen(false);
          }}
          style={{
            padding: collapsed ? "8px 0" : "10px 6px",
            marginTop: 6,
            gap: 10,
            width: "100%",
            justifyContent: collapsed ? "center" : "flex-start",
            background: userOpen ? SB_HOVER_BG : "transparent",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "inherit",
            color: "inherit",
            transition: "background var(--t)",
          }}
          onMouseEnter={(e) => {
            if (!userOpen)
              (e.currentTarget as HTMLElement).style.background = SB_EMPHASIS_BG;
          }}
          onMouseLeave={(e) => {
            if (!userOpen) (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <div
            className="grid place-items-center flex-none"
            style={{
              width: 28,
              height: 28,
              borderRadius: 99,
              background: SB_ACTIVE_BG,
              color: SB_BRIGHT,
              fontSize: 11,
              fontWeight: 700,
              border: "1px solid var(--line)",
            }}
          >
            {initials}
          </div>
          {!collapsed && (
            <>
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
                size={14}
                strokeWidth={1.85}
                style={{
                  flex: "none",
                  color: "var(--text-3)",
                  transition: "transform var(--t)",
                  transform: userOpen ? "rotate(60deg)" : "rotate(0deg)",
                }}
              />
            </>
          )}
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
              style={{ ...menuItemStyle, color: "var(--danger)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "var(--danger-soft)")
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

function StatLine({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "money";
}) {
  return (
    <div className="flex justify-between items-center" style={{ fontSize: 11.5 }}>
      <span style={{ color: "var(--text-3)" }}>{label}</span>
      <span
        className="lg-mono tnum"
        style={{ color: accent === "money" ? "var(--money)" : "var(--text-2)", fontWeight: 500 }}
      >
        {value}
      </span>
    </div>
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
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        boxShadow: "var(--shadow-lg)",
        padding: 5,
        animation: "lg-menu-in 0.12s ease-out",
      }}
    >
      {children}
    </div>
  );
}
