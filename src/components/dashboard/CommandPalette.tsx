"use client";

// The ⌘K command palette — the REAL search behind the TopBar's search field.
//
// The TopBar field is just a button that opens this; the actual <input> lives
// here, focused the moment the overlay opens. That split is how every command
// palette works (Linear, Raycast, Slack): the top bar stays dumb, and there is
// exactly one place that owns the query, the results and the keyboard.
//
// What it searches, and where each answer comes from:
//   · PAGES       — a static list mirroring the real routes in Sidebar.tsx
//                   (plus Studio, which lives at /studio but is not in the
//                   nav). No fetch needed. Sales Playbook was removed from the
//                   nav and is deliberately absent here too.
//   · BUSINESSES  — GET /api/search?q=…  name / city / industry, newest
//                   activity first. Shows name · city · status so two
//                   same-named rows can be told apart.
//   · PROPOSALS   — same endpoint; title or business name.
//
// Empty query is the RESTING state, not an error: the API returns the 5 most
// recently-touched businesses so the palette is useful before one keystroke.
// Empty RESULTS say "Nothing matches" — never a spinner that spins forever.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  FileText,
  Home,
  Target,
  Library,
  PhoneCall,
  CalendarDays,
  Workflow,
  Sparkles,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import { STATUS_META } from "@/lib/call-queue";
import { PROPOSAL_STATUSES } from "@/lib/constants";

// ---------------------------------------------------------------------------
// The static Pages list — the routes the sidebar actually links to, with the
// same icons, so the palette can never invent a page that doesn't exist.
// `keywords` are the other names he might type for the same place (the Studio
// page titles itself "Workspace"; Opportunities is the businesses table).
// ---------------------------------------------------------------------------
interface PageEntry {
  label: string;
  href: string;
  icon: LucideIcon;
  keywords: string;
}

const PAGES: PageEntry[] = [
  { label: "Home", href: "/dashboard", icon: Home, keywords: "home dashboard overview" },
  { label: "Opportunities", href: "/businesses", icon: Target, keywords: "opportunities businesses leads prospects" },
  { label: "Library", href: "/library", icon: Library, keywords: "library control centre assets clients" },
  { label: "Call Queue", href: "/call-queue", icon: PhoneCall, keywords: "call queue phone dial today" },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, keywords: "calendar zoom callbacks booked meetings" },
  { label: "CRM", href: "/crm", icon: Workflow, keywords: "crm pipeline stages" },
  { label: "Proposals", href: "/proposals", icon: FileText, keywords: "proposals quotes offers" },
  { label: "Studio", href: "/studio", icon: Sparkles, keywords: "studio workspace generate preview deliverables" },
];

// What the API hands back — small flat objects only (see /api/search).
interface BusinessHit {
  id: string;
  name: string;
  city: string | null;
  status: string;
  href: string;
}
interface ProposalHit {
  id: string;
  title: string;
  status: string;
  businessName: string;
  href: string;
}

// One flattened row the keyboard can walk, whatever section it came from.
interface Item {
  key: string;
  section: "Pages" | "Businesses" | "Proposals";
  icon: LucideIcon;
  label: string;
  meta: string;
  href: string;
}

// Status → human label. Loose lookups so an unknown status renders as its raw
// string instead of crashing the palette.
const LEAD_LABEL = STATUS_META as Record<string, { label: string } | undefined>;
const PROPOSAL_LABEL: Record<string, string> = Object.fromEntries(
  PROPOSAL_STATUSES.map((s) => [s.key, s.label])
);

