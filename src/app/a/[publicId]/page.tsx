// Public cold-audit TEASER page, hosted at /a/[publicId].
//
// PHASE 4 — WHAT THIS PAGE IS FOR, IN ONE SENTENCE.
// It is not trying to close anybody. The cold audit is no longer the persuasion
// instrument: it is a two-to-three-minute credibility beat on the Zoom, and its
// real job is to earn the right to ask questions and then hand off. So the job of
// this page — the link the pre-call email drops in — is to leave the prospect
// holding ONE argument:
//
//     what we can see from the street is the SMALLER half.
//
// Everything on the page is arranged around that. The page is two NAMED halves —
// "The half a scan can see" (the findings, each shown with how we know it) and
// "The half a scan can't see" (the six questions only they can answer) — and the
// call is where the second half gets answered.
//
//   1. headline + who they are                  — recognition
//   2. THE FRAME, before any finding lands      — "and that is the smaller half"
//   3. the screenshot                           — recognition
//   4. the biggest dollar leak                  — the stake
//   5. THE HALF A SCAN CAN SEE: the one or two strongest findings, in full,
//      each stamped with how we know it         — proof we actually looked
//   6. THE HALF A SCAN CAN'T SEE: all six pivot questions — the invisible half,
//                                                 asked rather than asserted
//   7. the withheld COUNT, content omitted      — the reason to book
//   8. ONE booking CTA. No competing links.
//
// THE FRAME GOES FIRST, and that is not a layout preference. A reader who reaches
// the questions without having been told the scan is the small half experiences
// the pivot as us moving the goalposts. Told up front, the same questions read as
// the obvious next step — which is what they are. The document orders it the same
// way, and for the same reason (see OUTSIDE_INSIDE_FRAME in cold-audit-html.ts).
//
// WHAT IS WITHHELD IS DEPTH — NEVER THE PIVOT. The remaining findings are held
// back, because that is the reason to take the call. The ARGUMENT is not held
// back: the frame and every one of the pivot questions are on this page in full.
// A prospect who leaves this page thinking "my website has some flaws" has been
// handed the wrong idea, and nothing said later on the call undoes a wrong first
// idea. Depth is the thing worth saving for the call; the frame is the thing that
// makes the call worth taking.
//
// D2 · ONE ACTION. There is exactly one link on this page and it is the booking
// CTA. It is emitted from a single place (see BOOKING ANCHOR below) and nothing
// else in this file renders an <a>, a <button>, or a form. Anything else
// competing for the click is a way for the prospect not to book — the business's
// own website URL is therefore printed as TEXT in the screenshot caption, never
// linked, because the one thing we do not want is to send them back to the page
// we just told them is leaking.
//
// D3 · SECURITY / LEAK NOTE: withheld findings are never rendered. Earlier
// versions blurred them in CSS, which shipped the full title and problem text to
// the browser where view-source read it straight off. This is a Server Component,
// so the fix is to omit them SERVER-SIDE: `splitForTeaser` is the only code that
// touches the full list, it returns a COUNT for the withheld ones, and the
// findings array is destructured off the report below so no variable left in
// render scope holds withheld text. The blurred stack near the bottom is
// content-free placeholder bars — the blur is decoration on top of already-empty
// markup, not the lock.
//
// Brand-matched to the paid cold-audit deliverable (cream / serif / restrained)
// so free and paid read as one brand and one argument.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
// D4 · EVERY WORD THIS PAGE SHARES WITH THE DOCUMENT COMES FROM THE DOCUMENT.
// The frame, the six pivot questions, the section headings and the button label
// are imported, not retyped. A second copy of any of these strings is a second
// copy that drifts — and a drift here is a drift between what the prospect reads
// in the pre-call email and what he says out loud on the Zoom, which is the one
// effect the whole sequence depends on.
import {
  enforceColdAuditLaws,
  OUTSIDE_INSIDE_FRAME,
  PIVOT_QUESTIONS,
  PIVOT_SECTION_LABEL,
  PIVOT_SECTION_INTRO,
  PIPELINE_DISCOVERY_QUESTION,
  BOOKING_CTA_LABEL,
  COLD_AUDIT_CTA_FALLBACK,
  ctaOffersCompetingChannel,
} from "@/lib/exporters/cold-audit-html";
import { BOOKING_URL } from "@/lib/constants";
import type { ColdAuditReport, ColdAuditFinding } from "@/types";
import { assertStoredColdAuditSafe } from "@/lib/exporters/validate-pack";

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
  // This page is the PRE-SALE artifact a prospect opens from the pre-call email,
  // so it is the last place a "disclosed" statement may appear — nothing has been
  // disclosed yet. The gate is scoped to rows that carry evidence grades (see
  // assertStoredColdAuditSafe), so audits generated before Phase 1 are unaffected.
  // It throws rather than filtering: rendering a repaired page would hide the
  // breach from the only person who can fix it, and Next's error boundary showing
  // this prospect a retry beats showing them a claim we cannot stand behind.
  assertStoredColdAuditSafe(raw, `public teaser /a/${publicId}`);
  // Same law enforcement the paid document runs, from the same function — so the
  // headline, the close and the pivot questions on this page are byte-identical
  // to the ones in the document and to what he says on the phone.
  return enforceColdAuditLaws(raw);
}

