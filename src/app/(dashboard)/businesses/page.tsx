"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Star, MapPin, Phone, Globe, Trash2 } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { LgBadge } from "@/components/ui/lg-badge";
import { LgCard } from "@/components/ui/lg-card";
import type { BusinessResult, SavedBusiness } from "@/types";

const INDUSTRIES = [
  "Day Spa",
  "Dental Practice",
  "Gym & Fitness",
  "HVAC",
  "Pet Grooming",
  "Med Spa",
  "Auto Repair",
  "Roofing",
  "Landscaping",
  "Bakery",
  "Salon & Barber",
  "Pest Control",
  "Law Firm",
  "Real Estate",
  "Chiropractor",
];

const RECENT_PRESETS = [
  "Dentists in Boise",
  "Gyms in Austin",
  "HVAC in Portland",
  "Bakeries in Madison",
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  padding: "0 14px",
  fontSize: 14,
  background: "var(--surface)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius)",
  color: "var(--text)",
  outline: "none",
  transition: "border-color 0.15s",
  fontFamily: "inherit",
};

export default function BusinessesPage() {
  const [industry, setIndustry] = useState("Day Spa");
  const [city, setCity] = useState("Charleston, SC");
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [saved, setSaved] = useState<SavedBusiness[]>([]);
  const [view, setView] = useState<"results" | "saved">("saved");
  const [searching, setSearching] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);

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
      // Stream in row-by-row to match the prototype's streaming animation.
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

  const saveBusiness = async (r: BusinessResult) => {
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
          industry,
          city,
        }),
      });
      if (res.ok) {
        toast.success("Saved");
        loadSaved();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } catch {
      toast.error("Failed to save");
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

  return (
    <>
      <TopBar title="Find Businesses" />
      <div style={{ padding: "32px 40px 48px", maxWidth: 1280, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: "var(--text)",
            }}
          >
            Business Finder
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 14.5 }}>
            Real businesses, pulled from Google Places. Filter by industry and city, save to your
            list, generate systems.
          </p>
        </header>

        <LgCard padded={false} style={{ marginBottom: 20, overflow: "hidden" }}>
          <div
            className="grid items-end"
            style={{
              padding: 20,
              gridTemplateColumns: "1.2fr 1fr auto",
              gap: 12,
            }}
          >
            <Field label="Industry">
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                list="lg-industry-suggestions"
                placeholder="e.g. Day Spa, Pilates Studio, Roofing…"
                style={inputStyle}
              />
              <datalist id="lg-industry-suggestions">
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i} />
                ))}
              </datalist>
            </Field>
            <Field label="City">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Austin, TX"
                style={inputStyle}
              />
            </Field>
            <LgButton
              variant="primary"
              size="lg"
              icon="search"
              onClick={runSearch}
              disabled={searching}
              style={{ height: 42 }}
            >
              {searching ? "Searching…" : "Search Google Places"}
            </LgButton>
          </div>
          <div
            className="flex flex-wrap"
            style={{ gap: 6, padding: "0 20px 14px" }}
          >
            <span
              className="self-center"
              style={{ fontSize: 12, color: "var(--text-subtle)", marginRight: 4 }}
            >
              Recent:
            </span>
            {RECENT_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  const [i, c] = p.split(" in ");
                  setIndustry(i.replace(/s$/, ""));
                  setCity(c);
                }}
                style={{
                  background: "var(--surface-active)",
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 99,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </LgCard>

        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 14 }}
        >
          <div
            className="flex"
            style={{
              gap: 4,
              background: "var(--surface-active)",
              padding: 3,
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
            }}
          >
            <TabPill
              active={view === "results"}
              onClick={() => setView("results")}
              disabled={results.length === 0}
            >
              Search results
              {results.length > 0 && (
                <span style={{ opacity: 0.6 }}> ({results.length})</span>
              )}
            </TabPill>
            <TabPill active={view === "saved"} onClick={() => setView("saved")}>
              Saved <span style={{ opacity: 0.6 }}>({saved.length})</span>
            </TabPill>
          </div>
          <div className="flex" style={{ gap: 8 }}>
            <LgButton variant="ghost" size="sm" icon="filter">
              Filter
            </LgButton>
            <LgButton variant="ghost" size="sm" icon="download">
              Export CSV
            </LgButton>
          </div>
        </div>

        {view === "results" && (
          <>
            {searching && results.length === 0 && (
              <LgCard>
                <div className="flex flex-col" style={{ gap: 14 }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center" style={{ gap: 16 }}>
                      <SkeletonBox w={48} h={48} />
                      <div
                        className="flex flex-col"
                        style={{ flex: 1, gap: 8 }}
                      >
                        <SkeletonBox w="40%" h={12} />
                        <SkeletonBox w="65%" h={10} />
                      </div>
                    </div>
                  ))}
                </div>
              </LgCard>
            )}
            {results.length > 0 && (
              <LgCard padded={false}>
                {results.map((r, i) => (
                  <ResultRow
                    key={r.placeId}
                    r={r}
                    first={i === 0}
                    saved={savedNames.has(r.name)}
                    onSave={() => saveBusiness(r)}
                  />
                ))}
              </LgCard>
            )}
          </>
        )}

        {view === "saved" && (
          <LgCard padded={false}>
            {loadingSaved && (
              <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 14 }}>
                Loading…
              </div>
            )}
            {!loadingSaved && saved.length === 0 && (
              <div
                className="text-center"
                style={{ padding: 48, color: "var(--text-muted)" }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--text)" }}>
                  No saved businesses yet
                </div>
                <p style={{ margin: 0, fontSize: 13.5 }}>
                  Search for businesses above and click Save to add them here.
                </p>
              </div>
            )}
            {saved.map((b, i) => (
              <SavedRow
                key={b.id}
                b={b}
                first={i === 0}
                onDelete={() => handleDelete(b.id)}
              />
            ))}
          </LgCard>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col" style={{ gap: 6 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-muted)",
          letterSpacing: "-0.005em",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function TabPill({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 14px",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "inherit",
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--text)" : "var(--text-muted)",
        border: "none",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: active ? "var(--shadow-sm)" : "none",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function StarsRating({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 3,
        color: "color-mix(in oklch, var(--warning) 70%, black)",
      }}
    >
      <Star size={12} fill="currentColor" stroke="none" />
      <span
        style={{ fontWeight: 600, fontSize: 12.5, color: "var(--text)" }}
      >
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

function SkeletonBox({ w, h }: { w: number | string; h: number }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        background: "var(--surface-active)",
        borderRadius: 4,
        animation: "lg-pulse 1.6s ease-in-out infinite",
      }}
    />
  );
}

