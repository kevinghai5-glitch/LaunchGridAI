"use client";

// The dashboard's top bar. Three controls, all of them REAL:
//
//   · Search field — a button that opens the ⌘K command palette
//     (CommandPalette.tsx owns the actual input; this stays dumb).
//   · Bell — a live unread feed derived from rows that already record events
//     (proposal opened/won/lost, leads due). No notifications table, nothing
//     fabricated; see /api/notifications for exactly where each line comes from.
//   · Settings — a menu of three honest items: who's signed in, whether the
//     booking link env var is configured, and sign out. Nothing decorative.

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Search, Bell, Settings, LogOut, Link2 } from "lucide-react";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { BOOKING_URL } from "@/lib/constants";

interface TopBarProps {
  title: string;
  /** Breadcrumb shown after the title (e.g. "Charleston, SC · Day Spa"). */
  subtitle?: string;
}

// One feed event, exactly as /api/notifications ships it. `at` arrives as an
// ISO string over JSON.
interface FeedEvent {
  kind: "proposal-opened" | "proposal-won" | "proposal-lost" | "lead-due";
  title: string;
  meta: string;
  at: string;
  href: string;
}

// Event kind → dot colour. Won = money-green, lost = danger, opened = accent,
// due call = warn. All tokens, so they follow the theme.
const KIND_COLOR: Record<FeedEvent["kind"], string> = {
  "proposal-opened": "var(--accent)",
  "proposal-won": "var(--money)",
  "proposal-lost": "var(--danger)",
  "lead-due": "var(--warn)",
};

/**
 * Honest relative time. An event's time IS the underlying row's stamp — if a
 * proposal was opened three weeks ago it says "3w ago", never re-dressed to
 * look fresher.
 */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

// The booking link is env config (NEXT_PUBLIC_BOOKING_URL, read once through
// constants.ts). The menu reports its state honestly — it does not pretend the
// app can edit an env file. Host shown when set so he can see WHICH link.
const BOOKING_HOST = (() => {
  if (!BOOKING_URL) return null;
  try {
    return new URL(BOOKING_URL).host;
  } catch {
    return BOOKING_URL;
  }
})();

