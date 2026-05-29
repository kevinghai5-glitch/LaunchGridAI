"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/dashboard/TopBar";
import { Search, Library as LibraryIcon, ExternalLink, Sparkles } from "lucide-react";

interface LibraryItem {
  id: string;
  createdAt: string;
  businessId: string;
  business: {
    id: string;
    name: string;
    city: string | null;
    industry: string | null;
    category: string | null;
    website: string | null;
    photoUrl: string | null;
  };
}

function nicheKey(item: LibraryItem): string {
  return (item.business.industry ?? item.business.category ?? "").toLowerCase();
}

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [niche, setNiche] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/assets/library", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const data = (await res.json()) as { items: LibraryItem[] };
        if (!cancelled) setItems(data.items ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const niches = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      const k = nicheKey(i);
      if (k) set.add(k);
    });
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      if (niche !== "all" && nicheKey(i) !== niche) return false;
      if (!term) return true;
      const hay = [
        i.business.name,
        i.business.city ?? "",
        i.business.industry ?? "",
        i.business.category ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [items, q, niche]);

  return (
    <>
      <TopBar title="Library" subtitle="Saved deliverables" />
      <div style={{ padding: "40px 56px 80px", maxWidth: 1280, margin: "0 auto" }}>
        <div className="rise" style={{ marginBottom: 24 }}>
          <h1
            className="lg-display"
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: "-0.025em",
              color: "var(--text)",
            }}
          >
            Library
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--text-3)", marginTop: 6 }}>
            {loading
              ? "Loading…"
              : `${items.length} saved pack${items.length === 1 ? "" : "s"} · ${niches.length} niche${
                  niches.length === 1 ? "" : "s"
                }`}
          </div>
        </div>

        {/* Controls */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 24,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              flex: "1 1 320px",
              maxWidth: 480,
            }}
          >
            <Search
              size={14}
              strokeWidth={1.8}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-3)",
              }}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by business, city, industry…"
              style={{
                width: "100%",
                padding: "10px 14px 10px 34px",
                background: "var(--bg-deep)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                color: "var(--text)",
                fontSize: 13.5,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
          </div>
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            style={{
              padding: "10px 12px",
              background: "var(--bg-deep)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              color: "var(--text)",
              fontSize: 13.5,
              fontFamily: "inherit",
              outline: "none",
              minWidth: 180,
            }}
          >
            <option value="all">All niches</option>
            {niches.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* States */}
        {loading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 132,
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
                  backgroundSize: "200% 100%",
                  animation: "lg-shimmer 1.4s ease-in-out infinite",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                }}
              />
            ))}
            <style>{`@keyframes lg-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              padding: 20,
              border: "1px solid var(--line)",
              borderRadius: 12,
              color: "var(--text-2)",
              fontSize: 13.5,
            }}
          >
            Couldn&apos;t load library: {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div
            style={{
              padding: "48px 24px",
              border: "1px dashed var(--line)",
              borderRadius: 14,
              textAlign: "center",
              color: "var(--text-2)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <LibraryIcon size={20} strokeWidth={1.6} style={{ color: "var(--text-3)" }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
              {items.length === 0 ? "No saved deliverables yet" : "No matches"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>
              {items.length === 0
                ? "Generate your first asset pack from the Studio."
                : "Try a different search term or niche filter."}
            </div>
            {items.length === 0 && (
              <Link
                href="/studio"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 18,
                  padding: "9px 16px",
                  background: "var(--text)",
                  color: "var(--bg-deep)",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <Sparkles size={13} strokeWidth={2} /> Open Studio
              </Link>
            )}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {filtered.map((item) => (
              <AssetCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function AssetCard({ item }: { item: LibraryItem }) {
  const niche = item.business.industry ?? item.business.category ?? "—";
  const when = new Date(item.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <Link
      href={`/businesses/${item.businessId}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 18,
        background: "var(--bg-deep)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 160ms ease, transform 160ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.18)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--line)";
        (e.currentTarget as HTMLElement).style.transform = "none";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            color: "var(--text)",
            letterSpacing: "-0.005em",
            lineHeight: 1.3,
          }}
        >
          {item.business.name}
        </div>
        <ExternalLink size={13} strokeWidth={1.6} style={{ color: "var(--text-3)", flex: "none" }} />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.4 }}>
        {item.business.city ? `${item.business.city} · ` : ""}
        <span style={{ textTransform: "capitalize" }}>{niche}</span>
      </div>
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 10,
          borderTop: "1px solid var(--line)",
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-3)",
            fontWeight: 600,
          }}
        >
          Asset pack
        </span>
        <span className="lg-mono tnum" style={{ fontSize: 11.5, color: "var(--text-2)" }}>
          {when}
        </span>
      </div>
    </Link>
  );
}