function severityRank(sev: ColdAuditFinding["severity"]): number {
  return sev === "high" ? 0 : sev === "medium" ? 1 : 2;
}

function sevLabel(sev: ColdAuditFinding["severity"]): string {
  return sev === "high" ? "Critical" : sev === "medium" ? "Costly" : "Worth fixing";
}

// ── D3 · the only place the full finding list is ever touched ────────────────
// It hands back the findings that MAY be shown and a plain NUMBER for the ones
// that may not. Once this has returned there is nothing in scope holding the
// text of a withheld finding, so a future edit inside the JSX has nothing to
// render by accident — which is exactly how the CSS-blur version leaked.
function splitForTeaser(all: ColdAuditFinding[]): {
  visible: ColdAuditFinding[];
  withheldCount: number;
} {
  const sorted = [...all].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity)
  );
  // Show the strongest one or two in full — enough that the reader believes we
  // looked, not so much that there's nothing left to walk through on the call.
  // Only ever show two when at least one would still be held back.
  const shownCount = sorted.length > 2 ? 2 : 1;
  return {
    visible: sorted.slice(0, shownCount),
    withheldCount: Math.max(sorted.length - shownCount, 0),
  };
}

// ── D5 · HOW WE KNOW IT, ON EVERY FINDING ────────────────────────────────────
// The person reading this page has told us NOTHING. No intake form, no kickoff
// call, no conversation of any kind — a cold scan is all we have. So every
// finding has to be honest about where it came from, and on a cold scan there
// are only two honest answers:
//
//   observed  we measured it. State it flatly AND show the measurement — which
//             site we looked at, and when we looked.
//   inferred  we did not measure theirs. Say that in as many words, and let the
//             finding stand as a pattern they can confirm or kill on the call.
//
// "disclosed" is the third grade in the system and it is UNREACHABLE here: the
// read gate above throws on any stored audit carrying it. It is mapped onto the
// inferred treatment anyway, because if some future change ever did let one
// through, the failure has to land on under-claiming — never on a "you told
// us…" sentence about a conversation that never happened.
interface EvidenceTreatment {
  /** The short "how we know" stamp printed on the card. */
  stamp: string;
  /** The sentence admitting we have not measured theirs. Null when we have. */
  unmeasured: string | null;
  /** True for measured findings — used only to colour the stamp. */
  measured: boolean;
}

