// Public cold-audit TEASER page, hosted at /a/[publicId].
//
// This is the link the pre-zoom GHL email drops in — a preview, NOT the full
// audit. It shows the headline, the single biggest dollar leak, and the worst
// finding in full, then LOCKS the remaining findings behind a blur with one
// pivot-to-call CTA. The complete breakdown is walked through live on the Zoom,
// which is the whole point: the teaser earns the reply, the call closes.
//
// Brand-matched to the paid cold-audit deliverable (cream / serif / restrained)
// so free and paid read as one brand.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { enforceColdAuditLaws } from "@/lib/exporters/cold-audit-html";
import type { ColdAuditReport, ColdAuditFinding } from "@/types";

interface PageProps {
  params: { publicId: string };
}

// Load a COLD_AUDIT system by its public id and shape it into a law-enforced
// report. Any non-cold-audit system (e.g. an asset pack) 404s — those have no
// public teaser.
async function loadReport(publicId: string): Promise<ColdAuditReport | null> {
  const system = await prisma.generatedSystem.findFirst({
    where: { publicId, deletedAt: null },
    select: { type: true, content: true },
  });
  if (!system || system.type !== "COLD_AUDIT") return null;
  const raw = system.content as unknown as ColdAuditReport;
  if (!raw?.findings) return null;
  return enforceColdAuditLaws(raw);
}

function severityRank(sev: ColdAuditFinding["severity"]): number {
  return sev === "high" ? 0 : sev === "medium" ? 1 : 2;
}

function sevLabel(sev: ColdAuditFinding["severity"]): string {
  return sev === "high" ? "Critical" : sev === "medium" ? "Costly" : "Worth fixing";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const report = await loadReport(params.publicId);
  if (!report) return { title: "Audit Not Found" };
  return {
    title: `Where ${report.businessName} is losing clients`,
    description: report.intro,
    robots: { index: false, follow: false }, // a private share link, not for search
  };
}

// Palette — mirrors the paid cold-audit HTML renderer exactly.
const C = {
  bg: "#FBFAF7",
  surface: "#FFFFFF",
  surface2: "#F4F2EC",
  ink: "#1A1814",
  inkMuted: "#6B6659",
  accent: "#9A7B3F",
  border: "#E7E3D8",
  high: "#A8443B",
  med: "#B5862F",
  low: "#3F7D5A",
  shadow: "0 1px 2px rgba(26,24,20,.05)",
  serif: 'Georgia, "Times New Roman", serif',
};

function sevColor(sev: ColdAuditFinding["severity"]): string {
  return sev === "high" ? C.high : sev === "medium" ? C.med : C.low;
}

