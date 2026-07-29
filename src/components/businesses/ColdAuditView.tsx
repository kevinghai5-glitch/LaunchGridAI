"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  Copy,
  Check,
  Pencil,
  MessageSquare,
  Link as LinkIcon,
} from "lucide-react";
import {
  renderColdAuditHtml,
  enforceColdAuditLaws,
  OUTSIDE_INSIDE_FRAME,
  PIVOT_SECTION_LABEL,
  PIVOT_SECTION_INTRO,
  PIPELINE_DISCOVERY_QUESTION,
  COLD_AUDIT_CTA_FALLBACK,
  ctaOffersCompetingChannel,
  pivotQuestionLines,
} from "@/lib/exporters/cold-audit-html";
import { APP_URL } from "@/lib/constants";
import type { ColdAuditReport, ColdAuditFinding } from "@/types";

// How we know a finding, in one short parenthetical. Same rule as the public
// teaser page and for the same reason: the person reading this has told us
// nothing, so a measured finding shows its measurement and an inferred one says
// out loud that we have not measured theirs. A finding with no recorded grade
// (every audit written before evidence grades existed) gets NEITHER note — we
// don't know how we came to know it, so we claim nothing.
//
// "disclosed" is mapped onto the inferred wording deliberately. It cannot occur
// on a cold audit — nothing has been disclosed before the sale — and if one ever
// did arrive, the failure must land on under-claiming rather than on telling a
// stranger they told us something.
function evidenceNote(
  grade: ColdAuditFinding["evidenceGrade"],
  ctx: { businessName: string; site: string; date: string }
): string | null {
  // Measured means measured: state it flatly and show WHAT was measured and WHEN,
  // which is the whole difference between a finding and an opinion.
  if (grade === "observed")
    return `(Measured on ${ctx.site || "your public pages"}, ${ctx.date}.)`;
  if (grade === "inferred" || grade === "disclosed")
    return `(Pattern — we have not measured this at ${ctx.businessName}. A question for the call; if it doesn't apply it comes off the list.)`;
  return null;
}

// The heading over the findings. THE DOCUMENT'S EXACT WORDS, copied under the
// same protest as on the public teaser page: the renderer still writes this label
// inline instead of exporting it, so matching it costs a duplicated string. A
// document, an emailed text and a teaser page that name the same section three
// different ways are three products, not one.
//
// HANDOFF (agent C): export it from cold-audit-html.ts —
//   export const SCAN_SECTION_LABEL = "What a scan can see from out here";
// — and this constant and the one in src/app/a/[publicId]/page.tsx both become
// imports.
const SCAN_SECTION_LABEL = "What a scan can see from out here";