function evidenceTreatment(
  grade: ColdAuditFinding["evidenceGrade"],
  ctx: { businessName: string; industry: string; scanHost: string; scanDate: string }
): EvidenceTreatment | null {
  if (grade === "observed") {
    return {
      stamp: ctx.scanHost
        ? `Measured — ${ctx.scanHost}, ${ctx.scanDate}`
        : `Measured — your public pages, ${ctx.scanDate}`,
      unmeasured: null,
      measured: true,
    };
  }
  if (grade === "inferred" || grade === "disclosed") {
    const trade = ctx.industry?.trim()
      ? `in ${ctx.industry.trim().toLowerCase()}`
      : "in your trade";
    return {
      stamp: "Pattern — we have not measured yours",
      // "…comes off the list" is the paid pack's own wording for a finding the
      // client kills at kickoff. Same promise, same words, free and paid.
      unmeasured:
        `We have not measured this at ${ctx.businessName}. It is the pattern ${trade}, ` +
        `not a measurement of your business — a question for the call, and if it doesn't ` +
        `apply to you it comes off the list.`,
      measured: false,
    };
  }
  // No grade recorded — an audit generated before evidence grades existed. We do
  // not know how we came to know it, so we claim NEITHER: no stamp saying we
  // measured it, and no sentence claiming we didn't. The page-level scan note in
  // the outside/inside frame still tells the reader the whole page came off a
  // scan, so nothing here can read as something they told us.
  return null;
}

