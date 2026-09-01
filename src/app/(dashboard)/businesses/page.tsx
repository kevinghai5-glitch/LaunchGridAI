"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Layers,
  MapPin,
  Pin,
  Trash2,
  X,
  Phone,
  Globe,
  ExternalLink,
  Sparkles,
  ChevronDown,
  Search,
  Check,
  Loader2,
  Shuffle,
  SlidersHorizontal,
  UserRound,
  Hash,
} from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { Stars } from "@/components/dashboard/os";
import { SavedBusinessCard } from "@/components/businesses/SavedBusinessCard";
import { LocalWindow } from "@/components/ui/local-window";
import { callWindowForCity } from "@/lib/call-timing";
import {
  opportunityScore,
  gapsFor,
  NICHE_RECOMMENDATIONS,
  NICHE_VISIBLE_COUNT,
  NICHE_CATEGORIES,
  sampleNiches,
  DELIVERABLE_STATUSES,
  DAILY_BATCH_SIZE,
  MIN_BATCH_SIZE,
  MAX_BATCH_SIZE,
  clampBatchSize,
} from "@/lib/crm";
import type { BusinessResult, SavedBusiness } from "@/types";

// A SUGGESTED daily-batch lead awaiting approve/decline.
interface Suggestion {
  id: string;
  name: string;
  city: string | null;
  industry: string | null;
  phone: string | null;
  website: string | null;
  ownerName: string | null;
  rating: number | null;
  reviewCount: number | null;
  painPoint: string | null;
  outreachAngle: string | null;
  address: string | null;
  mapsUrl: string | null;
  category: string | null;
  description: string | null;
  photoUrl: string | null;
}

type TopMode = "daily" | "search";

// Where the operator's chosen batch size is remembered between sessions.
const BATCH_COUNT_KEY = "lgx.batchCount";