// Plain-text version of the audit — what you'd paste into an email or DM when
// sending the cold open. Mirrors the HTML deliverable's content order, INCLUDING
// the outside/inside frame at the top and the six pivot questions at the bottom,
// so the emailed text, the emailed document and the public teaser page all make
// the same argument in the same words. Every shared string is imported from the
// renderer — none of it is retyped here.
//
// Runs the same law enforcement as the HTML render, so the copied text can never
// ship a forbidden CTA either.
function toPlainText(report: ColdAuditReport): string {
  const r = enforceColdAuditLaws(report);
  const lines: string[] = [];
  lines.push(r.headline);
  lines.push("");
  if (r.intro) {
    lines.push(r.intro);
    lines.push("");
  }

  // The frame, before a single finding — the same position the document puts it
  // in. A reader who reaches the questions without this experiences the pivot as
  // a bait-and-switch; told up front, it reads as the obvious next step.
  lines.push(OUTSIDE_INSIDE_FRAME.label.toUpperCase());
  lines.push(OUTSIDE_INSIDE_FRAME.lead);
  lines.push("");
  lines.push(OUTSIDE_INSIDE_FRAME.body);
  lines.push("");

  if (r.headlineCost) {
    lines.push(r.headlineCost);
    const leakCount = (r.findings ?? []).length;
    if (leakCount > 1) {
      lines.push(`(Just one of ${leakCount} leaks below — the most expensive of them.)`);
    }
    lines.push("");
  }
  lines.push(`${SCAN_SECTION_LABEL}:`);
  lines.push("");
  const evidenceCtx = {
    businessName: r.businessName,
    site: r.websiteUrl,
    date: new Date(r.generatedAt).toLocaleDateString(),
  };
  (r.findings ?? []).forEach((f, i) => {
    lines.push(`${i + 1}. ${f.title}`);
    lines.push(f.problem);
    lines.push(`What it's costing you: ${f.whyItCosts}`);
    // D5 · how we know it, on every finding. Nothing here may read as something
    // the prospect told us — at this point in the sequence they have told us
    // nothing at all.
    const note = evidenceNote(f.evidenceGrade, evidenceCtx);
    if (note) lines.push(note);
    lines.push("");
  });

  // The pivot. The SIX fixed questions out of the renderer — his own phone words,
  // not the model's free-typed probes — so the prospect reads here exactly what he
  // then says on the Zoom. All six, never a subset: what a cold audit withholds is
  // depth, never the pivot.
  lines.push(PIVOT_SECTION_LABEL.toUpperCase());
  lines.push(PIVOT_SECTION_INTRO);
  pivotQuestionLines().forEach((q) => lines.push(`- ${q}`));
  // The document and the public teaser both END the pivot on this one — it is the
  // question that opens the pricing conversation on the call. Imported, so all
  // three surfaces close on the same sentence.
  lines.push("");
  lines.push(PIPELINE_DISCOVERY_QUESTION);
  lines.push("");

  // One ask, one next step. A close offering a second way to respond ("just reply
  // to this email") is not friendlier, it is a way for the prospect not to book —
  // so it is swapped for the renderer's compliant close at this boundary too.
  const close = ctaOffersCompetingChannel(r.closingCta?.message)
    ? COLD_AUDIT_CTA_FALLBACK
    : r.closingCta?.message;
  if (close) {
    lines.push(close);
  }
  return lines.join("\n").trim();
}

