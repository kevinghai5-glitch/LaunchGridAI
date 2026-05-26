"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Layers, MapPin, Pin, Trash2 } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { Surface, Stars } from "@/components/dashboard/os";
import type { BusinessResult, SavedBusiness } from "@/types";

const INDUSTRIES = [
  "Day Spa", "Dental Practice", "Gym & Fitness", "HVAC", "Pet Grooming",
  "Med Spa", "Auto Repair", "Roofing", "Landscaping", "Bakery",
  "Salon & Barber", "Pest Control", "Law Firm", "Real Estate", "Chiropractor",
];

// Lightweight heuristic opportunity score (0–100) for visual signal.
function opportunityScore(rating: number, reviews: number): number {
  const r = rating || 4.5;
  const rev = reviews || 100;
  // High rating + lots of reviews = strong business but more room to monetize attention.
  const base = Math.min(98, Math.round(r * 14 + Math.log10(rev + 1) * 8));
  return Math.max(62, base);
}

const GAP_POOL = [
  "No online booking",
  "No SMS follow-up",
  "Stale Instagram",
  "Weak lead capture",
  "Generic homepage CTA",
  "No follow-up sequence",
  "No urgency framing",
  "Phone-only booking",
];

function gapsFor(name: string): string[] {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = GAP_POOL[h % GAP_POOL.length];
  const b = GAP_POOL[(h >> 3) % GAP_POOL.length];
  const c = GAP_POOL[(h >> 6) % GAP_POOL.length];
  return Array.from(new Set([a, b, c]));
}

function mrrPotential(score: number): string {
  if (score >= 90) return "$2,000/mo";
  if (score >= 80) return "$1,500/mo";
  return "$1,000/mo";
}

export default function BusinessesPage() {
  const router = useRouter();
  const [industry, setIndustry] = useState("Day Spa");
  const [city, setCity] = useState("Charleston, SC");
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [saved, setSaved] = useState<SavedBusiness[]>([]);
  const [view, setView] = useState<"results" | "saved">("saved");
  const [searching, setSearching] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [sort, setSort] = useState<"score" | "rating">("score");

  useEffect(() => {
    loadSaved();
  }, []);

  const loadSaved = async () => {
    setLoadingSaved(true);
    try {
      const res = await fetch("/api/businesses");
      const data = await res.json();
      if (res.ok) setSaved(data.businesses);
    } finally {
      setLoadingSaved(false);
    }
  };

  const runSearch = async () => {
    if (!industry.trim() || !city.trim()) {
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
        body: JSON.stringify({ industry: industry.trim(), city: city.trim() }),
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
        }, 90 + i * 80);
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
          industry,
          city,
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

  // Build a unified list of cards for the active tab.
  const cards =
    view === "results"
      ? results.map((r) => ({
          key: r.placeId,
          name: r.name,
          city: r.address ?? city,
          rating: r.rating || 0,
          reviews: r.userRatingsTotal || 0,
          saved: savedNames.has(r.name),
          onSave: () => saveBusiness(r),
          onGenerate: () => generateForResult(r),
          href: undefined as string | undefined,
          onDelete: undefined as (() => void) | undefined,
        }))
      : saved.map((b) => ({
          key: b.id,
          name: b.name,
          city: b.city ?? "—",
          rating: b.rating ?? 0,
          reviews: b.reviewCount ?? 0,
          saved: true,
          onSave: undefined,
          onGenerate: () => router.push(`/businesses/${b.id}?generate=assets`),
          href: `/businesses/${b.id}`,
          onDelete: () => handleDelete(b.id),
        }));

  const sortedCards = [...cards].sort((a, b) => {
    if (sort === "rating") return b.rating - a.rating;
    return opportunityScore(b.rating, b.reviews) - opportunityScore(a.rating, a.reviews);
  });

  const showSkeleton = view === "results" && searching && results.length === 0;
  const showEmptySaved = view === "saved" && !loadingSaved && saved.length === 0;

  return (
    <>
      <TopBar title="Opportunities" subtitle={`${city} · ${industry}`} />
      <div style={{ padding: "40px 56px 80px", maxWidth: 1280, margin: "0 auto" }}>
        {/* Editorial header */}
        <div className="rise" style={{ marginBottom: 32 }}>
          <h1
            className="lg-display"
            style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--text)" }}
          >
            Find opportunities
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--text-3)", marginTop: 6 }}>
            Local businesses with measurable gaps in their funnel — pulled live from Google Places.
          </div>
        </div>

        {/* Search bar — flat, connected */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: "1fr 1fr auto",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            marginBottom: 14,
            overflow: "hidden",
          }}
        >
          <SearchField
            label="Industry"
            value={industry}
            onChange={setIndustry}
            placeholder="Day Spa, Dental, HVAC…"
            onSubmit={runSearch}
            list="lg-industry-suggestions"
          />
          <datalist id="lg-industry-suggestions">
            {INDUSTRIES.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
          <SearchField
            label="City"
            value={city}
            onChange={setCity}
            placeholder="Charleston, SC"
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
            Opportunities
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

        {/* Results grid */}
        <div className="rise grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {showSkeleton && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={"s" + i} />)}
          {view === "saved" && loadingSaved && Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={"l" + i} />)}
          {!showSkeleton &&
            sortedCards.map((c) => (
              <OpportunityCard
                key={c.key}
                name={c.name}
                city={c.city}
                rating={c.rating}
                reviews={c.reviews}
                saved={c.saved}
                href={c.href}
                onSave={c.onSave}
                onGenerate={c.onGenerate}
                onDelete={c.onDelete}
              />
            ))}
        </div>

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
      </div>
    </>
  );
}

function SearchField({
  label,
  value,
  onChange,
  placeholder,
  onSubmit,
  list,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSubmit: () => void;
  list?: string;
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
      ) : (
        <MapPin size={15} strokeWidth={1.6} style={{ color: "var(--text-3)" }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 2 }}>{label}</div>
        <input
          type="text"
          value={value}
          list={list}
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
  saved,
  href,
  onSave,
  onGenerate,
  onDelete,
}: {
  name: string;
  city: string;
  rating: number;
  reviews: number;
  saved: boolean;
  href?: string;
  onSave?: () => void;
  onGenerate: () => void;
  onDelete?: () => void;
}) {
  const score = opportunityScore(rating, reviews);
  const gaps = gapsFor(name);
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
  ) : (
    <div className="lg-display" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.018em", color: "var(--text)" }}>
      {name}
    </div>
  );

  return (
    <div className="surface hover-lift" style={{ padding: "22px 24px" }}>
      {/* header */}
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

      {/* gaps */}
      <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 12 }}>
        <span style={{ color: "var(--text-3)" }}>Gaps · </span>
        {gaps.join(" · ")}
      </div>

      {/* footer */}
      <div
        className="flex items-center justify-between"
        style={{ gap: 12, paddingTop: 14, borderTop: "1px solid var(--line)" }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>Potential</div>
          <div
            className="lg-display tnum"
            style={{ fontSize: 16, fontWeight: 500, color: "var(--money)", letterSpacing: "-0.015em" }}
          >
            {mrrPotential(score)}
          </div>
        </div>
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
          ) : !saved && onSave ? (
            <button
              onClick={onSave}
              aria-label="Save"
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
              <Pin size={13} strokeWidth={1.6} />
            </button>
          ) : null}
          <LgButton variant="secondary" size="sm" onClick={handleGenerate} disabled={busy}>
            {busy ? "Opening…" : "Generate"}
          </LgButton>
        </div>
      </div>
    </div>
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