export default function BusinessesPage() {
  const router = useRouter();
  const [topMode, setTopMode] = useState<TopMode>("daily");

  // ── daily prospecting state ──────────────────────────────────────────────
  const [niche, setNiche] = useState("");
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeNiche, setActiveNiche] = useState<string | null>(null);
  // Never true: the daily list has nothing to load on mount any more. Kept as a
  // constant so DailyView's loading branch stays intact for generation, which
  // uses `generating` instead.
  const loadingDaily = false;
  const [triaging, setTriaging] = useState(false);
  // How many soft-deleted, never-worked prospects are sitting recoverable. Drives
  // ── THE HARD GATE ─────────────────────────────────────────────────────────
  //
  // Prospects render ONLY when this is true, and the single place it is ever set
  // to true is a successful generate() — the Generate button. Not page load, not
  // a niche click, not a restore, not any future handler someone adds.
  //
  // This is deliberately a render-level lock rather than a promise that no other
  // code path calls setSuggestions. Two separate paths had already broken that
  // promise: a niche click un-deleted every cleared lead for that niche and drew
  // them, and page load drew the most recent live batch. Both looked exactly
  // like a generation nobody asked for, at a count nobody typed. A rule that can
  // be broken by adding a line somewhere else is not a rule.
  const [generatedThisSession, setGeneratedThisSession] = useState(false);

  // How many prospects the next generation targets. Held as a STRING so the box
  // can be empty mid-edit (clearing it to type "77" must not snap to 1); it's
  // clamped to a real number only at generate time.
  //
  // Seeded with the default so SSR and the first client render agree, then
  // replaced from localStorage after mount — the operator's batch size is
  // stable day to day, and retyping it every morning is friction for nothing.
  const [batchCount, setBatchCount] = useState<string>(String(DAILY_BATCH_SIZE));
  useEffect(() => {
    const saved = window.localStorage.getItem(BATCH_COUNT_KEY);
    if (saved && Number.isFinite(Number(saved))) {
      setBatchCount(String(clampBatchSize(Number(saved))));
    }
  }, []);

  // ── search state (legacy discovery) ──────────────────────────────────────
  const [mode, setMode] = useState<"industry" | "name">("industry");
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [saved, setSaved] = useState<SavedBusiness[]>([]);
  const [packInfo, setPackInfo] = useState<Record<string, { hasPack: boolean; date: string }>>({});
  const [view, setView] = useState<"results" | "saved">("results");
  const [searching, setSearching] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [sort, setSort] = useState<"score" | "rating">("score");
  const [detail, setDetail] = useState<BusinessResult | null>(null);

  // Only the Saved-businesses list loads on mount. The daily prospect list does
  // NOT — opening this page must never put a business on screen.
  useEffect(() => {
    loadSaved();
  }, []);

  // There is no loadDaily. There is no resumeBatch. There is no restore.
  //
  // Every one of those read un-triaged leads out of the database and drew them
  // on this screen without a generation, which is exactly the behaviour that had
  // to stop. Un-triaged leads from an earlier run still exist — they are in the
  // CRM's New Leads column, which is where a backlog belongs. This page shows
  // what you just generated, and nothing else.

  const loadSaved = async () => {
    setLoadingSaved(true);
    try {
      // ?booked=true — a business reaches this list when it is Zoom Booked or a
      // Client, and by no other route. Unfiltered it returned every live row, so
      // leads declined a month ago sat here beside real clients; at 10,000+
      // dialled that list is unreadable, and none of it is worked from here
      // anyway because the pipeline runs in GoHighLevel.
      //
      // Deliberately not ?deliverable=true, which also admits anything carrying a
      // pack or a leak assessment — that let a DECLINED lead with a test sales
      // call behind it back onto the list.
      const [bizRes, libRes] = await Promise.all([
        fetch("/api/businesses?booked=true"),
        fetch("/api/assets/library", { cache: "no-store" }),
      ]);
      const bizData = await bizRes.json();
      if (bizRes.ok) setSaved(bizData.businesses);
      if (libRes.ok) {
        const libData = (await libRes.json()) as {
          items: { businessId: string; hasPack: boolean; createdAt: string }[];
        };
        const map: Record<string, { hasPack: boolean; date: string }> = {};
        (libData.items ?? []).forEach((i) => {
          map[i.businessId] = { hasPack: i.hasPack, date: i.createdAt };
        });
        setPackInfo(map);
      }
    } finally {
      setLoadingSaved(false);
    }
  };

  // ── daily: generate a fresh batch for the chosen niche ────────────────────
  const generate = async (n?: string) => {
    const target = (n ?? niche).trim();
    if (!target) {
      toast.error("Pick a niche first");
      return;
    }
    // Clamp here too, not just server-side: an empty or nonsense box should
    // generate the default rather than error, and the box should visibly settle
    // on the number that was actually used.
    const count = clampBatchSize(batchCount);
    setBatchCount(String(count));
    window.localStorage.setItem(BATCH_COUNT_KEY, String(count));

    setGenerating(true);
    try {
      const res = await fetch("/api/opportunities/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: target, count }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Generation failed");
        return;
      }
      // data.leads is THIS RUN's prospects only — the route no longer returns the
      // niche's whole un-triaged backlog, so asking for 77 shows 77.
      setSuggestions(data.leads ?? []);
      setActiveNiche(target);
      // The one and only place the gate opens.
      setGeneratedThisSession(true);
      router.refresh(); // refresh the sidebar Opportunities badge count
      if ((data.leads ?? []).length === 0) {
        toast.info(data.message || "No fresh prospects found. Try another niche.");
      } else {
        toast.success(`${data.leads.length} prospects ready to triage`);
        if (data.outsideCallingHours) {
          toast.info(
            "It's outside calling hours across every region right now — these are the soonest-to-open metros. Generate during business hours and the list follows the good local windows."
          );
        } else if (typeof data.sourced === "number" && data.sourced < count) {
          // A short batch is the calling-window gate working, not a failure —
          // so name the reason instead of letting "I asked for 77 and got 61"
          // read as a bug. Padding with closed metros would be the actual bug.
          toast.info(
            `Sourced ${data.sourced} of ${count} — only ${data.metrosOpen} metro${
              data.metrosOpen === 1 ? " is" : "s are"
            } in a calling window right now, and everywhere else is closed. Generate again in a couple of hours to reach the rest.`
          );
        }
      }
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // ── daily: pick the niche the NEXT generation will use ────────────────────
  //
  // Selection only. Sets a string. That is the entire function, permanently.
  //
  // It used to PATCH action:"restore" — un-deleting every soft-deleted lead for
  // that niche — then refetch and render them. Clicking a niche you had once
  // tested and Cleared therefore filled the screen with 30 businesses, with no
  // generation and no reference to the count box.
  //
  // Nothing may be added to this function. Picking what to generate is not a
  // write, not a fetch, and not a reason for anything to appear.
  //
  // Clicking the CHIP THAT IS ALREADY SELECTED deselects it — the chip is its
  // own reset, so there's no separate button for it.
  const selectNiche = (n: string) => {
    setNiche((prev) => (prev === n ? "" : n));
  };

  // ── daily: clear the un-triaged New Leads everywhere ──────────────────────
  // Hides ALL still-SUGGESTED prospects so the CRM's New Leads column empties
  // too — not just this view. Non-destructive: the rows are SOFT-deleted, never
  // removed, and only raw un-triaged ones (no call history / deals) are touched.
  const clearBatch = async () => {
    setSuggestions([]);
    setActiveNiche(null);
    setNiche("");
    try {
      const res = await fetch("/api/opportunities/daily", { method: "DELETE" });
      const data = await res.json().catch(() => null);
      router.refresh(); // clear the sidebar Opportunities badge count
      toast.success(
        data?.cleared
          ? `Cleared ${data.cleared} lead${data.cleared === 1 ? "" : "s"}`
          : "Cleared from view"
      );
    } catch {
      toast.success("Cleared from view");
    }
  };

  // ── daily: approve / decline ──────────────────────────────────────────────
  const triage = async (action: "approve" | "decline", ids?: string[], all?: boolean) => {
    const targets = all ? suggestions.map((s) => s.id) : ids ?? [];
    if (targets.length === 0) return;
    // Optimistic: remove triaged cards immediately.
    const before = suggestions;
    setSuggestions((prev) => prev.filter((s) => !targets.includes(s.id)));
    if (all) setTriaging(true);
    try {
      const res = await fetch("/api/opportunities/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(all ? { action, all: true } : { action, ids: targets }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSuggestions(before);
        toast.error(data.error || "Failed");
        return;
      }
      router.refresh(); // keep the sidebar Opportunities badge in sync
      if (action === "approve") {
        toast.success(`${data.updated} sent to Call Queue`);
        loadSaved();
      } else {
        toast.success(`${data.updated} declined`);
      }
    } catch {
      setSuggestions(before);
      toast.error("Failed");
    } finally {
      setTriaging(false);
    }
  };

  // ── search (legacy) ───────────────────────────────────────────────────────
  const runSearch = async () => {
    if (mode === "name") {
      if (!name.trim()) {
        toast.error("Enter a business name to search");
        return;
      }
    } else if (!industry.trim() || !city.trim()) {
      toast.error("Please enter both industry and city");
      return;
    }
    setSearching(true);
    setResults([]);
    setView("results");
    try {
      const res = await fetch("/api/businesses/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "name"
            ? { mode: "name", name: name.trim(), city: city.trim() }
            : { mode: "industry", industry: industry.trim(), city: city.trim() }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Search failed");
        return;
      }
      const incoming: BusinessResult[] = data.results || [];
      incoming.forEach((r, i) => {
        setTimeout(() => {
          setResults((prev) => [...prev, r]);
        }, Math.min(60 + i * 35, 1400));
      });
      if (incoming.length === 0) toast.info("No businesses found. Try different terms.");
    } catch {
      toast.error("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const saveBusiness = async (r: BusinessResult): Promise<string | null> => {
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googlePlaceId: r.placeId,
          name: r.name,
          address: r.address,
          phone: r.phone,
          website: r.website,
          rating: r.rating,
          reviewCount: r.userRatingsTotal,
          latitude: r.location?.lat,
          longitude: r.location?.lng,
          mapsUrl: r.mapsUrl,
          category: r.category,
          description: r.description,
          photoUrl: r.photoUrl,
          industry: industry.trim() || r.category || "",
          city: city.trim() || (r.address?.split(",").slice(-2, -1)[0]?.trim() ?? ""),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Saved");
        loadSaved();
        return data.business?.id ?? null;
      }
      toast.error(data.error || "Failed to save");
      return null;
    } catch {
      toast.error("Failed to save");
      return null;
    }
  };

  const generateForResult = async (r: BusinessResult) => {
    const existing = saved.find((b) => b.name === r.name);
    const targetId = existing?.id ?? (await saveBusiness(r));
    if (targetId) {
      // Straight into the Library workspace for this business, which auto-expands
      // and immediately kicks off the asset-pack generation (generate=1) — no
      // detour through the business detail page.
      router.push(`/library?businessId=${targetId}&generate=1`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/businesses/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSaved((prev) => prev.filter((b) => b.id !== id));
        toast.success("Business removed");
      } else {
        toast.error("Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  // Every business we've ever persisted — used only to mark search results as
  // already-saved (dedup), never for display.
  const savedNames = new Set(saved.map((b) => b.name));

  // The Saved tab only surfaces leads that made it PAST "Interested" — i.e. they
  // accepted a Zoom (BOOKED_ZOOM) or moved beyond it. Cold prospects sitting in
  // the call queue are not "saved" in this sense, so they stay out of this list.
  const convertedSaved = saved.filter((b) =>
    (DELIVERABLE_STATUSES as string[]).includes(b.status)
  );

  const cards = results.map((r) => ({
    key: r.placeId,
    name: r.name,
    city: r.address ?? city,
    rating: r.rating || 0,
    reviews: r.userRatingsTotal || 0,
    hasWebsite: Boolean(r.website),
    saved: savedNames.has(r.name),
    onSave: () => saveBusiness(r),
    onGenerate: () => generateForResult(r),
    href: undefined as string | undefined,
    onOpen: () => setDetail(r),
    onDelete: undefined as (() => void) | undefined,
  }));

  const sortedCards = [...cards].sort((a, b) => {
    if (sort === "rating") return b.rating - a.rating;
    return (
      opportunityScore(b.rating, b.reviews, b.hasWebsite) -
      opportunityScore(a.rating, a.reviews, a.hasWebsite)
    );
  });

  const sortedSaved = [...convertedSaved].sort((a, b) => {
    if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
    return (
      opportunityScore(b.rating ?? 0, b.reviewCount ?? 0, Boolean(b.website)) -
      opportunityScore(a.rating ?? 0, a.reviewCount ?? 0, Boolean(a.website))
    );
  });

  const showSkeleton = view === "results" && searching && results.length === 0;
  const showEmptySaved = view === "saved" && !loadingSaved && convertedSaved.length === 0;

  return (
    <>
      <TopBar
        title="Opportunities"
        subtitle={
          topMode === "daily"
            ? // Behind the same gate as the list — a count in the top bar is a
              // business appearing on screen too.
              generatedThisSession && activeNiche
              ? `${suggestions.length} ${activeNiche} prospects to triage`
              : "Pick a niche · generate today's prospects"
            : "Live from Google Places"
        }
      />
      <div style={{ padding: "40px 56px 80px", maxWidth: 1280, margin: "0 auto" }}>
        {/* Top-level mode switch */}
        <div className="flex items-center" style={{ gap: 4, marginBottom: 24 }}>
          <ModeTab active={topMode === "daily"} onClick={() => setTopMode("daily")}>
            Daily prospects
          </ModeTab>
          <ModeTab active={topMode === "search"} onClick={() => setTopMode("search")}>
            Search
          </ModeTab>
        </div>

        {topMode === "daily" ? (
          <DailyView
            niche={niche}
            setNiche={setNiche}
            selectNiche={selectNiche}
            batchCount={batchCount}
            setBatchCount={setBatchCount}
            generate={generate}
            generating={generating}
            loading={loadingDaily}
            /* THE GATE. Prospects reach the screen through this prop and no
               other. Until a generation has succeeded in this page session it
               hands down an empty array no matter what `suggestions` holds — so
               even if some future code path fills that state, nothing renders.
               Two different paths previously drew leads here without a
               generation; this makes a third impossible rather than merely
               unlikely. */
            suggestions={generatedThisSession ? suggestions : []}
            activeNiche={generatedThisSession ? activeNiche : null}
            triage={triage}
            triaging={triaging}
            clearBatch={clearBatch}
          />
        ) : (
          <>
            {/* Editorial header */}
            <div className="rise" style={{ marginBottom: 20 }}>
              <h1
                className="lg-display"
                style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text)" }}
              >
                Search opportunities
              </h1>
              <div style={{ fontSize: 13.5, color: "var(--text-3)", marginTop: 6 }}>
                {mode === "name"
                  ? "Know the business? Search it by name and generate an asset pack for it."
                  : "Hand-pick local businesses with measurable funnel gaps — pulled live from Google Places."}
              </div>
            </div>

            {/* Search mode toggle */}
            <div className="flex items-center" style={{ gap: 4, marginBottom: 12 }}>
              <ModeTab active={mode === "industry"} onClick={() => setMode("industry")}>
                By industry
              </ModeTab>
              <ModeTab active={mode === "name"} onClick={() => setMode("name")}>
                By business name
              </ModeTab>
            </div>

            {/* Search bar */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: mode === "name" ? "2fr 1fr auto" : "1fr 1fr auto",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                marginBottom: 14,
                overflow: "hidden",
              }}
            >
              {mode === "name" ? (
                <SearchField
                  label="Business name"
                  value={name}
                  onChange={setName}
                  placeholder="e.g. Crangle Law Firm"
                  onSubmit={runSearch}
                />
              ) : (
                <IndustryField value={industry} onChange={setIndustry} onSubmit={runSearch} />
              )}
              <SearchField
                label={mode === "name" ? "City (optional)" : "City"}
                value={city}
                onChange={setCity}
                placeholder=""
                onSubmit={runSearch}
              />
              <div className="flex items-center" style={{ padding: "10px 12px" }}>
                <LgButton variant="primary" size="md" onClick={runSearch} disabled={searching}>
                  {searching ? "Scanning…" : "Search"}
                </LgButton>
              </div>
            </div>

            {/* Tabs + sort */}
            <div className="flex items-center" style={{ marginBottom: 20, gap: 4 }}>
              <Tab active={view === "results"} onClick={() => setView("results")} count={results.length}>
                Results
              </Tab>
              <Tab active={view === "saved"} onClick={() => setView("saved")} count={convertedSaved.length}>
                Saved
              </Tab>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: "var(--text-3)", marginRight: 6 }}>Sort</span>
              <SortBtn active={sort === "score"} onClick={() => setSort("score")}>
                Score
              </SortBtn>
              <SortBtn active={sort === "rating"} onClick={() => setSort("rating")}>
                Rating
              </SortBtn>
            </div>

            {view === "results" && (
              <div className="rise grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                {showSkeleton && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={"s" + i} />)}
                {!showSkeleton &&
                  sortedCards.map((c) => (
                    <OpportunityCard
                      key={c.key}
                      name={c.name}
                      city={c.city}
                      rating={c.rating}
                      reviews={c.reviews}
                      hasWebsite={c.hasWebsite}
                      saved={c.saved}
                      href={c.href}
                      onSave={c.onSave}
                      onGenerate={c.onGenerate}
                      onOpen={c.onOpen}
                      onDelete={c.onDelete}
                    />
                  ))}
              </div>
            )}

            {view === "saved" && (
              <div
                className="rise"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 14,
                }}
              >
                {loadingSaved && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={"l" + i} />)}
                {!loadingSaved &&
                  sortedSaved.map((b) => {
                    const info = packInfo[b.id];
                    return (
                      <SavedBusinessCard
                        key={b.id}
                        item={{
                          businessId: b.id,
                          name: b.name,
                          city: b.city,
                          niche: b.industry ?? b.category,
                          hasPack: info?.hasPack ?? false,
                          date: info?.date ?? b.createdAt,
                        }}
                        onDelete={() => handleDelete(b.id)}
                      />
                    );
                  })}
              </div>
            )}

            {showEmptySaved && (
              <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-3)" }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>
                  No converted leads yet
                </div>
                <p style={{ margin: 0, fontSize: 13.5 }}>
                  Leads land here once they book a Zoom — work the call queue to move prospects past Interested.
                </p>
              </div>
            )}
            {view === "results" && !searching && results.length === 0 && !showEmptySaved && (
              <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>
                Run a search to surface opportunities.
              </div>
            )}
          </>
        )}
      </div>

      {detail && (
        <BusinessDetailModal
          result={detail}
          saved={savedNames.has(detail.name)}
          onClose={() => setDetail(null)}
          onSave={async () => {
            await saveBusiness(detail);
          }}
          onGenerate={async () => {
            await generateForResult(detail);
          }}
        />
      )}
    </>
  );
}