// Host of the site we scanned, for the measurement stamp. Falls back to an empty
// string rather than throwing on a malformed stored URL — a bad URL must not
// take out a prospect's page.
function scanHostOf(url: string | null | undefined): string {
  const raw = url?.trim();
  if (!raw) return "";
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(
      /^www\./i,
      ""
    );
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const report = await loadReport(params.publicId);
  if (!report) return { title: "Audit Not Found" };
  return {
    title: `Where ${report.businessName} is losing clients`,
    // The intro only — it is already printed at the top of the page, so nothing
    // withheld reaches a link preview either.
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

// The half a scan CAN see. Its twin — the half it can't — is PIVOT_SECTION_LABEL,
// imported from the document. The two are meant to read as a matched pair: the
// reader has to see them as two sections of one argument, because that argument
// is the only thing this page exists to get across.
//
// THESE ARE THE DOCUMENT'S EXACT WORDS, copied deliberately and under protest.
// Every other shared string on this page is imported; this one cannot be, because
// the renderer still writes it inline (cold-audit-html.ts, the section-label div
// above the findings) instead of exporting it. Matching words today beats a
// tidier page that says something different from the document a prospect is
// reading in the same email.
//
// HANDOFF (agent C): export this from cold-audit-html.ts beside
// PIVOT_SECTION_LABEL and use it in place of the inline literal —
//   export const SCAN_SECTION_LABEL = "What a scan can see from out here";
// then this constant becomes an import and the second copy is gone.
const SCAN_SECTION_LABEL = "What a scan can see from out here";

export default async function ColdAuditTeaserPage({ params }: PageProps) {
  const report = await loadReport(params.publicId);
  if (!report) notFound();

  const { visible, withheldCount } = splitForTeaser(report.findings ?? []);
  // D3 · findings are destructured OFF the report here and never used again. What
  // is left in `meta` is the report with no findings in it at all, so the JSX
  // below has no route to a withheld finding even by mistake.
  const { findings: _withheldNeverRendered, ...meta } = report;

  // D1/D4 · THE PIVOT QUESTIONS, ALL SIX, VERBATIM.
  //
  // These are PIVOT_QUESTIONS out of the document — the six invisible leaks in his
  // own phone words, and the questions he asks about each. Not the model's
  // free-typed `deeperLeakQuestions`: those are still generated (they are the
  // sanctioned place to park an invisible leak so it stays out of the findings),
  // but they are not what ships. A model rewords a plain phrase into consultant
  // vocabulary on every single run, and the match between what the prospect READS
  // here and what he HEARS on the Zoom is the entire effect. Not one of the six
  // strings is repeated in this file, not even in a comment — the constant name is
  // the only handle used here, so renaming a phrase upstream cannot leave a stale
  // copy behind on the page a prospect actually opens.
  //
  // NOT TRIMMED TO A TASTE. The old page sliced the question list to two. What
  // this page withholds is DEPTH — the remaining findings — never the pivot, and
  // the questions are the pivot. A prospect who leaves this page with four of the
  // six has been handed a smaller argument than the one the call is built on.
  const questions = PIVOT_QUESTIONS;

  // D2 · a second way to respond is a way not to book. A close that says "just
  // reply to this email" or "give me a ring" is a competing call to action sitting
  // directly above the one button on the page.
  //
  // The shared enforcer now swaps this too, so on today's code this never fires.
  // It stays because the rule it protects is THIS page's rule: one action, and it
  // is the booking link. Re-checking at the boundary that owns the rule costs a
  // regex and means a change upstream cannot quietly put a second ask back on a
  // prospect's screen. The fallback is the document's own string, so the swap can
  // never invent a close that exists only here.
  const closingMessage = ctaOffersCompetingChannel(meta.closingCta?.message)
    ? COLD_AUDIT_CTA_FALLBACK
    : meta.closingCta?.message;

  const scanDate = new Date(meta.generatedAt).toLocaleDateString();
  const scanHost = scanHostOf(meta.websiteUrl);
  const evidenceCtx = {
    businessName: meta.businessName,
    industry: meta.industry,
    scanHost,
    scanDate,
  };

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
            {meta.headline}
          </h1>
          {meta.intro && (
            <p
              style={{
                fontSize: 17,
                lineHeight: 1.55,
                color: C.inkMuted,
                margin: 0,
                maxWidth: "60ch",
              }}
            >
              {meta.intro}
            </p>
          )}
        </header>

        {/* ── THE FRAME, AND IT GOES BEFORE ANYTHING ELSE ──
            Imported from the document verbatim (OUTSIDE_INSIDE_FRAME), and
            positioned the way the document positions it: BEFORE a single finding
            lands. That ordering is the honesty move. A reader who reaches the
            questions section without having been told the scan is the small half
            experiences the pivot as us moving the goalposts; a reader told up
            front experiences it as the obvious next step — which is what it is.
            The scan line under it is the measurement made visible: which site,
            which day, and nothing more than that. */}
        <div
          style={{
            margin: "0 0 30px",
            padding: "22px 24px",
            background: C.surface,
            border: `1px dashed ${C.border}`,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              textTransform: "uppercase",
              letterSpacing: ".14em",
              fontSize: 11,
              fontWeight: 700,
              color: C.accent,
              marginBottom: 12,
            }}
          >
            {OUTSIDE_INSIDE_FRAME.label}
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: C.serif,
              fontSize: 17,
              lineHeight: 1.5,
              color: C.ink,
            }}
          >
            {OUTSIDE_INSIDE_FRAME.lead}
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14.5,
              lineHeight: 1.55,
              color: C.inkMuted,
            }}
          >
            {OUTSIDE_INSIDE_FRAME.body}
          </p>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 12.5,
              letterSpacing: ".02em",
              color: C.inkMuted,
            }}
          >
            Scanned: {scanHost || "your public pages"} · {scanDate}
          </p>
        </div>

        {/* Screenshot. The caption prints their URL as TEXT, never as a link —
            see the D2 note at the top of this file. */}
        {meta.screenshotUrl && (
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
              src={meta.screenshotUrl}
              alt={`${meta.businessName} website`}
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
              {meta.websiteUrl || meta.businessName} — as it looks today
            </figcaption>
          </figure>
        )}

        {/* Headline dollar leak */}
        {meta.headlineCost && (
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
              {meta.headlineCost}
            </p>
          </div>
        )}

        {/* ── THE HALF A SCAN CAN SEE ── the strongest findings, in full, each
            carrying the answer to "how do you know that?" ── */}
        {visible.length > 0 && (
          <>
            <div
              style={{
                textTransform: "uppercase",
                letterSpacing: ".16em",
                fontSize: 11,
                fontWeight: 700,
                color: C.accent,
                margin: "0 2px 6px",
              }}
            >
              {SCAN_SECTION_LABEL}
            </div>
            <div
              style={{
                fontFamily: C.serif,
                fontSize: 19,
                lineHeight: 1.35,
                color: C.ink,
                margin: "0 2px 16px",
              }}
            >
              {visible.length === 1
                ? "The most expensive leak we found"
                : "The two most expensive leaks we found"}
            </div>
            {visible.map((f, i) => {
              const ev = evidenceTreatment(f.evidenceGrade, evidenceCtx);
              return (
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
                      {(i + 1).toString().padStart(2, "0")}
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
                      {f.title}
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
                        border: `1px solid ${sevColor(f.severity)}`,
                        color: sevColor(f.severity),
                      }}
                    >
                      {sevLabel(f.severity)}
                    </span>
                  </div>

                  {/* D5 · the "how we know it" stamp. Measured findings carry the
                      measurement (site + date); pattern findings say so plainly.
                      Absent entirely on pre-Phase-1 audits, which recorded no
                      grade — we claim neither rather than guess. */}
                  {ev && (
                    <div
                      style={{
                        display: "inline-block",
                        marginBottom: 12,
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: ".02em",
                        background: C.surface2,
                        border: `1px solid ${C.border}`,
                        color: ev.measured ? C.low : C.inkMuted,
                      }}
                    >
                      {ev.stamp}
                    </div>
                  )}

                  <p style={{ margin: "0 0 14px", color: C.inkMuted }}>{f.problem}</p>
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
                    {f.whyItCosts}
                  </div>

                  {/* The admission, printed under the finding it belongs to: we
                      have not measured THIS at THIS business. It sits after the
                      cost box so the reader has the pattern and its cost first,
                      then the honest limit on what we can see. */}
                  {ev?.unmeasured && (
                    <p
                      style={{
                        margin: "12px 0 0",
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: C.inkMuted,
                      }}
                    >
                      {ev.unmeasured}
                    </p>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* ── THE HALF A SCAN CAN'T SEE ──
            The pivot, printed in full. Each row is one invisible leak in his own
            words and the question he asks about it — asked, never asserted,
            because we have measured none of them and asserting one on a page sent
            to somebody we have never spoken to would be inventing a fact about the
            inside of their business. The label and the intro are the document's,
            imported; so are all six pairs. */}
        <div
          style={{
            background: C.surface2,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "24px 26px",
            margin: "24px 0 14px",
          }}
        >
          <div
            style={{
              textTransform: "uppercase",
              letterSpacing: ".16em",
              fontSize: 11,
              fontWeight: 700,
              color: C.accent,
              marginBottom: 8,
            }}
          >
            {PIVOT_SECTION_LABEL}
          </div>
          <p
            style={{
              margin: "0 0 18px",
              fontFamily: C.serif,
              fontSize: 17,
              lineHeight: 1.45,
              color: C.ink,
            }}
          >
            {PIVOT_SECTION_INTRO}
          </p>
          <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {questions.map((q, i) => (
              <li
                key={q.leak}
                style={{
                  paddingTop: i === 0 ? 0 : 14,
                  marginTop: i === 0 ? 0 : 14,
                  borderTop: i === 0 ? "none" : `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: C.accent,
                    marginBottom: 5,
                  }}
                >
                  {q.leak}
                </div>
                <div style={{ fontSize: 15.5, lineHeight: 1.5, color: C.ink }}>
                  {q.ask}
                </div>
              </li>
            ))}
          </ol>
          {/* The document closes its pivot block on this one and so does this
              page: it is the question that opens the pricing conversation on the
              call, and it belongs at the end of the six rather than buried among
              them. Imported, so the two surfaces cannot end on different words. */}
          <p
            style={{
              margin: "18px 0 0",
              paddingTop: 16,
              borderTop: `1px solid ${C.border}`,
              fontFamily: C.serif,
              fontSize: 16,
              lineHeight: 1.5,
              color: C.ink,
            }}
          >
            {PIPELINE_DISCOVERY_QUESTION}
          </p>
        </div>

        {/* Withheld findings — COUNT ONLY. The cards below are placeholder bars
            with no report content in them; the withheld titles and problem text
            are never rendered, so view-source shows nothing but the number. The
            blur is decoration on top of already-empty markup, not the lock. */}
        {withheldCount > 0 && (
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
              {/* Cap the stack at three so a 5-finding audit doesn't render a
                  wall of grey — the count in the overlay carries the real number. */}
              {Array.from({ length: Math.min(withheldCount, 3) }).map((_, i) => (
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
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <span
                      style={{
                        display: "block",
                        width: 18,
                        height: 12,
                        borderRadius: 3,
                        background: C.surface2,
                      }}
                    />
                    <span
                      style={{
                        display: "block",
                        flex: 1,
                        height: 16,
                        maxWidth: `${68 - i * 9}%`,
                        borderRadius: 4,
                        background: C.surface2,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      display: "block",
                      height: 11,
                      borderRadius: 4,
                      background: C.surface2,
                      marginBottom: 8,
                    }}
                  />
                  <span
                    style={{
                      display: "block",
                      height: 11,
                      width: `${76 - i * 7}%`,
                      borderRadius: 4,
                      background: C.surface2,
                    }}
                  />
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
                {withheldCount} more {withheldCount === 1 ? "leak" : "leaks"} the scan
                found
              </div>
              {/* Says what is behind the blur (depth) and what is NOT (the
                  argument, which is already on this page in full) — so the reason
                  to book is the detail, never a withheld punchline. */}
              <div style={{ fontSize: 14, color: C.inkMuted, maxWidth: 380 }}>
                We&apos;ll walk every one of them on the call — and then spend most of
                it on the questions above, which are the bigger half.
              </div>
            </div>
          </div>
        )}

        {/* ── THE BOOKING ANCHOR ── D2: this block is the only place in this file
            that emits a link, and it emits exactly one. Do not add a second
            action here (no "download the PDF", no "see our site", no phone
            link) — every extra option is a way for the prospect not to book. */}
        {(closingMessage || BOOKING_URL) && (
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
            {closingMessage && (
              <p
                style={{
                  margin: 0,
                  fontFamily: C.serif,
                  fontSize: 20,
                  lineHeight: 1.45,
                  color: C.ink,
                }}
              >
                {closingMessage}
              </p>
            )}
            {/* D1 · what the call actually is. The teaser has to preview the
                PRODUCT, not only the problem — and at this stage the product on
                offer is the conversation, not the engagement. Said plainly, with
                no price and no pitch, because this document is not trying to
                close anybody. */}
            <p
              style={{
                margin: closingMessage ? "14px 0 0" : 0,
                fontSize: 14.5,
                lineHeight: 1.55,
                color: C.inkMuted,
              }}
            >
              Fifteen minutes. We walk the rest of what the scan found, then we ask
              you the questions above — the ones only you can answer — and you
              leave knowing what each gap is costing you either way.
            </p>
            {/* Only becomes a link once NEXT_PUBLIC_BOOKING_URL is configured —
                until then the close stays plain text rather than shipping a
                dead button to a prospect. */}
            {BOOKING_URL && (
              <a
                href={BOOKING_URL}
                style={{
                  display: "inline-block",
                  marginTop: 20,
                  padding: "13px 26px",
                  borderRadius: 999,
                  background: C.accent,
                  color: C.bg,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: ".01em",
                  textDecoration: "none",
                }}
              >
                {BOOKING_CTA_LABEL}
              </a>
            )}
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
          {[meta.businessName, scanDate, meta.agencyName !== "our team" ? meta.agencyName : null]
            .filter(Boolean)
            .join(" · ")}
        </footer>
      </div>
    </div>
  );
}