interface CommandPaletteProps {
  open: boolean;
  /** Called on every way out — Escape, scrim click, or after navigating. */
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ businesses: BusinessHit[]; proposals: ProposalHit[] }>({
    businesses: [],
    proposals: [],
  });
  const [fetching, setFetching] = useState(false);
  const [sel, setSel] = useState(0);
  // Monotonic request counter: a slow response for an old query must never
  // overwrite the results of a newer one.
  const seq = useRef(0);

  // Fresh open = fresh slate. Yesterday's query greeting him would be noise.
  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      // The input mounts this same render pass; focus it once it exists.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced fetch (~150ms). Runs for the EMPTY query too — that's the
  // "5 most recent businesses" resting state, one cheap query.
  useEffect(() => {
    if (!open) return;
    const mine = ++seq.current;
    setFetching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (seq.current === mine) {
          setHits({ businesses: data.businesses ?? [], proposals: data.proposals ?? [] });
          setFetching(false);
        }
      } catch {
        // A failed search shows "Nothing matches" for the DB sections rather
        // than a spinner that never resolves; the Pages section still works.
        if (seq.current === mine) {
          setHits({ businesses: [], proposals: [] });
          setFetching(false);
        }
      }
    }, 150);
    return () => clearTimeout(t);
  }, [open, q]);

  // Pages filter client-side — a static list of eight needs no round-trip.
  const needle = q.trim().toLowerCase();
  const pages = useMemo(
    () =>
      needle
        ? PAGES.filter(
            (p) => p.label.toLowerCase().includes(needle) || p.keywords.includes(needle)
          )
        : PAGES,
    [needle]
  );

  // One flat list for the keyboard, in fixed section order.
  const items: Item[] = useMemo(
    () => [
      ...pages.map((p) => ({
        key: `page:${p.href}`,
        section: "Pages" as const,
        icon: p.icon,
        label: p.label,
        meta: "",
        href: p.href,
      })),
      ...hits.businesses.map((b) => ({
        key: `biz:${b.id}`,
        section: "Businesses" as const,
        icon: Building2,
        label: b.name,
        meta: [b.city, LEAD_LABEL[b.status]?.label ?? b.status].filter(Boolean).join(" · "),
        href: b.href,
      })),
      ...hits.proposals.map((p) => ({
        key: `prop:${p.id}`,
        section: "Proposals" as const,
        icon: FileText,
        label: p.title,
        meta: [p.businessName, PROPOSAL_LABEL[p.status] ?? p.status].filter(Boolean).join(" · "),
        href: p.href,
      })),
    ],
    [pages, hits]
  );

  // New list → selection back to the top (and never past the end).
  useEffect(() => {
    setSel(0);
  }, [q, items.length]);
  const selIdx = items.length === 0 ? -1 : Math.min(sel, items.length - 1);

  const go = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose]
  );

  // Keyboard: attached to document so it works even if focus drifts off the
  // input. Escape closes; the TopBar returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => (items.length ? (s + 1) % items.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => (items.length ? (s - 1 + items.length) % items.length : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const it = selIdx >= 0 ? items[selIdx] : undefined;
        if (it) go(it.href);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, items, selIdx, onClose, go]);

  // Keep the keyboard selection in view while arrowing through a long list.
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-sel="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selIdx]);

  if (!open) return null;

  // Rows with a small header wherever the section changes.
  const rows: React.ReactNode[] = [];
  let lastSection: string | null = null;
  items.forEach((it, i) => {
    if (it.section !== lastSection) {
      lastSection = it.section;
      rows.push(
        <div
          key={`h:${it.section}`}
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-4)",
            padding: "10px 10px 4px",
          }}
        >
          {it.section}
        </div>
      );
    }
    const active = i === selIdx;
    const Icon = it.icon;
    rows.push(
      <button
        key={it.key}
        id={`lg-cp-${it.key}`}
        role="option"
        aria-selected={active}
        data-sel={active || undefined}
        onClick={() => go(it.href)}
        // Mouse and keyboard share ONE selection; hovering moves it so Enter
        // always fires the row that looks selected.
        onMouseMove={() => {
          if (!active) setSel(i);
        }}
        className="flex items-center w-full text-left"
        style={{
          gap: 10,
          padding: "8px 10px",
          background: active ? "var(--surface-2)" : "transparent",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "background var(--t)",
        }}
      >
        <Icon
          size={15}
          strokeWidth={1.85}
          style={{ flex: "none", color: active ? "var(--text)" : "var(--text-3)" }}
        />
        <span
          style={{
            flex: "none",
            maxWidth: it.meta ? "55%" : "90%",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {it.label}
        </span>
        {it.meta && (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 11.5,
              color: "var(--text-3)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {it.meta}
          </span>
        )}
        {!it.meta && <span style={{ flex: 1 }} />}
        {active && (
          <CornerDownLeft
            size={12}
            strokeWidth={1.85}
            style={{ flex: "none", color: "var(--text-4)" }}
          />
        )}
      </button>
    );
  });

  return (
    // Scrim — same conventions as ClientDrawer: fixed, dimmed, no body scroll
    // lock (locking shifts the layout sideways at the moment of opening).
    // Clicking it closes; clicks inside the panel stop before reaching it.
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "13vh 24px 24px",
        animation: "fade 0.14s ease-out",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{
          width: "min(620px, 100%)",
          maxHeight: "min(520px, 70vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "var(--shadow-xl)",
          animation: "lg-menu-in 0.12s ease-out",
        }}
      >
        {/* the real input */}
        <div
          className="flex items-center"
          style={{ gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--line)" }}
        >
          <Search size={16} strokeWidth={1.85} style={{ flex: "none", color: "var(--text-3)" }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search businesses, proposals, pages…"
            aria-label="Search businesses, proposals and pages"
            role="combobox"
            aria-expanded="true"
            aria-controls="lg-cp-list"
            aria-activedescendant={selIdx >= 0 ? `lg-cp-${items[selIdx].key}` : undefined}
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 14.5,
              color: "var(--text)",
              fontFamily: "inherit",
            }}
          />
          <span
            className="lg-mono grid place-items-center"
            style={{
              flex: "none",
              height: 18,
              padding: "0 5px",
              fontSize: 10,
              // --text-3, not --text-4: the faintest ink measures 4.17:1 on this
              // raised chip (needs 4.5), and a keyboard hint that cannot be read
              // is decoration — the thing this whole surface exists to not be.
              color: "var(--text-3)",
              background: "var(--surface-2)",
              border: "1px solid var(--line-strong)",
              borderRadius: 4,
            }}
          >
            esc
          </span>
        </div>

        {/* results */}
        <div
          ref={listRef}
          id="lg-cp-list"
          role="listbox"
          aria-label="Search results"
          style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "2px 6px 8px" }}
        >
          {items.length === 0 ? (
            <div
              style={{
                padding: "26px 12px",
                fontSize: 12.5,
                color: "var(--text-3)",
                textAlign: "center",
              }}
            >
              {fetching ? "Searching…" : "Nothing matches"}
            </div>
          ) : (
            rows
          )}
        </div>

        {/* keyboard legend — the affordance that makes the arrows discoverable */}
        <div
          className="flex items-center lg-mono"
          style={{
            gap: 14,
            padding: "7px 14px",
            borderTop: "1px solid var(--line)",
            fontSize: 10.5,
            color: "var(--text-4)",
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
