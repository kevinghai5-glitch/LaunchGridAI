"use client";

import Link from "next/link";
import { ExternalLink, Trash2 } from "lucide-react";

// Shared card used by both /library and the Opportunities "Saved" tab so the two
// surfaces stay visually identical. Clicking opens the business in the Studio —
// restoring its saved asset pack when one exists — rather than the bare detail page.
export interface SavedCardData {
  businessId: string;
  name: string;
  city: string | null;
  niche: string | null;
  hasPack: boolean;
  /** ISO date — pack-generated date when hasPack, else saved date. */
  date: string;
}

export function SavedBusinessCard({
  item,
  onDelete,
}: {
  item: SavedCardData;
  onDelete?: () => void;
}) {
  const niche = item.niche ?? "—";
  const when = new Date(item.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      href={`/studio?businessId=${item.businessId}${item.hasPack ? "&restore=pack" : ""}`}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 18,
        background: "var(--surface)",
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
          {item.name}
        </div>
        {onDelete ? (
          <button
            aria-label="Remove"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            style={{
              flex: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              marginTop: -2,
              marginRight: -2,
              borderRadius: 7,
              border: "1px solid transparent",
              background: "transparent",
              color: "var(--text-3)",
              cursor: "pointer",
              transition: "color 140ms ease, background 140ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--danger, #f87171)";
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <Trash2 size={13} strokeWidth={1.8} />
          </button>
        ) : (
          <ExternalLink size={13} strokeWidth={1.6} style={{ color: "var(--text-3)", flex: "none" }} />
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.4 }}>
        {item.city ? `${item.city} · ` : ""}
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
            color: item.hasPack ? "var(--money)" : "var(--text-3)",
            fontWeight: 600,
          }}
        >
          {item.hasPack ? "Asset pack" : "Saved"}
        </span>
        <span className="lg-mono tnum" style={{ fontSize: 11.5, color: "var(--text-2)" }}>
          {when}
        </span>
      </div>
    </Link>
  );
}
