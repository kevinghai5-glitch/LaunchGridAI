"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Layers, MapPin, Pin, Trash2, X, Phone, Globe, ExternalLink, Sparkles } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { Surface, Stars } from "@/components/dashboard/os";
import type { BusinessResult, SavedBusiness } from "@/types";

const INDUSTRIES = [
  "Day Spa", "Dental Practice", "Gym & Fitness", "HVAC", "Pet Grooming",
  "Med Spa", "Auto Repair", "Roofing", "Landscaping", "Bakery",
  "Salon & Barber", "Pest Control", "Law Firm", "Real Estate", "Chiropractor",
];

// Opportunity score (0–100) derived from real Google Places signals. A weaker
// online presence means more measurable upside to sell, so it scores higher.
function opportunityScore(rating: number, reviews: number, hasWebsite: boolean): number {
  let score = 55;
  if (!hasWebsite) score += 25;
  if (rating > 0 && rating < 4.2) score += 15;
  else if (rating === 0) score += 8; // unknown reputation = unmanaged
  if (reviews === 0) score += 12;
  else if (reviews < 25) score += 15;
  else if (reviews < 75) score += 7;
  return Math.min(98, score);
}

// Gaps surfaced strictly from observable signals — no fabricated weaknesses.
function gapsFor(rating: number, reviews: number, hasWebsite: boolean): string[] {
  const gaps: string[] = [];
  if (!hasWebsite) gaps.push("No website detected");
  if (rating > 0 && rating < 4.2) gaps.push(`${rating.toFixed(1)}★ reputation gap`);
  if (reviews === 0) gaps.push("No reviews yet");
  else if (reviews < 25) gaps.push("Thin review volume");
  else if (reviews < 75) gaps.push("Modest review volume");
  if (gaps.length === 0) gaps.push("Strong presence · upsell candidate");
  return gaps;
}

function mrrPotential(score: number): string {
  if (score >= 90) return "$2,000/mo";
  if (score >= 80) return "$1,500/mo";
  return "$1,000/mo";
}

export default function BusinessesPage() {
  const router = useRouter();
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [saved, setSaved] = useState<SavedBusiness[]>([]);
  const [view, setView] = useState<"results" | "saved">("saved");
  const [searching, setSearching] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [sort, setSort] = useState<"score" | "rating">("score");
  const [detail, setDetail] = useState<BusinessResult | null>(null);

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
      // Staggered reveal, but cap total animation time so large result sets
      // (up to 60) still feel snappy.
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
          hasWebsite: Boolean(r.website),
          saved: savedNames.has(r.name),
          onSave: () => saveBusiness(r),
          onGenerate: () => generateForResult(r),
          href: undefined as string | undefined,
          onOpen: () => setDetail(r),
          onDelete: undefined as (() => void) | undefined,
        }))
      : saved.map((b) => ({
          key: b.id,
          name: b.name,
          city: b.city ?? "—",
          rating: b.rating ?? 0,
          reviews: b.reviewCount ?? 0,
          hasWebsite: Boolean(b.website),
          saved: true,
          onSave: undefined,
          onGenerate: () => router.push(`/businesses/${b.id}?generate=assets`),
          href: `/businesses/${b.id}`,
          onOpen: undefined as (() => void) | undefined,
          onDelete: () => handleDelete(b.id),
        }));

  const sortedCards = [...cards].sort((a, b) => {
    if (sort === "rating") return b.rating - a.rating;
    return (
      opportunityScore(b.rating, b.reviews, b.hasWebsite) -
      opportunityScore(a.rating, a.reviews, a.hasWebsite)
    );
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
      style={{ padding: "22px 24px", cursor: onOpen ? "pointer" : "default" }}
      onClick={onOpen ? () => onOpen() : undefined}
      role={onOpen ? "button" : undefined}
    >
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
        onClick={(e) => e.stopPropagation()}
      >
        <div title="Estimated monthly retainer this account could support, based on its opportunity score. A planning estimate — not a quote.">
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>Est. retainer</div>
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

          {/* score + retainer */}
          <div className="flex" style={{ gap: 12, marginTop: 18 }}>
            <div className="surface" style={{ flex: 1, padding: "12px 14px", borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>
                Opportunity score
              </div>
              <div
                className="lg-display tnum"
                style={{ fontSize: 22, fontWeight: 500, color: "var(--text)" }}
              >
                {score}
              </div>
            </div>
            <div
              className="surface"
              style={{ flex: 1, padding: "12px 14px", borderRadius: 10 }}
              title="Estimated monthly retainer this account could support, based on its opportunity score. A planning estimate — not a quote."
            >
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>
                Est. retainer
              </div>
              <div
                className="lg-display tnum"
                style={{ fontSize: 22, fontWeight: 500, color: "var(--money)" }}
              >
                {mrrPotential(score)}
              </div>
            </div>
          </div>

          {/* contact rows */}
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

          {/* gaps */}
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

          {/* actions */}
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