export function ColdAuditView({
  report: initialReport,
  publicId,
}: {
  report: ColdAuditReport;
  businessId: string;
  // The saved GeneratedSystem's public id, when the caller has one. Optional
  // because not every call site loads it (a freshly-generated-but-unsaved audit
  // has no public page yet) — the copy-link button hides rather than copying a
  // URL that would 404 on the prospect.
  publicId?: string | null;
}) {
  const [report, setReport] = useState<ColdAuditReport>(initialReport);
  const [editing, setEditing] = useState(false);
  const [ctaDraft, setCtaDraft] = useState(report.closingCta?.message ?? "");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const docHtml = useMemo(() => renderColdAuditHtml(report), [report]);

  // Applies the edited close to THIS session's preview only — the copy, the
  // download, and the open-in-tab all re-render from `report` state. It does
  // NOT persist: there is no endpoint that writes closingCta back onto the
  // saved GeneratedSystem, so the public /a/<id> teaser keeps showing the
  // generated close. Labelled honestly rather than claiming a save.
  const applyCta = () => {
    setReport((r) => ({
      ...r,
      closingCta: { ...r.closingCta, message: ctaDraft.trim() },
    }));
    setEditing(false);
    toast.success("Closing applied to this preview — not saved");
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("Audit copied — paste it into your email or DM");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const copyPreviewLink = async () => {
    if (!publicId) return;
    try {
      await navigator.clipboard.writeText(`${APP_URL}/a/${publicId}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
      toast.success("Preview link copied — this is what the prospect sees");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const downloadHtml = () => {
    const blob = new Blob([docHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = report.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);
    a.download = `${slug || "business"}-quick-audit.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  const openFull = () => {
    const blob = new Blob([docHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const btn = (active = false): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    padding: "7px 13px",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    color: active ? "var(--accent)" : "var(--text-3)",
    background: active ? "var(--accent-soft)" : "transparent",
    border: `1px solid ${active ? "oklch(0.55 0.18 248 / 0.35)" : "var(--line)"}`,
  });

  return (
    <div>
      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        {/* What this document is FOR, said where the operator actually stands.
            It used to read "free value to send before you pitch", which is the
            old job: the audit as the persuasion instrument. It isn't that any
            more — it goes out before the Zoom, it buys two or three minutes of
            credibility on the call, and then it hands off to the six questions.
            It is not trying to close anybody, and the label should not imply it
            is. */}
        <span style={{ fontSize: 11.5, color: "var(--text-subtle)" }}>
          Goes out before the Zoom · a 2–3 minute credibility beat on the call,
          then you pivot to the questions ·{" "}
          <span style={{ color: "var(--text-3)" }}>cold-open audit</span>
        </span>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEditing((v) => !v)} style={btn(editing)}>
            <Pencil size={13} strokeWidth={2} />
            Edit closing
          </button>
          <button onClick={copyText} style={btn()}>
            {copied ? (
              <Check size={13} strokeWidth={2.5} />
            ) : (
              <Copy size={13} strokeWidth={2} />
            )}
            Copy as text
          </button>
          {publicId && (
            <button onClick={copyPreviewLink} style={btn()}>
              {linkCopied ? (
                <Check size={13} strokeWidth={2.5} />
              ) : (
                <LinkIcon size={13} strokeWidth={2} />
              )}
              Copy preview link
            </button>
          )}
          <button onClick={downloadHtml} style={btn()}>
            <Download size={13} strokeWidth={2} />
            Download (.html)
          </button>
          <button onClick={openFull} style={btn()}>
            <ExternalLink size={13} strokeWidth={2} />
            Open
          </button>
        </div>
      </div>

      {/* Editable closing CTA */}
      {editing && (
        <div
          style={{
            marginBottom: 16,
            padding: "16px 18px",
            border: "1px solid var(--line-strong)",
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div
            className="flex items-center"
            style={{ gap: 7, marginBottom: 10 }}
          >
            <MessageSquare size={13} strokeWidth={2} style={{ color: "var(--accent)" }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-subtle)",
              }}
            >
              Your soft close
            </span>
            {report.closingCta?.tiedToFinding && (
              <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>
                · tied to: {report.closingCta.tiedToFinding}
              </span>
            )}
          </div>
          <textarea
            value={ctaDraft}
            onChange={(e) => setCtaDraft(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              resize: "vertical",
              padding: "11px 13px",
              fontSize: 13.5,
              lineHeight: 1.5,
              fontFamily: "inherit",
              color: "var(--text)",
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: 9,
            }}
          />
          <div className="flex justify-end" style={{ gap: 8, marginTop: 10 }}>
            <button
              onClick={() => {
                setCtaDraft(report.closingCta?.message ?? "");
                setEditing(false);
              }}
              style={btn()}
            >
              Cancel
            </button>
            <button onClick={applyCta} style={btn(true)}>
              <Check size={13} strokeWidth={2.5} />
              Apply to preview
            </button>
          </div>
          {/* The control used to say "Save closing" and toast "Closing updated"
              while only touching local state. Say what it actually does. */}
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              lineHeight: 1.5,
              color: "var(--text-subtle)",
            }}
          >
            Applies to the copy, download, and preview below only. Not saved — the
            public teaser link keeps showing the generated close.
          </div>
        </div>
      )}

      {/* Live preview of the actual deliverable */}
      <div
        style={{
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid var(--line-strong)",
          boxShadow: "0 24px 60px -28px rgba(0,0,0,0.6)",
          background: "#0b0d12",
        }}
      >
        <div
          className="flex items-center"
          style={{
            gap: 10,
            padding: "10px 14px",
            borderBottom: "1px solid var(--line)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div className="flex items-center" style={{ gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: "#ff5f57" }} />
            <span style={{ width: 10, height: 10, borderRadius: 99, background: "#febc2e" }} />
            <span style={{ width: 10, height: 10, borderRadius: 99, background: "#28c840" }} />
          </div>
          <div
            className="flex-1 text-center"
            style={{
              fontSize: 11.5,
              color: "var(--text-subtle)",
              fontFamily: "var(--font-mono, monospace)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            quick-audit · {report.businessName}
          </div>
        </div>
        <iframe
          title={`Cold-open audit — ${report.businessName}`}
          srcDoc={docHtml}
          sandbox="allow-same-origin allow-scripts allow-popups"
          style={{
            display: "block",
            width: "100%",
            height: "72vh",
            minHeight: 560,
            border: "none",
            background: "#FBFAF7",
          }}
        />
      </div>
    </div>
  );
}