// ── Daily prospecting view ──────────────────────────────────────────────────

function DailyView({
  niche,
  setNiche,
  selectNiche,
  batchCount,
  setBatchCount,
  generate,
  generating,
  loading,
  suggestions,
  activeNiche,
  triage,
  triaging,
  clearBatch,
}: {
  niche: string;
  setNiche: (v: string) => void;
  selectNiche: (n: string) => void;
  batchCount: string;
  setBatchCount: (v: string) => void;
  generate: (n?: string) => void;
  generating: boolean;
  loading: boolean;
  suggestions: Suggestion[];
  activeNiche: string | null;
  triage: (action: "approve" | "decline", ids?: string[], all?: boolean) => void;
  triaging: boolean;
  clearBatch: () => void;
}) {
  // Spreadsheet-style multi-select for the triage table.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Which prospect is open in the Google-Maps-style detail panel (click a row).
  const [detail, setDetail] = useState<Suggestion | null>(null);

  // Which recommended-niche chips are currently shown. Shuffle reshuffles them;
  // the active niche is always kept visible so the selection never disappears.
  // Seed with a deterministic slice (so SSR and the first client render match —
  // a random seed would cause a hydration mismatch), then shuffle after mount.
  const [visibleNiches, setVisibleNiches] = useState<string[]>(() =>
    NICHE_RECOMMENDATIONS.slice(0, NICHE_VISIBLE_COUNT)
  );
  // Active category filter ("all" = every niche). Powers the Filter dropdown so
  // the operator can narrow the picker to e.g. just trades or boutique.
  const [category, setCategory] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  // Anchor rect for the portal-rendered filter menu. Portaling to <body> escapes
  // the picker card's stacking context so the niche chips can't paint over it.
  const filterBtnRef = useRef<HTMLDivElement | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<{ top: number; right: number } | null>(null);
  const openFilter = () => {
    const r = filterBtnRef.current?.getBoundingClientRect();
    if (r) setFilterAnchor({ top: r.bottom + 6, right: window.innerWidth - r.right });
    setFilterOpen((o) => !o);
  };
  useEffect(() => {
    setVisibleNiches(sampleNiches(NICHE_VISIBLE_COUNT, "all"));
  }, []);
  const shuffleNiches = () => {
    setVisibleNiches((prev) => {
      let next = sampleNiches(NICHE_VISIBLE_COUNT, category);
      if (niche && !next.includes(niche)) next = [niche, ...next.slice(0, -1)];
      // Guarantee a visible change when possible.
      if (next.join("|") === prev.join("|")) next = sampleNiches(NICHE_VISIBLE_COUNT, category);
      return next;
    });
  };
  const pickCategory = (id: string) => {
    setCategory(id);
    setFilterOpen(false);
    let next = sampleNiches(NICHE_VISIBLE_COUNT, id);
    if (niche && !next.includes(niche)) next = [niche, ...next.slice(0, -1)];
    setVisibleNiches(next);
  };
  const activeCategoryLabel =
    category === "all" ? "All types" : NICHE_CATEGORIES.find((c) => c.id === category)?.label ?? "All types";

  // The count pill brightens once it's off the default, matching how the Filter
  // pill signals an active narrowing — so a 77-lead run is visible at a glance.
  const isDefaultCount = clampBatchSize(batchCount) === DAILY_BATCH_SIZE;

  // Drop any selected ids that have left the batch (triaged/cleared).
  useEffect(() => {
    setSelected((prev) => {
      const live = new Set(suggestions.map((s) => s.id));
      const next = new Set(Array.from(prev).filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [suggestions]);

  const allChecked = suggestions.length > 0 && selected.size === suggestions.length;
  const someChecked = selected.size > 0;
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(suggestions.map((s) => s.id)));

  return (
    <>
      {/* Header */}
      <div className="rise" style={{ marginBottom: 18 }}>
        <h1
          className="lg-display"
          style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text)" }}
        >
          Today&apos;s prospects
        </h1>
        <div style={{ fontSize: 13.5, color: "var(--text-3)", marginTop: 6 }}>
          Pick a niche — we surface the best real local-service prospects across North America that
          would want this service. Approve to send them to your Call Queue.
        </div>
      </div>


      {/* Niche picker */}
      <div
        className="rise"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "18px 20px",
          marginBottom: 22,
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 12 }}
        >
          <div
            className="lg-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-4)",
            }}
          >
            Recommended niches
          </div>
          <div className="flex items-center" style={{ gap: 8, position: "relative", zIndex: 60 }}>
            {/* How many prospects the next generation targets. Kept as a string
                so the field can sit empty while retyping; clamped on blur. */}
            <div
              className="flex items-center"
              title={`How many prospects to generate (${MIN_BATCH_SIZE}–${MAX_BATCH_SIZE})`}
              style={{
                gap: 6,
                padding: "5px 10px",
                borderRadius: 999,
                background: isDefaultCount ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
                border: `1px solid ${isDefaultCount ? "var(--line)" : "var(--line-strong)"}`,
                color: isDefaultCount ? "var(--text-3)" : "var(--text)",
                transition: "color var(--t), background var(--t), border-color var(--t)",
                opacity: generating ? 0.55 : 1,
              }}
            >
              <Hash size={12} strokeWidth={1.9} />
              <input
                value={batchCount}
                onChange={(e) =>
                  // Digits only, max 3 — the ceiling is two digits short of 1000,
                  // so a stray keystroke can never submit a four-figure batch.
                  setBatchCount(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))
                }
                onBlur={() => setBatchCount(String(clampBatchSize(batchCount)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                    generate();
                    return;
                  }
                  // Arrow keys nudge the count the way a native number input
                  // would, without the spinner chrome that would break the pill.
                  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                    e.preventDefault();
                    const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
                    setBatchCount(String(clampBatchSize(clampBatchSize(batchCount) + step)));
                  }
                }}
                disabled={generating}
                inputMode="numeric"
                aria-label="Number of prospects to generate"
                className="lg-mono"
                style={{
                  width: 30,
                  padding: 0,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "inherit",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  textAlign: "center",
                  fontFamily: "inherit",
                }}
              />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-4)" }}>
                leads
              </span>
            </div>

            {/* Filter by business type (trades, boutique, medical, …) */}
            <div style={{ position: "relative" }}>
              <div
                ref={filterBtnRef}
                className="flex items-center"
                style={{
                  gap: 0,
                  borderRadius: 999,
                  color: category === "all" ? "var(--text-3)" : "var(--text)",
                  background: category === "all" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
                  border: `1px solid ${category === "all" ? "var(--line)" : "var(--line-strong)"}`,
                  transition: "color var(--t), background var(--t), border-color var(--t)",
                }}
              >
                <button
                  type="button"
                  onClick={openFilter}
                  disabled={generating}
                  aria-label="Filter recommended niches by type"
                  aria-expanded={filterOpen}
                  className="flex items-center"
                  style={{
                    gap: 6,
                    padding: category === "all" ? "5px 10px" : "5px 8px 5px 10px",
                    fontSize: 11.5,
                    fontWeight: 600,
                    borderRadius: 999,
                    color: "inherit",
                    background: "transparent",
                    border: "none",
                    cursor: generating ? "default" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <SlidersHorizontal size={12} strokeWidth={1.9} />
                  {category === "all" ? "Filter" : activeCategoryLabel}
                </button>
                {category !== "all" && (
                  <button
                    type="button"
                    onClick={() => pickCategory("all")}
                    disabled={generating}
                    aria-label="Clear filter"
                    title="Clear filter"
                    className="flex items-center"
                    style={{
                      padding: "5px 9px 5px 4px",
                      color: "var(--text-3)",
                      background: "transparent",
                      border: "none",
                      cursor: generating ? "default" : "pointer",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-3)")}
                  >
                    <X size={13} strokeWidth={2} />
                  </button>
                )}
              </div>
              {filterOpen && filterAnchor && typeof document !== "undefined" &&
                createPortal(
                <>
                  {/* click-away backdrop */}
                  <div
                    onClick={() => setFilterOpen(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 1000 }}
                  />
                  <div
                    role="menu"
                    style={{
                      position: "fixed",
                      top: filterAnchor.top,
                      right: filterAnchor.right,
                      zIndex: 1001,
                      minWidth: 210,
                      padding: 6,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--line-strong)",
                      borderRadius: 12,
                      boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
                    }}
                  >
                    {[{ id: "all", label: "All types" }, ...NICHE_CATEGORIES].map((c) => {
                      const active = category === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={active}
                          onClick={() => pickCategory(c.id)}
                          className="flex items-center justify-between"
                          style={{
                            width: "100%",
                            gap: 10,
                            padding: "8px 10px",
                            fontSize: 12.5,
                            fontWeight: active ? 600 : 500,
                            textAlign: "left",
                            borderRadius: 8,
                            color: active ? "var(--text)" : "var(--text-3)",
                            background: active ? "rgba(255,255,255,0.06)" : "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            transition: "color var(--t), background var(--t)",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                            (e.currentTarget as HTMLElement).style.color = "var(--text)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = active
                              ? "rgba(255,255,255,0.06)"
                              : "transparent";
                            (e.currentTarget as HTMLElement).style.color = active
                              ? "var(--text)"
                              : "var(--text-3)";
                          }}
                        >
                          {c.label}
                          {active && <Check size={13} strokeWidth={2} style={{ color: "var(--money)" }} />}
                        </button>
                      );
                    })}
                  </div>
                </>,
                  document.body
                )}
            </div>
            <button
              type="button"
              onClick={shuffleNiches}
              disabled={generating}
              aria-label="Shuffle recommended niches"
              className="flex items-center"
              style={{
                gap: 6,
                padding: "5px 10px",
                fontSize: 11.5,
                fontWeight: 600,
                borderRadius: 999,
                color: "var(--text-3)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--line)",
                cursor: generating ? "default" : "pointer",
                fontFamily: "inherit",
                transition: "color var(--t), background var(--t), border-color var(--t)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
              }}
            >
              <Shuffle size={12} strokeWidth={1.9} /> Shuffle
            </button>
          </div>
        </div>
        <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 16 }}>
          {visibleNiches.map((n) => {
            const active = niche === n;
            return (
              <button
                key={n}
                onClick={() => selectNiche(n)}
                disabled={generating}
                style={{
                  padding: "7px 13px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 999,
                  cursor: generating ? "default" : "pointer",
                  fontFamily: "inherit",
                  color: active ? "var(--accent)" : "var(--text-2)",
                  background: active ? "var(--accent-soft)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? "oklch(0.55 0.18 248 / 0.4)" : "var(--line)"}`,
                  transition: "color var(--t), background var(--t), border-color var(--t)",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div className="flex items-center" style={{ gap: 10 }}>
          <div
            className="flex items-center"
            style={{
              flex: 1,
              gap: 10,
              padding: "11px 14px",
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--bg-deep, #0b0d12)",
            }}
          >
            <Layers size={15} strokeWidth={1.7} style={{ color: "var(--text-3)" }} />
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generate()}
              placeholder="…or type your own local-service niche"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--text)",
                fontFamily: "var(--font-display)",
              }}
            />
          </div>
          <LgButton variant="primary" size="md" onClick={() => generate()} disabled={generating || !niche.trim()}>
            {generating ? "Generating…" : `Generate ${clampBatchSize(batchCount)}`}
          </LgButton>
        </div>
      </div>

      {/* Generating state */}
      {generating && (
        <div
          className="flex flex-col items-center"
          style={{ padding: "56px 0", textAlign: "center", color: "var(--text-3)" }}
        >
          <Loader2 size={26} className="animate-spin" style={{ color: "var(--accent)", marginBottom: 14 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            Sourcing the best {niche || "prospects"} across North America…
          </div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>
            Searching Google Places, de-duping, scoring, and writing your call angles.
          </div>
        </div>
      )}

      {/* Triage table */}
      {!generating && suggestions.length > 0 && (
        <>
          <div className="flex items-center" style={{ marginBottom: 14, gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              {someChecked
                ? `${selected.size} selected`
                : `${suggestions.length} ${activeNiche} prospect${suggestions.length === 1 ? "" : "s"} to triage`}
            </div>
            <span style={{ flex: 1 }} />
            <LgButton variant="secondary" size="sm" onClick={clearBatch} disabled={triaging}>
              Clear
            </LgButton>
            <LgButton
              variant="secondary"
              size="sm"
              onClick={() =>
                someChecked ? triage("decline", Array.from(selected)) : triage("decline", undefined, true)
              }
              disabled={triaging}
            >
              {someChecked ? `Decline ${selected.size}` : "Decline all"}
            </LgButton>
            <LgButton
              variant="primary"
              size="sm"
              onClick={() =>
                someChecked ? triage("approve", Array.from(selected)) : triage("approve", undefined, true)
              }
              disabled={triaging}
            >
              {triaging
                ? "Working…"
                : someChecked
                  ? `Approve ${selected.size} → Queue`
                  : "Approve all → Queue"}
            </LgButton>
          </div>
          <div
            className="rise"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <ThCell style={{ width: 40, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = someChecked && !allChecked;
                      }}
                      onChange={toggleAll}
                      style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                    />
                  </ThCell>
                  <ThCell>Business</ThCell>
                  <ThCell>Location</ThCell>
                  <ThCell style={{ textAlign: "right", width: 90 }}>Rating</ThCell>
                  <ThCell style={{ textAlign: "right", width: 80 }}>Reviews</ThCell>
                  <ThCell style={{ textAlign: "right", width: 64 }}>Score</ThCell>
                  <ThCell style={{ width: 150 }} />
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => (
                  <SuggestionRow
                    key={s.id}
                    s={s}
                    checked={selected.has(s.id)}
                    onToggle={() => toggleOne(s.id)}
                    disabled={triaging}
                    onOpen={() => setDetail(s)}
                    onApprove={() => triage("approve", [s.id])}
                    onDecline={() => triage("decline", [s.id])}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Empty state. ONE state, always the same one.
          There used to be a second branch here — a green tick reading "Batch
          triaged · Approved prospects are in your Call Queue" — shown whenever
          the list emptied while a niche was active. Declining every lead emptied
          the list too, so declining a batch congratulated you on approvals that
          never happened and offered a button to a queue nothing had been added
          to. An empty list means one thing: generate. */}
      {!generating && !loading && suggestions.length === 0 && (
        <div
          className="rise"
          style={{
            padding: "48px 24px",
            textAlign: "center",
            border: "1px dashed var(--line-strong)",
            borderRadius: 14,
          }}
        >
          <Sparkles size={26} strokeWidth={1.6} style={{ color: "var(--text-4)", margin: "0 auto 12px" }} />
          {/* The batch size is the operator's now, so this can't name a fixed
              30 — it reads back whatever is in the count box. */}
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
            {niche.trim()
              ? `Ready to generate ${clampBatchSize(batchCount)} ${niche.trim()}`
              : "Nothing generated yet"}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>
            {niche.trim()
              ? "Set how many you want in the count box, then hit Generate."
              : "Choose a recommended niche above (or type your own), set how many you want, then hit Generate."}
          </div>
        </div>
      )}

      {detail && (
        <SuggestionDetailModal
          s={detail}
          onClose={() => setDetail(null)}
          onApprove={() => {
            triage("approve", [detail.id]);
            setDetail(null);
          }}
          onDecline={() => {
            triage("decline", [detail.id]);
            setDetail(null);
          }}
          disabled={triaging}
        />
      )}
    </>
  );
}

function ThCell({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      className="lg-mono"
      style={{
        textAlign: "left",
        padding: "10px 14px",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-4)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function TdCell({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td style={{ padding: "11px 14px", verticalAlign: "middle", ...style }}>{children}</td>
  );
}

function SuggestionRow({
  s,
  checked,
  onToggle,
  onOpen,
  onApprove,
  onDecline,
  disabled,
}: {
  s: Suggestion;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onApprove: () => void;
  onDecline: () => void;
  disabled: boolean;
}) {
  const score = opportunityScore(s.rating ?? 0, s.reviewCount ?? 0, Boolean(s.website));
  return (
    <tr
      style={{
        borderBottom: "1px solid var(--line)",
        background: checked ? "var(--accent-soft)" : "transparent",
        transition: "background var(--t)",
      }}
    >
      <TdCell style={{ textAlign: "center", width: 40 }}>
        <input
          type="checkbox"
          aria-label={`Select ${s.name}`}
          checked={checked}
          onChange={onToggle}
          style={{ cursor: "pointer", accentColor: "var(--accent)" }}
        />
      </TdCell>
      <TdCell>
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center text-left w-full"
          title="View details"
          style={{
            gap: 12,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "inherit",
            color: "inherit",
          }}
        >
          <PlaceThumb photoUrl={s.photoUrl} name={s.name} size={40} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="flex items-center" style={{ gap: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{s.name}</span>
            </span>
            {(s.painPoint || s.outreachAngle) && (
              <span
                style={{
                  display: "block",
                  fontSize: 11.5,
                  color: "var(--text-3)",
                  marginTop: 2,
                  maxWidth: 420,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.painPoint || s.outreachAngle}
              </span>
            )}
          </span>
        </button>
      </TdCell>
      {/* Location carries the LOCAL time under the city, because the whole point
          of generating a batch at 11am is knowing which of these you may legally
          dial right now. Computed at render off the same gate the generator uses
          — not carried on the response — so leaving the list open past the top of
          the hour cannot show a window that has since closed. */}
      <TdCell style={{ color: "var(--text-2)", whiteSpace: "nowrap" }}>
        <span style={{ display: "block" }}>{s.city ?? "—"}</span>
        <span style={{ display: "block", fontSize: 11, marginTop: 2 }}>
          <LocalWindow w={callWindowForCity(s.city, new Date())} />
        </span>
      </TdCell>
      <TdCell style={{ textAlign: "right" }}>
        {(s.rating ?? 0) > 0 ? (
          <span className="lg-mono tnum" style={{ color: "var(--text-2)" }}>
            {(s.rating ?? 0).toFixed(1)}★
          </span>
        ) : (
          <span style={{ color: "var(--text-4)" }}>—</span>
        )}
      </TdCell>
      <TdCell style={{ textAlign: "right" }}>
        <span className="lg-mono tnum" style={{ color: "var(--text-2)" }}>
          {s.reviewCount ?? 0}
        </span>
      </TdCell>
      <TdCell style={{ textAlign: "right" }}>
        <span
          className="lg-mono tnum"
          style={{ fontWeight: 600, color: score >= 90 ? "var(--text)" : "var(--text-2)" }}
        >
          {score}
        </span>
      </TdCell>
      <TdCell>
        <div className="flex items-center justify-end" style={{ gap: 6 }}>
          <LgButton variant="secondary" size="sm" onClick={onDecline} disabled={disabled}>
            Decline
          </LgButton>
          <LgButton variant="primary" size="sm" onClick={onApprove} disabled={disabled}>
            <Check size={13} strokeWidth={2} /> Approve
          </LgButton>
        </div>
      </TdCell>
    </tr>
  );
}

// Small rounded place thumbnail (Google-Maps-listing style). Falls back to a
// tinted monogram tile when a business has no Google photo on record.
function PlaceThumb({
  photoUrl,
  name,
  size = 40,
  radius = 8,
}: {
  photoUrl: string | null;
  name: string;
  size?: number;
  radius?: number;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: "cover",
          flex: "none",
          border: "1px solid var(--line)",
          background: "rgba(255,255,255,0.03)",
        }}
      />
    );
  }
  return (
    <div
      className="grid place-items-center flex-none lg-display"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "linear-gradient(135deg, var(--accent-soft), rgba(255,255,255,0.03))",
        border: "1px solid var(--line)",
        color: "var(--text-3)",
        fontSize: size * 0.4,
        fontWeight: 600,
      }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

// Google-Maps-style detail panel for a suggested prospect — hero photo, the full
// cold-call finding (never truncated), rating/reviews, contact rows, funnel gaps,
// and inline approve/decline. Opened by clicking a row in the triage table.
function SuggestionDetailModal({
  s,
  onClose,
  onApprove,
  onDecline,
  disabled,
}: {
  s: Suggestion;
  onClose: () => void;
  onApprove: () => void;
  onDecline: () => void;
  disabled: boolean;
}) {
  const score = opportunityScore(s.rating ?? 0, s.reviewCount ?? 0, Boolean(s.website));
  const gaps = gapsFor(s.rating ?? 0, s.reviewCount ?? 0, Boolean(s.website));

  // Owner/decision-maker resolves on open (not at generation, which stays fast).
  // One free site read for the single business being viewed; cached to the row so
  // the Call Queue reuses it. Null is a valid, shown-as-blank answer.
  const [owner, setOwner] = useState<string | null>(s.ownerName);
  const [ownerLoading, setOwnerLoading] = useState(false);
  useEffect(() => {
    setOwner(s.ownerName);
    // Already known — no lookup. Otherwise resolve on open: the API tries the
    // business's own site first, then a "<name> <city> owner" web search, so we
    // attempt even when there's no website (search only needs the name + city).
    if (s.ownerName) return;
    let cancelled = false;
    setOwnerLoading(true);
    fetch("/api/opportunities/owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.ownerName) setOwner(d.ownerName as string);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setOwnerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [s.id, s.ownerName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(3px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        animation: "lg-fade-up 0.14s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface"
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "88vh",
          overflowY: "auto",
          padding: 0,
          borderRadius: 16,
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid place-items-center"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 2,
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid var(--line)",
            color: "var(--text-2)",
            cursor: "pointer",
          }}
        >
          <X size={15} strokeWidth={1.8} />
        </button>

        {/* Hero photo (Google place photo) */}
        {s.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.photoUrl}
            alt={s.name}
            style={{ width: "100%", height: 190, objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            className="grid place-items-center lg-display"
            style={{
              height: 130,
              background: "linear-gradient(135deg, var(--accent-soft), rgba(255,255,255,0.02))",
              color: "var(--text-4)",
              fontSize: 46,
              fontWeight: 600,
            }}
          >
            {s.name.trim().charAt(0).toUpperCase() || "?"}
          </div>
        )}

        <div style={{ padding: "20px 24px 24px" }}>
          <div
            className="lg-display"
            style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)" }}
          >
            {s.name}
          </div>
          <div
            className="flex items-center"
            style={{ gap: 8, marginTop: 5, fontSize: 12.5, color: "var(--text-3)", flexWrap: "wrap" }}
          >
            {s.category && <span>{s.category}</span>}
            {s.category && s.city && <span style={{ color: "var(--text-4)" }}>·</span>}
            {s.city && (
              <span className="flex items-center" style={{ gap: 4 }}>
                <MapPin size={12} strokeWidth={1.7} /> {s.city}
              </span>
            )}
          </div>

          <div
            className="flex items-center"
            style={{ gap: 10, marginTop: 10, fontSize: 13, color: "var(--text-2)" }}
          >
            {(s.rating ?? 0) > 0 && <Stars rating={s.rating ?? 0} />}
            {(s.reviewCount ?? 0) > 0 && (
              <>
                <span style={{ color: "var(--text-4)" }}>·</span>
                <span>{s.reviewCount} reviews</span>
              </>
            )}
            <span style={{ color: "var(--text-4)" }}>·</span>
            <span style={{ color: "var(--text-3)" }}>Score</span>
            <span
              className="lg-mono tnum"
              style={{ fontWeight: 600, color: score >= 90 ? "var(--text)" : "var(--text-2)" }}
            >
              {score}
            </span>
          </div>

          {/* The cold-call finding — full, never truncated */}
          {(s.painPoint || s.outreachAngle) && (
            <div
              style={{
                marginTop: 18,
                padding: "14px 16px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid var(--line)",
                borderLeft: "2px solid oklch(0.82 0.14 85)",
              }}
            >
              <div
                className="lg-mono"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "oklch(0.82 0.14 85)",
                  marginBottom: 8,
                }}
              >
                The find to open with
              </div>
              {s.painPoint && (
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text)" }}>
                  {s.painPoint}
                </p>
              )}
              {s.outreachAngle && (
                <p style={{ margin: s.painPoint ? "10px 0 0" : 0, fontSize: 13, lineHeight: 1.6, color: "var(--text-2)" }}>
                  <span style={{ color: "var(--text-4)" }}>Angle · </span>
                  {s.outreachAngle}
                </p>
              )}
            </div>
          )}

          {/* Contact rows */}
          <div className="flex flex-col" style={{ gap: 2, marginTop: 16 }}>
            {s.address && (
              <DetailRow
                icon={<MapPin size={14} strokeWidth={1.6} />}
                href={s.mapsUrl || undefined}
                text={s.address}
              />
            )}
            {s.phone && (
              <DetailRow icon={<Phone size={14} strokeWidth={1.6} />} href={`tel:${s.phone}`} text={s.phone} />
            )}
            <DetailRow
              icon={<UserRound size={14} strokeWidth={1.6} />}
              text={owner ? `Ask for ${owner}` : ownerLoading ? "Finding owner…" : "Owner not found"}
              muted={!owner}
            />
            {s.website && (
              <DetailRow
                icon={<Globe size={14} strokeWidth={1.6} />}
                href={s.website}
                text={s.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                external
              />
            )}
          </div>

          {s.description && (
            <p style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6, color: "var(--text-2)" }}>
              {s.description}
            </p>
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>Likely funnel gaps</div>
            <div className="flex" style={{ flexWrap: "wrap", gap: 6 }}>
              {gaps.map((g) => (
                <span
                  key={g}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--line)",
                    color: "var(--text-2)",
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          </div>

          <div
            className="flex items-center"
            style={{ gap: 8, marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)" }}
          >
            <LgButton variant="secondary" size="md" onClick={onDecline} disabled={disabled}>
              Decline
            </LgButton>
            <LgButton variant="primary" size="md" onClick={onApprove} disabled={disabled}>
              <Check size={14} strokeWidth={2} /> Approve → Queue
            </LgButton>
            {s.mapsUrl && (
              <a
                href={s.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center"
                style={{ gap: 6, marginLeft: "auto", fontSize: 12.5, color: "var(--text-3)", textDecoration: "none" }}
              >
                Google Maps <ExternalLink size={12} strokeWidth={1.7} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchField({
  label,
  value,
  onChange,
  placeholder,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSubmit: () => void;
}) {
  return (
    <label
      className="flex items-center"
      style={{
        position: "relative",
        gap: 12,
        padding: "14px 18px",
        borderRight: "1px solid var(--line)",
        cursor: "text",
      }}
    >
      {label === "Industry" ? (
        <Layers size={15} strokeWidth={1.6} style={{ color: "var(--text-3)" }} />
      ) : label.startsWith("City") ? (
        <MapPin size={15} strokeWidth={1.6} style={{ color: "var(--text-3)" }} />
      ) : (
        <Search size={15} strokeWidth={1.6} style={{ color: "var(--text-3)" }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 2 }}>{label}</div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text)",
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.005em",
          }}
        />
      </div>
    </label>
  );
}

function IndustryField({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openMenu = () => {
    const el = wrapRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setMenu({ top: r.bottom + 6, left: r.left, width: r.width });
    }
    setOpen(true);
  };

  return (
    <div
      ref={wrapRef}
      className="flex items-center"
      style={{
        position: "relative",
        gap: 12,
        padding: "14px 14px 14px 18px",
        borderRight: "1px solid var(--line)",
      }}
    >
      <Layers size={15} strokeWidth={1.6} style={{ color: "var(--text-3)", flex: "none" }} />
      <label className="flex-1" style={{ minWidth: 0, cursor: "text" }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 2 }}>Industry</div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setOpen(false);
              onSubmit();
            }
          }}
          placeholder=""
          style={{
            width: "100%",
            padding: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text)",
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.005em",
          }}
        />
      </label>
      <button
        type="button"
        aria-label="Recommended business types"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="grid place-items-center flex-none"
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: open ? "rgba(255,255,255,0.06)" : "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-3)",
          transition: "background var(--t), color var(--t)",
        }}
      >
        <ChevronDown
          size={15}
          strokeWidth={1.8}
          style={{
            transition: "transform var(--t)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && menu && (
        <div
          role="listbox"
          style={{
            position: "fixed",
            top: menu.top,
            left: menu.left,
            width: Math.max(menu.width, 240),
            zIndex: 80,
            background: "var(--surface)",
            border: "1px solid var(--line-strong)",
            borderRadius: 12,
            boxShadow: "0 18px 48px -12px rgba(0,0,0,0.55)",
            padding: 6,
            animation: "lg-fade-up 0.14s ease-out",
            maxHeight: 360,
            overflowY: "auto",
          }}
        >
          <div
            className="lg-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-4)",
              padding: "6px 10px 8px",
            }}
          >
            Recommended target markets
          </div>
          {NICHE_RECOMMENDATIONS.map((ind) => (
            <button
              key={ind}
              type="button"
              role="option"
              aria-selected={value === ind}
              onClick={() => {
                onChange(ind);
                setOpen(false);
              }}
              className="flex items-center w-full text-left"
              style={{
                gap: 10,
                padding: "9px 10px",
                fontSize: 13.5,
                fontWeight: 500,
                color: "var(--text-2)",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "background var(--t), color var(--t)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLElement).style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--text-2)";
              }}
            >
              <Layers size={14} strokeWidth={1.6} style={{ color: "var(--text-3)", flex: "none" }} />
              {ind}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModeTab({
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
        padding: "6px 13px",
        fontSize: 12.5,
        fontWeight: 600,
        color: active ? "var(--text)" : "var(--text-3)",
        background: active ? "rgba(255,255,255,0.06)" : "transparent",
        border: `1px solid ${active ? "var(--line-strong)" : "transparent"}`,
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "color var(--t), background var(--t), border-color var(--t)",
      }}
    >
      {children}
    </button>
  );
}

function Tab({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center"
      style={{
        gap: 7,
        padding: "8px 12px",
        fontSize: 13,
        fontWeight: 500,
        color: active ? "var(--text)" : "var(--text-3)",
        background: active ? "rgba(255,255,255,0.04)" : "transparent",
        border: "1px solid transparent",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "color var(--t), background var(--t)",
      }}
    >
      {children}
      <span style={{ fontSize: 11.5, color: "var(--text-4)" }}>{count}</span>
    </button>
  );
}

function SortBtn({
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
        fontSize: 12,
        padding: "5px 10px",
        borderRadius: 6,
        background: active ? "rgba(255,255,255,0.04)" : "transparent",
        color: active ? "var(--text)" : "var(--text-3)",
        border: "1px solid transparent",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function OpportunityCard({
  name,
  city,
  rating,
  reviews,
  hasWebsite,
  saved,
  href,
  onSave,
  onGenerate,
  onOpen,
  onDelete,
}: {
  name: string;
  city: string;
  rating: number;
  reviews: number;
  hasWebsite: boolean;
  saved: boolean;
  href?: string;
  onSave?: () => void;
  onGenerate: () => void;
  onOpen?: () => void;
  onDelete?: () => void;
}) {
  const score = opportunityScore(rating, reviews, hasWebsite);
  const gaps = gapsFor(rating, reviews, hasWebsite);
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    setBusy(true);
    try {
      await onGenerate();
    } finally {
      setBusy(false);
    }
  };

  const NameEl = href ? (
    <Link href={href} className="lg-display" style={{
      fontSize: 18, fontWeight: 600, letterSpacing: "-0.018em", color: "var(--text)", textDecoration: "none",
    }}>
      {name}
    </Link>
  ) : onOpen ? (
    <button
      onClick={onOpen}
      className="lg-display text-left"
      style={{
        fontSize: 18, fontWeight: 600, letterSpacing: "-0.018em", color: "var(--text)",
        background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {name}
    </button>
  ) : (
    <div className="lg-display" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.018em", color: "var(--text)" }}>
      {name}
    </div>
  );

  return (
    <div
      className="surface hover-lift"
      style={{
        padding: "22px 24px",
        cursor: onOpen ? "pointer" : "default",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "none",
      }}
      onClick={onOpen ? () => onOpen() : undefined}
      role={onOpen ? "button" : undefined}
    >
      <div className="flex items-start" style={{ gap: 16, marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {NameEl}
          <div
            className="flex items-center"
            style={{ gap: 10, marginTop: 6, fontSize: 12.5, color: "var(--text-3)" }}
          >
            {rating > 0 && <Stars rating={rating} />}
            {reviews > 0 && (
              <>
                <span style={{ color: "var(--text-4)" }}>·</span>
                <span>{reviews} reviews</span>
              </>
            )}
            <span style={{ color: "var(--text-4)" }}>·</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{city}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 2 }}>Score</div>
          <div
            className="lg-display tnum"
            style={{
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1,
              color: score >= 90 ? "var(--text)" : "var(--text-2)",
            }}
          >
            {score}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 12 }}>
        <span style={{ color: "var(--text-3)" }}>Gaps · </span>
        {gaps.join(" · ")}
      </div>

      <div
        className="flex items-center justify-end"
        style={{ gap: 12, paddingTop: 14, borderTop: "1px solid var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex" style={{ gap: 6 }}>
          {onDelete ? (
            <button
              onClick={onDelete}
              aria-label="Remove"
              className="grid place-items-center"
              style={{
                width: 30,
                height: 30,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--line-strong)",
                borderRadius: 7,
                color: "var(--text-3)",
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} strokeWidth={1.6} />
            </button>
          ) : onSave ? (
            <LgButton
              variant="secondary"
              size="sm"
              onClick={onSave}
              disabled={saved}
              icon={saved ? "check" : "bookmark"}
            >
              {saved ? "Saved" : "Save"}
            </LgButton>
          ) : saved ? (
            <LgButton variant="secondary" size="sm" disabled icon="check">
              Saved
            </LgButton>
          ) : null}
          <LgButton variant="secondary" size="sm" onClick={handleGenerate} disabled={busy}>
            {busy ? "Opening…" : "Generate"}
          </LgButton>
        </div>
      </div>
    </div>
  );
}

function BusinessDetailModal({
  result,
  saved,
  onClose,
  onSave,
  onGenerate,
}: {
  result: BusinessResult;
  saved: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onGenerate: () => Promise<void>;
}) {
  const score = opportunityScore(result.rating, result.userRatingsTotal, Boolean(result.website));
  const gaps = gapsFor(result.rating, result.userRatingsTotal, Boolean(result.website));
  const [savingBusy, setSavingBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = async () => {
    setSavingBusy(true);
    try {
      await onSave();
    } finally {
      setSavingBusy(false);
    }
  };
  const handleGenerate = async () => {
    setGenBusy(true);
    try {
      await onGenerate();
    } finally {
      setGenBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(3px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        animation: "lg-fade-up 0.14s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface"
        style={{
          width: "100%",
          maxWidth: 540,
          maxHeight: "88vh",
          overflowY: "auto",
          padding: 0,
          borderRadius: 16,
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid place-items-center"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 2,
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid var(--line)",
            color: "var(--text-2)",
            cursor: "pointer",
          }}
        >
          <X size={15} strokeWidth={1.8} />
        </button>

        {result.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.photoUrl}
            alt={result.name}
            style={{ width: "100%", height: 170, objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              height: 96,
              background:
                "linear-gradient(135deg, var(--accent-soft), rgba(255,255,255,0.02))",
            }}
          />
        )}

        <div style={{ padding: "20px 24px 24px" }}>
          <div
            className="lg-display"
            style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)" }}
          >
            {result.name}
          </div>
          {result.category && (
            <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 3 }}>
              {result.category}
            </div>
          )}

          <div
            className="flex items-center"
            style={{ gap: 10, marginTop: 10, fontSize: 13, color: "var(--text-2)" }}
          >
            {result.rating > 0 && <Stars rating={result.rating} />}
            {result.userRatingsTotal > 0 && (
              <>
                <span style={{ color: "var(--text-4)" }}>·</span>
                <span>{result.userRatingsTotal} reviews</span>
              </>
            )}
          </div>

          <div className="flex" style={{ gap: 12, marginTop: 18 }}>
            <div className="surface" style={{ flex: 1, padding: "12px 14px", borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>
                Opportunity score
              </div>
              <div
                className="lg-display tnum"
                style={{ fontSize: 22, fontWeight: 680, letterSpacing: "-0.02em", color: "var(--text)" }}
              >
                {score}
              </div>
            </div>
          </div>

          <div className="flex flex-col" style={{ gap: 2, marginTop: 18 }}>
            {result.address && (
              <DetailRow
                icon={<MapPin size={14} strokeWidth={1.6} />}
                href={result.mapsUrl || undefined}
                text={result.address}
              />
            )}
            {result.phone && (
              <DetailRow
                icon={<Phone size={14} strokeWidth={1.6} />}
                href={`tel:${result.phone}`}
                text={result.phone}
              />
            )}
            {result.website && (
              <DetailRow
                icon={<Globe size={14} strokeWidth={1.6} />}
                href={result.website}
                text={result.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                external
              />
            )}
          </div>

          {result.description && (
            <p style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6, color: "var(--text-2)" }}>
              {result.description}
            </p>
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>
              Likely funnel gaps
            </div>
            <div className="flex" style={{ flexWrap: "wrap", gap: 6 }}>
              {gaps.map((g) => (
                <span
                  key={g}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--line)",
                    color: "var(--text-2)",
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          </div>

          <div
            className="flex items-center"
            style={{ gap: 8, marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line)" }}
          >
            {!saved && (
              <LgButton variant="secondary" size="md" onClick={handleSave} disabled={savingBusy}>
                <Pin size={14} strokeWidth={1.7} /> {savingBusy ? "Saving…" : "Save"}
              </LgButton>
            )}
            <LgButton variant="primary" size="md" onClick={handleGenerate} disabled={genBusy}>
              <Sparkles size={14} strokeWidth={1.7} /> {genBusy ? "Opening…" : "Generate asset pack"}
            </LgButton>
            {result.mapsUrl && (
              <a
                href={result.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center"
                style={{
                  gap: 6,
                  marginLeft: "auto",
                  fontSize: 12.5,
                  color: "var(--text-3)",
                  textDecoration: "none",
                }}
              >
                Google Maps <ExternalLink size={12} strokeWidth={1.7} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  text,
  href,
  external,
  muted,
}: {
  icon: React.ReactNode;
  text: string;
  href?: string;
  external?: boolean;
  muted?: boolean;
}) {
  const inner = (
    <div
      className="flex items-center"
      style={{
        gap: 10,
        padding: "7px 0",
        fontSize: 13,
        color: muted ? "var(--text-4)" : href ? "var(--text)" : "var(--text-2)",
      }}
    >
      <span style={{ color: "var(--text-3)", flex: "none" }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {text}
      </span>
    </div>
  );
  if (!href) return inner;
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      style={{ textDecoration: "none" }}
    >
      {inner}
    </a>
  );
}

function SkeletonCard() {
  return (
    <div className="surface" style={{ padding: "22px 24px", opacity: 0.6 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SkLine w="60%" h={14} />
        <SkLine w="40%" />
        <div style={{ height: 8 }} />
        <SkLine w="90%" h={12} />
        <SkLine w="70%" h={12} />
        <div style={{ height: 8 }} />
        <SkLine w="30%" h={16} />
      </div>
    </div>
  );
}

function SkLine({ w = "100%", h = 8 }: { w?: string; h?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 4,
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.8s ease-in-out infinite",
      }}
    />
  );
}