export function TopBar({ title, subtitle = "Today" }: TopBarProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // null = first fetch hasn't landed yet (distinct from a real empty feed).
  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [feedError, setFeedError] = useState(false);

  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const bellBtnRef = useRef<HTMLButtonElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const bellWrapRef = useRef<HTMLDivElement>(null);
  const settingsWrapRef = useRef<HTMLDivElement>(null);
  // While the "mark seen" PATCH is in flight, a concurrent GET must not stomp
  // the optimistically-zeroed badge with a stale count.
  const suppressCount = useRef(false);

  // ── Notifications: fetch + cheap polling ─────────────────────────────────
  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setEvents(data.events ?? []);
      if (!suppressCount.current) setUnreadCount(data.unreadCount ?? 0);
      setFeedError(false);
    } catch {
      // Keep whatever we already had; the dropdown says so only if there is
      // nothing at all to show.
      setFeedError(true);
    }
  }, []);

  // One fetch on mount, then refetch when the tab regains focus — the same
  // visibilitychange pattern the CRM page uses. No intervals, no websockets.
  useEffect(() => {
    fetchFeed();
    const refresh = () => {
      if (document.visibilityState === "visible") fetchFeed();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchFeed]);

  // ── ⌘K / Ctrl-K opens the palette from anywhere in the dashboard ─────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBellOpen(false);
        setSettingsOpen(false);
        setPaletteOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Dropdowns close on outside click (mousedown, same as the sidebar menus)…
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (bellWrapRef.current && !bellWrapRef.current.contains(e.target as Node))
        setBellOpen(false);
      if (settingsWrapRef.current && !settingsWrapRef.current.contains(e.target as Node))
        setSettingsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // …and on Escape, which also hands focus back to the button that opened them.
  useEffect(() => {
    if (!bellOpen && !settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (bellOpen) {
        setBellOpen(false);
        bellBtnRef.current?.focus();
      }
      if (settingsOpen) {
        setSettingsOpen(false);
        settingsBtnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bellOpen, settingsOpen]);

  // Palette close = focus back on the search trigger, wherever it was opened from.
  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    searchBtnRef.current?.focus();
  }, []);

  /**
   * Opening the bell MARKS THE FEED SEEN: badge zeroes immediately, the PATCH
   * runs in the background, and a failed PATCH puts the count straight back —
   * the badge never lies in either direction. After a successful stamp the
   * feed is refetched so the list (and count) reconcile against the new seenAt.
   */
  const toggleBell = () => {
    if (bellOpen) {
      setBellOpen(false);
      return;
    }
    setSettingsOpen(false);
    setBellOpen(true);
    if (unreadCount > 0) {
      const prev = unreadCount;
      setUnreadCount(0);
      suppressCount.current = true;
      fetch("/api/notifications", { method: "PATCH" })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          suppressCount.current = false;
          fetchFeed();
        })
        .catch(() => {
          suppressCount.current = false;
          setUnreadCount(prev);
        });
    }
  };

  const email = session?.user?.email ?? "…";

  return (
    <div
      className="flex items-center sticky top-0 z-30"
      style={{
        height: 64,
        padding: "0 40px",
        gap: 24,
        background: "var(--glass)",
        borderBottom: "1px solid var(--line)",
        backdropFilter: "blur(32px) saturate(180%)",
        WebkitBackdropFilter: "blur(32px) saturate(180%)",
      }}
    >
      <div className="flex items-center" style={{ gap: 10, minWidth: 220 }}>
        <div
          className="lg-display"
          style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.022em", color: "var(--text)" }}
        >
          {title}
        </div>
        {subtitle && (
          <>
            <span style={{ fontSize: 13, color: "var(--text-4)", fontWeight: 400 }}>›</span>
            <div style={{ fontSize: 13, color: "var(--text-3)" }}>{subtitle}</div>
          </>
        )}
      </div>

      {/* center search — a trigger, not an input; the palette owns the input */}
      <div className="flex justify-center" style={{ flex: 1 }}>
        <button
          ref={searchBtnRef}
          aria-label="Search — opens the command palette"
          aria-haspopup="dialog"
          aria-expanded={paletteOpen}
          onClick={() => {
            setBellOpen(false);
            setSettingsOpen(false);
            setPaletteOpen(true);
          }}
          className="flex items-center text-left"
          style={{
            width: "min(540px, 100%)",
            gap: 10,
            height: 38,
            padding: "0 14px",
            background: "var(--surface-2)",
            border: "1px solid var(--line-strong)",
            borderRadius: 999,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "background var(--t), border-color var(--t)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--surface-hi)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--line-bright)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--line-strong)";
          }}
        >
          <Search size={15} strokeWidth={1.85} style={{ color: "var(--text-3)" }} />
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>Search</span>
          <span style={{ flex: 1 }} />
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </button>
      </div>

      <div className="flex items-center justify-end" style={{ gap: 8, minWidth: 220 }}>
        {/* ── Bell ── */}
        <div ref={bellWrapRef} className="relative">
          <IconButton
            ref={bellBtnRef}
            ariaLabel={
              unreadCount > 0 ? `Notifications — ${unreadCount} unread` : "Notifications"
            }
            ariaHasPopup="menu"
            ariaExpanded={bellOpen}
            onClick={toggleBell}
            badge={unreadCount}
          >
            <Bell size={15} strokeWidth={1.85} />
          </IconButton>
          {bellOpen && (
            <Menu width={340} label="Notifications">
              <MenuLabel>Notifications</MenuLabel>
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                {events === null && !feedError ? (
                  <MenuNote>Loading…</MenuNote>
                ) : feedError && (!events || events.length === 0) ? (
                  <MenuNote>Couldn&apos;t load notifications.</MenuNote>
                ) : events && events.length === 0 ? (
                  <MenuNote>
                    Nothing new. Proposal opens, wins and due calls land here.
                  </MenuNote>
                ) : (
                  (events ?? []).map((e, i) => (
                    <button
                      key={`${e.kind}:${e.href}:${e.at}:${i}`}
                      role="menuitem"
                      onClick={() => {
                        setBellOpen(false);
                        router.push(e.href);
                      }}
                      className="flex w-full text-left"
                      style={{
                        gap: 10,
                        alignItems: "flex-start",
                        padding: "9px 10px",
                        background: "transparent",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        transition: "background var(--t)",
                      }}
                      onMouseEnter={(ev) =>
                        ((ev.currentTarget as HTMLElement).style.background =
                          "var(--surface-2)")
                      }
                      onMouseLeave={(ev) =>
                        ((ev.currentTarget as HTMLElement).style.background = "transparent")
                      }
                    >
                      <span
                        aria-hidden
                        style={{
                          flex: "none",
                          marginTop: 5,
                          width: 7,
                          height: 7,
                          borderRadius: 99,
                          background: KIND_COLOR[e.kind],
                        }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="flex items-baseline" style={{ gap: 8 }}>
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: 12.5,
                              fontWeight: 500,
                              color: "var(--text)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {e.title}
                          </span>
                          <span
                            className="lg-mono"
                            style={{ flex: "none", fontSize: 10.5, color: "var(--text-4)" }}
                          >
                            {timeAgo(e.at)}
                          </span>
                        </span>
                        <span
                          style={{
                            display: "block",
                            marginTop: 2,
                            fontSize: 11.5,
                            color: "var(--text-3)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {e.meta}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </Menu>
          )}
        </div>

        {/* ── Settings ── */}
        <div ref={settingsWrapRef} className="relative">
          <IconButton
            ref={settingsBtnRef}
            ariaLabel="Settings"
            ariaHasPopup="menu"
            ariaExpanded={settingsOpen}
            onClick={() => {
              setBellOpen(false);
              setSettingsOpen((v) => !v);
            }}
          >
            <Settings size={15} strokeWidth={1.85} />
          </IconButton>
          {settingsOpen && (
            <Menu width={300} label="Settings">
              {/* who is signed in — display-only, from the live session */}
              <div style={{ padding: "8px 10px 7px" }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--text-4)",
                  }}
                >
                  Signed in as
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {email}
                </div>
              </div>

              <Divider />

              {/* booking link status — env config, reported honestly, not editable here */}
              <div className="flex" style={{ gap: 10, alignItems: "flex-start", padding: "8px 10px" }}>
                <Link2
                  size={14}
                  strokeWidth={1.85}
                  style={{
                    flex: "none",
                    marginTop: 2,
                    color: BOOKING_URL ? "var(--money)" : "var(--text-4)",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-2)" }}>
                    {BOOKING_URL ? "Booking link: set" : "Booking link: not set"}
                  </div>
                  <div
                    style={{
                      marginTop: 1,
                      fontSize: 11,
                      color: "var(--text-4)",
                      wordBreak: "break-all",
                    }}
                  >
                    {BOOKING_URL
                      ? BOOKING_HOST
                      : "Add NEXT_PUBLIC_BOOKING_URL to .env.local"}
                  </div>
                </div>
              </div>

              <Divider />

              <button
                role="menuitem"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center w-full text-left"
                style={{
                  gap: 10,
                  padding: "8px 10px",
                  background: "transparent",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: "var(--danger)",
                  transition: "background var(--t)",
                }}
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
      </div>

      <CommandPalette open={paletteOpen} onClose={closePalette} />
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
        // sits inside the --surface-2 search field, so one ladder step above it
        background: "var(--surface-hi)",
        border: "1px solid var(--line-strong)",
        borderRadius: 4,
      }}
    >
      {children}
    </span>
  );
}

// Same dropdown shell as the sidebar menus, hung right-aligned off the icons.
function Menu({
  children,
  width,
  label,
}: {
  children: React.ReactNode;
  width: number;
  label: string;
}) {
  return (
    <div
      role="menu"
      aria-label={label}
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width,
        zIndex: 60,
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

// One quiet line inside a menu — empty states and load notes, never a spinner.
function MenuNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 10px 12px", fontSize: 12, lineHeight: 1.5, color: "var(--text-3)" }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />;
}

const IconButton = forwardRef<
  HTMLButtonElement,
  {
    children: React.ReactNode;
    ariaLabel: string;
    ariaExpanded?: boolean;
    ariaHasPopup?: "menu" | "dialog";
    onClick?: () => void;
    /** Unread count. Shown only when > 0 — quiet at zero, no dot theatre. */
    badge?: number;
  }
>(function IconButton({ children, ariaLabel, ariaExpanded, ariaHasPopup, onClick, badge }, ref) {
  return (
    <button
      ref={ref}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      onClick={onClick}
      className="grid place-items-center cursor-pointer relative"
      style={{
        width: 36,
        height: 36,
        padding: 0,
        lineHeight: 1,
        background: "var(--surface-2)",
        border: "1px solid var(--line-strong)",
        borderRadius: 10,
        color: "var(--text-2)",
        transition: "background var(--t), border-color var(--t), color var(--t)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--surface-hi)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--line-bright)";
        (e.currentTarget as HTMLElement).style.color = "var(--text)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--line-strong)";
        (e.currentTarget as HTMLElement).style.color = "var(--text-2)";
      }}
    >
      {children}
      {typeof badge === "number" && badge > 0 && (
        <span
          aria-hidden
          className="lg-mono grid place-items-center"
          style={{
            position: "absolute",
            top: -5,
            right: -5,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 99,
            fontSize: 9.5,
            fontWeight: 700,
            background: "var(--accent-fill)",
            color: "var(--accent-fill-text)",
            boxShadow: "0 0 0 2px var(--bg)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
});