function ResultRow({
  r,
  first,
  saved,
  onSave,
}: {
  r: BusinessResult;
  first: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <div
      className="lg-fade-in flex items-center"
      style={{
        padding: "18px 24px",
        gap: 18,
        borderTop: first ? "none" : "1px solid var(--border)",
      }}
    >
      <div
        className="grid place-items-center flex-none"
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--radius)",
          background: "var(--accent-soft)",
          color: "var(--accent)",
          fontFamily: "var(--font-sans), sans-serif",
          fontSize: 17,
          fontWeight: 700,
        }}
      >
        {r.name[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="flex items-center"
          style={{ gap: 10, marginBottom: 4 }}
        >
          <span
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              letterSpacing: "-0.005em",
              color: "var(--text)",
            }}
          >
            {r.name}
          </span>
          {r.rating > 0 && <StarsRating rating={r.rating} />}
          {r.userRatingsTotal > 0 && (
            <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>
              · {r.userRatingsTotal} reviews
            </span>
          )}
        </div>
        <div
          className="flex"
          style={{ gap: 16, fontSize: 12.5, color: "var(--text-muted)" }}
        >
          {r.address && (
            <span className="inline-flex items-center" style={{ gap: 5 }}>
              <MapPin size={11} strokeWidth={1.75} />
              {r.address}
            </span>
          )}
          {r.phone && (
            <span className="inline-flex items-center" style={{ gap: 5 }}>
              <Phone size={11} strokeWidth={1.75} />
              {r.phone}
            </span>
          )}
          {r.website && (
            <span className="inline-flex items-center" style={{ gap: 5 }}>
              <Globe size={11} strokeWidth={1.75} />
              {r.website}
            </span>
          )}
        </div>
      </div>
      <div className="flex" style={{ gap: 8 }}>
        {saved ? (
          <LgBadge tone="success">
            <span style={{ fontWeight: 700 }}>✓</span> Saved
          </LgBadge>
        ) : (
          <LgButton variant="secondary" size="sm" icon="plus" onClick={onSave}>
            Save
          </LgButton>
        )}
        <Link href="/studio">
          <LgButton variant="primary" size="sm" icon="sparkles">
            Generate
          </LgButton>
        </Link>
      </div>
    </div>
  );
}

function SavedRow({
  b,
  first,
  onDelete,
}: {
  b: SavedBusiness;
  first: boolean;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex items-center"
      style={{
        padding: "18px 24px",
        gap: 18,
        borderTop: first ? "none" : "1px solid var(--border)",
      }}
    >
      <div
        className="grid place-items-center flex-none"
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--radius)",
          background: "var(--accent-soft)",
          color: "var(--accent)",
          fontFamily: "var(--font-sans), sans-serif",
          fontSize: 17,
          fontWeight: 700,
        }}
      >
        {b.name[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="flex items-center"
          style={{ gap: 10, marginBottom: 4 }}
        >
          <Link
            href={`/businesses/${b.id}`}
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              letterSpacing: "-0.005em",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            {b.name}
          </Link>
          <LgBadge tone="neutral">saved</LgBadge>
        </div>
        <div
          className="flex"
          style={{ gap: 16, fontSize: 12.5, color: "var(--text-muted)" }}
        >
          <span>
            {b.industry ?? "—"} · {b.city ?? "—"}
          </span>
          {b.rating != null && b.rating > 0 && <StarsRating rating={b.rating} />}
          {b.reviewCount != null && b.reviewCount > 0 && <span>{b.reviewCount} reviews</span>}
          {b.phone && (
            <span style={{ fontFamily: "var(--font-mono), monospace" }}>{b.phone}</span>
          )}
        </div>
      </div>
      <div className="flex" style={{ gap: 8 }}>
        <Link href={`/proposals/new?businessId=${b.id}`}>
          <LgButton variant="ghost" size="sm" icon="file">
            Proposal
          </LgButton>
        </Link>
        <Link href={`/studio?businessId=${b.id}`}>
          <LgButton variant="primary" size="sm" icon="sparkles">
            Generate
          </LgButton>
        </Link>
        <button
          onClick={onDelete}
          aria-label="Delete business"
          style={{
            width: 30,
            height: 30,
            background: "transparent",
            border: "none",
            color: "var(--text-subtle)",
            cursor: "pointer",
            borderRadius: 6,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
