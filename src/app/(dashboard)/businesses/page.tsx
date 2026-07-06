"use client";

import { useState, useEffect, useRef } from "react";
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
  PhoneCall,
  Shuffle,
} from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { Stars } from "@/components/dashboard/os";
import { SavedBusinessCard } from "@/components/businesses/SavedBusinessCard";
import {
  opportunityScore,
  gapsFor,
  NICHE_RECOMMENDATIONS,
  NICHE_VISIBLE_COUNT,
  sampleNiches,
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
  rating: number | null;
  reviewCount: number | null;
  painPoint: string | null;
  outreachAngle: string | null;
}

type TopMode = "daily" | "search";

// Remembers an explicit "Clear" so the daily batch stays hidden after you
// navigate away and back — without deleting the prospects (re-picking the niche
// resurfaces them). Cleared on the next generate / niche selection.
const DAILY_CLEARED_KEY = "lg:opportunities:daily-cleared";

export default function BusinessesPage() {
  const router = useRouter();
  const [topMode, setTopMode] = useState<TopMode>("daily");

  // ── daily prospecting state ──────────────────────────────────────────────
  const [niche, setNiche] = useState("");
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeNiche, setActiveNiche] = useState<string | null>(null);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [triaging, setTriaging] = useState(false);

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

  useEffect(() => {
    loadDaily();
    loadSaved();
  }, []);

  const loadDaily = async () => {
    // Respect an explicit Clear across navigation: stay empty until the operator
    // re-picks or re-generates a niche (which lifts the flag).
    if (typeof window !== "undefined" && localStorage.getItem(DAILY_CLEARED_KEY) === "1") {
      setLoadingDaily(false);
      return;
    }
    setLoadingDaily(true);
    try {
      const res = await fetch("/api/opportunities/daily", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { niche: string | null; leads: Suggestion[] };
        setSuggestions(data.leads ?? []);
        setActiveNiche(data.niche);
        if (data.niche) setNiche(data.niche);
      }
    } finally {
      setLoadingDaily(false);
    }
  };

  const loadSaved = async () => {
    setLoadingSaved(true);
    try {
      const [bizRes, libRes] = await Promise.all([
        fetch("/api/businesses"),
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
    if (typeof window !== "undefined") localStorage.removeItem(DAILY_CLEARED_KEY);
    setGenerating(true);
    try {
      const res = await fetch("/api/opportunities/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Generation failed");
        return;
      }
      setSuggestions(data.leads ?? []);
      setActiveNiche(target);
      router.refresh(); // refresh the sidebar Opportunities badge count
      if ((data.leads ?? []).length === 0) {
        toast.info(data.message || "No fresh prospects found. Try another niche.");
      } else {
        toast.success(`${data.leads.length} prospects ready to triage`);
      }
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // ── daily: load a niche's persisted batch (clicking a niche chip) ─────────
  // Prospects you generate stay saved until you approve them into the Call Queue,
  // so re-picking a niche resurfaces whatever you already sourced for it.
  const selectNiche = async (n: string) => {
    if (typeof window !== "undefined") localStorage.removeItem(DAILY_CLEARED_KEY);
    setNiche(n);
    setLoadingDaily(true);
    try {
      const res = await fetch(`/api/opportunities/daily?niche=${encodeURIComponent(n)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { leads: Suggestion[] };
        const leads = data.leads ?? [];
        setSuggestions(leads);
        setActiveNiche(leads.length ? n : null);
      }
    } finally {
      setLoadingDaily(false);
    }
  };

  // ── daily: clear the un-triaged New Leads everywhere ──────────────────────
  // Removes ALL still-SUGGESTED prospects from the DB so the CRM's New Leads
  // column empties too — not just this view. Non-destructive in spirit: only raw
  // un-triaged rows (no call history / deals) are touched, and re-generating any
  // niche brings a fresh batch back.
  const clearBatch = async () => {
    setSuggestions([]);
    setActiveNiche(null);
    setNiche("");
    if (typeof window !== "undefined") localStorage.setItem(DAILY_CLEARED_KEY, "1");
    try {
      const res = await fetch("/api/opportunities/daily", { method: "DELETE" });
      const data = await res.json().catch(() => null);
      router.refresh(); // clear the sidebar Opportunities badge count
      toast.success(
        data?.cleared
          ? `Cleared ${data.cleared} lead${data.cleared === 1 ? "" : "s"} — re-generate to bring them back`
          : "Cleared — re-generate to bring them back"
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
      router.push(`/businesses/${targetId}?generate=assets`);
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

  const savedNames = new Set(saved.map((b) => b.name));

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

  const sortedSaved = [...saved].sort((a, b) => {
    if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
    return (
      opportunityScore(b.rating ?? 0, b.reviewCount ?? 0, Boolean(b.website)) -
      opportunityScore(a.rating ?? 0, a.reviewCount ?? 0, Boolean(a.website))
    );
  });

  const showSkeleton = view === "results" && searching && results.length === 0;
  const showEmptySaved = view === "saved" && !loadingSaved && saved.length === 0;

  return (
    <>
      <TopBar
        title="Opportunities"
        subtitle={
          topMode === "daily"
            ? activeNiche
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
            generate={generate}
            generating={generating}
            loading={loadingDaily}
            suggestions={suggestions}
            activeNiche={activeNiche}
            triage={triage}
            triaging={triaging}
            clearBatch={clearBatch}
            goQueue={() => router.push("/call-queue")}
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
              <Tab active={view === "saved"} onClick={() => setView("saved")} count={saved.length}>
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
                  No saved businesses yet
                </div>
                <p style={{ margin: 0, fontSize: 13.5 }}>
                  Search above and save businesses to build your acquisition list.
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
  generate,
  generating,
  loading,
  suggestions,
  activeNiche,
  triage,
  triaging,
  clearBatch,
  goQueue,
}: {
  niche: string;
  setNiche: (v: string) => void;
  selectNiche: (n: string) => void;
  generate: (n?: string) => void;
  generating: boolean;
  loading: boolean;
  suggestions: Suggestion[];
  activeNiche: string | null;
  triage: (action: "approve" | "decline", ids?: string[], all?: boolean) => void;
  triaging: boolean;
  clearBatch: () => void;
  goQueue: () => void;
}) {
  // Spreadsheet-style multi-select for the triage table.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Which recommended-niche chips are currently shown. Shuffle reshuffles them;
  // the active niche is always kept visible so the selection never disappears.
  // Seed with a deterministic slice (so SSR and the first client render match —
  // a random seed would cause a hydration mismatch), then shuffle after mount.
  const [visibleNiches, setVisibleNiches] = useState<string[]>(() =>
    NICHE_RECOMMENDATIONS.slice(0, NICHE_VISIBLE_COUNT)
  );
  useEffect(() => {
    setVisibleNiches(sampleNiches());
  }, []);
  const shuffleNiches = () => {
    setVisibleNiches((prev) => {
      let next = sampleNiches();
      if (niche && !next.includes(niche)) next = [niche, ...next.slice(0, -1)];
      // Guarantee a visible change when possible.
      if (next.join("|") === prev.join("|")) next = sampleNiches();
      return next;
    });
  };

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
            {generating ? "Generating…" : "Generate 30"}
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
                    onApprove={() => triage("approve", [s.id])}
                    onDecline={() => triage("decline", [s.id])}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Empty / cleared state */}
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
          {activeNiche ? (
            <>
              <Check size={26} strokeWidth={1.6} style={{ color: "var(--money)", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Batch triaged</div>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6, marginBottom: 16 }}>
                Approved prospects are in your Call Queue. Generate another niche when you&apos;re ready.
              </div>
              <LgButton variant="primary" size="md" onClick={goQueue}>
                <PhoneCall size={14} strokeWidth={1.8} /> Go to Call Queue
              </LgButton>
            </>
          ) : (
            <>
              <Sparkles size={26} strokeWidth={1.6} style={{ color: "var(--text-4)", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                Pick a niche to generate today&apos;s 30
              </div>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>
                Choose a recommended niche above (or type your own), then hit Generate.
              </div>
            </>
          )}
        </div>
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
  onApprove,
  onDecline,
  disabled,
}: {
  s: Suggestion;
  checked: boolean;
  onToggle: () => void;
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
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{s.name}</div>
        {(s.painPoint || s.outreachAngle) && (
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-3)",
              marginTop: 2,
              maxWidth: 460,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={s.outreachAngle || s.painPoint || ""}
          >
            {s.painPoint || s.outreachAngle}
          </div>
        )}
      </TdCell>
      <TdCell style={{ color: "var(--text-2)", whiteSpace: "nowrap" }}>{s.city ?? "—"}</TdCell>
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
}: {
  icon: React.ReactNode;
  text: string;
  href?: string;
  external?: boolean;
}) {
  const inner = (
    <div
      className="flex items-center"
      style={{ gap: 10, padding: "7px 0", fontSize: 13, color: href ? "var(--text)" : "var(--text-2)" }}
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