export default async function ColdAuditTeaserPage({ params }: PageProps) {
  const report = await loadReport(params.publicId);
  if (!report) notFound();

  const findings = [...report.findings].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity)
  );
  const worst = findings[0];
  const locked = findings.slice(1);
  const date = new Date(report.generatedAt).toLocaleDateString();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.ink,
        fontFamily:
          "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        lineHeight: 1.6,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 96px" }}>
        {/* Header */}
        <header style={{ marginBottom: 30 }}>
          <div
            style={{
              textTransform: "uppercase",
              letterSpacing: ".16em",
              fontSize: 11,
              fontWeight: 700,
              color: C.accent,
              marginBottom: 16,
            }}
          >
            Conversion audit · Preview
          </div>
          <h1
            style={{
              fontFamily: C.serif,
              fontWeight: 600,
              letterSpacing: "-.01em",
              margin: "0 0 14px",
              fontSize: 30,
              lineHeight: 1.2,
            }}
          >
            {report.headline}
          </h1>
          {report.intro && (
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.55,
                color: C.inkMuted,
                margin: 0,
                maxWidth: "60ch",
              }}
            >
              {report.intro}
            </p>
          )}
        </header>

        {/* Screenshot */}
        {report.screenshotUrl && (
          <figure
            style={{
              margin: "0 0 28px",
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              overflow: "hidden",
              background: C.surface,
              boxShadow: C.shadow,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={report.screenshotUrl}
              alt={`${report.businessName} website`}
              style={{ display: "block", width: "100%", height: "auto" }}
            />
            <figcaption
              style={{
                background: C.surface2,
                color: C.inkMuted,
                padding: "10px 16px",
                fontSize: 12.5,
                borderTop: `1px solid ${C.border}`,
              }}
            >
              {report.websiteUrl || report.businessName} — as it looks today
            </figcaption>
          </figure>
        )}

        {/* Headline dollar leak */}
        {report.headlineCost && (
          <div
            style={{
              background: C.surface2,
              border: `1px solid ${C.border}`,
              borderLeft: `4px solid ${C.accent}`,
              borderRadius: 12,
              padding: "24px 26px",
              marginBottom: 30,
            }}
          >
            <span
              style={{
                display: "block",
                textTransform: "uppercase",
                letterSpacing: ".12em",
                fontSize: 11,
                fontWeight: 700,
                color: C.accent,
                marginBottom: 10,
              }}
            >
              Your single biggest leak
            </span>
            <p
              style={{
                margin: 0,
                fontFamily: C.serif,
                fontSize: 22,
                lineHeight: 1.4,
                color: C.ink,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {report.headlineCost}
            </p>
          </div>
        )}

        {/* The worst finding — shown in full */}
        {worst && (
          <>
            <div
              style={{
                textTransform: "uppercase",
                letterSpacing: ".12em",
                fontSize: 11,
                fontWeight: 700,
                color: C.accent,
                margin: "0 2px 14px",
              }}
            >
              The most expensive leak we found
            </div>
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "22px 24px",
                marginBottom: 14,
                boxShadow: C.shadow,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: C.serif,
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.accent,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  01
                </span>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: C.serif,
                    fontWeight: 600,
                    fontSize: 18,
                    lineHeight: 1.3,
                    flex: 1,
                    color: C.ink,
                  }}
                >
                  {worst.title}
                </h3>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 9px",
                    borderRadius: 6,
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                    border: `1px solid ${sevColor(worst.severity)}`,
                    color: sevColor(worst.severity),
                  }}
                >
                  {sevLabel(worst.severity)}
                </span>
              </div>
              <p style={{ margin: "0 0 14px", color: C.inkMuted }}>{worst.problem}</p>
              <div
                style={{
                  background: C.surface2,
                  borderRadius: 8,
                  padding: "13px 16px",
                  fontSize: 14.5,
                  color: C.ink,
                }}
              >
                <span
                  style={{
                    display: "block",
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: C.accent,
                    marginBottom: 4,
                  }}
                >
                  What it&apos;s costing you
                </span>
                {worst.whyItCosts}
              </div>
            </div>
          </>
        )}

        {/* Locked remaining findings — blurred, count revealed, content hidden */}
        {locked.length > 0 && (
          <div style={{ position: "relative", marginBottom: 14 }}>
            <div
              aria-hidden
              style={{
                filter: "blur(7px)",
                pointerEvents: "none",
                userSelect: "none",
                opacity: 0.55,
              }}
            >
              {locked.map((f, i) => (
                <div
                  key={i}
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: "22px 24px",
                    marginBottom: 14,
                    boxShadow: C.shadow,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <span style={{ fontFamily: C.serif, fontSize: 13, fontWeight: 700, color: C.accent }}>
                      {(i + 2).toString().padStart(2, "0")}
                    </span>
                    <h3
                      style={{
                        margin: 0,
                        fontFamily: C.serif,
                        fontWeight: 600,
                        fontSize: 18,
                        flex: 1,
                        color: C.ink,
                      }}
                    >
                      {f.title}
                    </h3>
                  </div>
                  <p style={{ margin: 0, color: C.inkMuted }}>{f.problem}</p>
                </div>
              ))}
            </div>
            {/* Lock overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: 8,
                padding: 20,
              }}
            >
              <div
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  boxShadow: C.shadow,
                  color: C.accent,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div style={{ fontFamily: C.serif, fontSize: 18, fontWeight: 600, color: C.ink }}>
                {locked.length} more {locked.length === 1 ? "leak" : "leaks"} found
              </div>
              <div style={{ fontSize: 14, color: C.inkMuted, maxWidth: 360 }}>
                We&apos;ll walk through every one of them — and exactly what it takes to fix them —
                live on our call.
              </div>
            </div>
          </div>
        )}

        {/* CTA — the pivot to the call */}
        {report.closingCta?.message && (
          <div
            style={{
              marginTop: 28,
              background: C.surface2,
              border: `1px solid ${C.border}`,
              borderLeft: `4px solid ${C.accent}`,
              borderRadius: 12,
              padding: "26px 28px",
            }}
          >
            <div
              style={{
                textTransform: "uppercase",
                letterSpacing: ".12em",
                fontSize: 11,
                fontWeight: 700,
                color: C.accent,
                marginBottom: 10,
              }}
            >
              Where this goes next
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: C.serif,
                fontSize: 20,
                lineHeight: 1.45,
                color: C.ink,
              }}
            >
              {report.closingCta.message}
            </p>
          </div>
        )}

        <footer
          style={{
            textAlign: "center",
            color: C.inkMuted,
            fontSize: 12.5,
            marginTop: 40,
            paddingTop: 22,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          {[report.businessName, date, report.agencyName !== "our team" ? report.agencyName : null]
            .filter(Boolean)
            .join(" · ")}
        </footer>
      </div>
    </div>
  );
}
