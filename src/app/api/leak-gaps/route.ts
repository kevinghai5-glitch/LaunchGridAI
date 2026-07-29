// GET /api/leak-gaps?businessId=… — WHAT WE STILL DON'T KNOW ABOUT THIS CLIENT.
//
// Every leak that is still graded "inferred" after intake is a leak the paid
// deliverables MUST hedge: "most plumbing businesses…, we haven't measured yours."
// A hedge is weaker copy than a stated fact, and the fix is almost always one
// question that never got asked on the kickoff call. This route turns that
// invisible quality problem into a list the operator can act on before he
// generates — the leaks still guessed, and the exact question that would move
// each one from a guess to something the client told us.
//
// TWO RULES THIS ROUTE EXISTS TO KEEP:
//
//  1. IT COSTS NOTHING TO OPEN. It reads the PERSISTED research + PageSpeed
//     snapshots straight off the Business row and never calls
//     resolveResearchSnapshot / resolvePsiSnapshot, because those CAPTURE when
//     the snapshot is missing or stale — every panel open would spend Firecrawl,
//     Places, DataForSEO and PageSpeed quota. An operator panel that bills for
//     being looked at is a panel he stops looking at.
//
//  2. NO SNAPSHOT MEANS "WE HAVEN'T LOOKED", NOT "NOTHING IS MISSING". With no
//     stored research there is nothing to run detection against, so the answer is
//     `scanned: false` and an empty list — and the UI says "run a scan first"
//     rather than rendering the empty list as a clean bill of health. An empty
//     list that means two opposite things is how a quality panel starts lying.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import { buildBusinessFacts } from "@/lib/business-facts";
import { buildScreenshotBundle } from "@/lib/screenshotone";
import { detectLeaks } from "@/lib/leak-detection";
import { inferredGaps, type ClientIntake } from "@/lib/leak-taxonomy";
import {
  AFTER_HOURS_HANDLING_OPTIONS,
  BOOKING_METHOD_OPTIONS,
  MISSED_CALL_HANDLING_OPTIONS,
  RESPONSE_SPEED_OPTIONS,
} from "@/lib/intake-options";
import type { ResearchBundle } from "@/lib/research-snapshot";
import type { PsiBundle } from "@/lib/pagespeed";
// The response contract lives with its only consumer. Phase 1 adds no lib
// module to hang it on, and Next type-checks the VALUE exports of a route file
// against a fixed list — so the shape is declared in the panel and imported here
// type-only (erased at compile time, so no component code reaches the server
// bundle). One declaration, so the panel can never disagree with the payload.
import type { LeakGap, LeakGapsResponse } from "@/components/businesses/IntakeGaps";

export const dynamic = "force-dynamic";

/** Fields on the Business row that can carry an intake answer. Deliberately the
 *  row itself — the answers are columns, not a nested object. */
type IntakeRow = {
  hasCrm: boolean | null;
  hasFollowUpSequence: boolean | null;
  hasReminderSystem: boolean | null;
  hasPastCustomerDatabase: boolean | null;
  hasCallTracking: boolean | null;
  hasOnlinePayment: boolean | null;
  afterHoursHandling: string | null;
  missedCallHandling: string | null;
  responseSpeed: string | null;
  bookingMethod: string | null;
};

/** Look a stored slug up in the vocabulary the operator saw on the form, so the
 *  panel echoes his own words back ("Not sure") instead of a database slug. An
 *  unrecognised slug reads as unanswered — it can't be shown in the control
 *  either, so claiming it as an answer on file would be a fiction. */
function optionLabel(
  raw: string | null,
  options: { value: string; label: string }[]
): string | null {
  if (!raw) return null;
  return options.find((o) => o.value === raw)?.label ?? null;
}

const YES_NO = (v: boolean | null): string | null =>
  v === true ? "Yes" : v === false ? "No" : null;

/**
 * THE ANSWER ALREADY ON FILE for the field a gap names, or null when that
 * question was never answered. This is the difference between the two reasons a
 * leak is still guessed, and the operator needs them apart:
 *   · nothing on file  → he never asked. Ask it.
 *   · something on file → he asked and got "not sure" / "we don't track it".
 *     Re-asking the same way gets the same answer; this one needs a different
 *     conversation, not a repeat.
 *
 * Keyed by the ClientIntake field an IntakeAsk names, typed against that key so a
 * renamed field breaks the build here too. A field with no entry reads as
 * unanswered — the safe default, because it lands the gap in the to-do list
 * where it will be looked at, rather than silently claiming an answer we can't
 * actually show.
 */
const ANSWER_ON_FILE: Partial<
  Record<keyof ClientIntake, (row: IntakeRow) => string | null>
> = {
  hasCrm: (r) => YES_NO(r.hasCrm),
  hasFollowUpSequence: (r) => YES_NO(r.hasFollowUpSequence),
  hasReminderSystem: (r) => YES_NO(r.hasReminderSystem),
  hasPastCustomerDatabase: (r) => YES_NO(r.hasPastCustomerDatabase),
  hasCallTracking: (r) => YES_NO(r.hasCallTracking),
  hasOnlinePayment: (r) => YES_NO(r.hasOnlinePayment),
  afterHoursHandling: (r) => optionLabel(r.afterHoursHandling, AFTER_HOURS_HANDLING_OPTIONS),
  missedCallHandling: (r) => optionLabel(r.missedCallHandling, MISSED_CALL_HANDLING_OPTIONS),
  responseSpeed: (r) => optionLabel(r.responseSpeed, RESPONSE_SPEED_OPTIONS),
  bookingMethod: (r) => optionLabel(r.bookingMethod, BOOKING_METHOD_OPTIONS),
};

/** A stored snapshot is JSON, which means it can predate today's shape or have
 *  been written by a run that half-failed. Detection would throw on a bundle
 *  missing `scrape` / `page`, and a 500 on an operator panel reads as "the app is
 *  broken" instead of "this client hasn't been scanned". A bundle that fails this
 *  check is treated exactly like no bundle at all: honest, and recoverable by
 *  running a scan. */
function asResearchBundle(value: unknown): ResearchBundle | null {
  if (!value || typeof value !== "object") return null;
  const b = value as Partial<ResearchBundle>;
  // `subpages` is checked because both this route and toScrapeData spread it —
  // an old bundle without it would throw halfway through detection, which is a
  // 500 for a panel whose honest answer is "this client hasn't been scanned".
  if (!b.scrape || !b.page || !Array.isArray(b.scrape.subpages)) return null;
  return b as ResearchBundle;
}

/** PageSpeed is optional to detection (buildAuditIntelligence takes null and
 *  records the gap as an assumption), so a missing measurement degrades the
 *  picture instead of blocking it. */
function asPsiBundle(value: unknown): PsiBundle | null {
  if (!value || typeof value !== "object") return null;
  return "available" in value ? (value as PsiBundle) : null;
}

const EMPTY_COUNTS = { total: 0, observed: 0, disclosed: 0, inferred: 0 } as const;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const businessId = req.nextUrl.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
    }

    // Session-scoped like every other read here: the row must belong to the
    // caller and must not be soft-deleted.
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: session.user.id, deletedAt: null },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const bundle = asResearchBundle(business.researchSnapshot);
    if (!bundle) {
      const unscanned: LeakGapsResponse = {
        businessId: business.id,
        scanned: false,
        researchAt: null,
        counts: { ...EMPTY_COUNTS },
        collectible: [],
        structural: [],
      };
      return NextResponse.json(unscanned);
    }
    const psi = asPsiBundle(business.psiSnapshot);
    const { page, reviews, competitors, scrape, dfs } = bundle;

    // ── Rebuild detection's inputs from the stored snapshot ────────────────────
    // Everything below mirrors /api/generate/assets EXACTLY, minus the live
    // capture. That is the whole point: this panel is a claim about what the next
    // pack will say, so it has to be fed what the next pack is fed. Anything that
    // drifts here makes the panel confidently wrong.
    const verifiedFacts = buildBusinessFacts({
      scrape,
      fallbackText: page.text,
      places: {
        name: business.name,
        phone: business.phone,
        address: business.address,
        website: business.website,
      },
      ownerName: business.ownerName,
    });

    const screenshots = buildScreenshotBundle({
      target: { url: business.website, label: `${business.name} (Target)` },
      competitors: (competitors ?? []).map((c) => ({
        url: c.website ?? null,
        label: `Competitor: ${c.name}`,
      })),
    });

    // Signal detection runs over the FULL post-JS DOM (rawHtml) across every
    // scraped page — GTM-injected chat/booking widgets and forms behind a click
    // only surface there. Cleaned `html` strips scripts and causes confident
    // false negatives, which would show up here as leaks that look measured.
    const websiteHtmlForSignals =
      scrape.used && scrape.homepage
        ? [scrape.homepage, ...scrape.subpages]
            .map((p) => p.rawHtml || p.html)
            .filter(Boolean)
            .join("\n\n") || page.html
        : page.html;

    const intel = buildAuditIntelligence({
      websiteHtml: websiteHtmlForSignals,
      hasWebsiteUrl: Boolean(business.website),
      reviews: reviews ?? [],
      competitors: competitors ?? [],
      self: { rating: business.rating, reviewCount: business.reviewCount },
      verifiedFacts,
      performance: psi,
      dataForSeo: dfs ?? null,
      screenshots,
    });

    // ── The intake the DETECTORS read ─────────────────────────────────────────
    // The answers below are exactly the ones that change which leaks fire and how
    // each one is graded — the six yes/no systems, the three "how is an enquiry
    // handled today" answers, and how they book. Every detector reads them; none
    // of them reads a number.
    //
    // THE TWO MONEY NUMBERS ARE DELIBERATELY ABSENT, and it is not an oversight.
    // The client's average customer value and enquiry count feed the DOLLAR MATH
    // in leak-narrative.ts and nothing else: they move a figure from benchmark
    // mode to "based on the numbers you provided", and they never move a leak on
    // or off the list or change its grade. Since this panel answers one question
    // — what will still be hedged — copying them in would buy no accuracy, and it
    // would fork the ONE sanctioned crossing from the enquiry-volume column into
    // its intake slot (asserted to exist exactly once by verify-phase06 B5, so
    // that a client's real volume can never be silently dropped or double-mapped).
    // One crossing, in the generator, where it actually gets spent.
    const clientIntake: ClientIntake = {
      hasCrm: business.hasCrm ?? undefined,
      hasFollowUpSequence: business.hasFollowUpSequence ?? undefined,
      hasReminderSystem: business.hasReminderSystem ?? undefined,
      hasPastCustomerDatabase: business.hasPastCustomerDatabase ?? undefined,
      hasCallTracking: business.hasCallTracking ?? undefined,
      hasOnlinePayment: business.hasOnlinePayment ?? undefined,
      // Stored as plain Strings (no Prisma enums by convention); the Zod enum on
      // the write path is what guarantees only these slugs reach the column.
      afterHoursHandling:
        (business.afterHoursHandling as ClientIntake["afterHoursHandling"]) ?? undefined,
      missedCallHandling:
        (business.missedCallHandling as ClientIntake["missedCallHandling"]) ?? undefined,
      responseSpeed: (business.responseSpeed as ClientIntake["responseSpeed"]) ?? undefined,
      bookingMethod: (business.bookingMethod as ClientIntake["bookingMethod"]) ?? undefined,
      bookingToolName: business.bookingToolName ?? undefined,
    };

    // POST-INTAKE, declared. This is a post-sale operator surface, and declaring
    // it means the answer never depends on whether intake happens to be empty —
    // a client with nothing filled in is exactly the client this panel is for.
    const detected = detectLeaks({
      mode: "post_intake",
      business: {
        name: business.name,
        industry: business.industry,
        category: business.category,
        city: business.city,
        phone: business.phone,
        website: business.website,
        rating: business.rating,
        reviewCount: business.reviewCount,
      },
      intel,
      scrape,
      fallbackText: page.text,
      placeReviews: reviews ?? [],
      intake: clientIntake,
      asOf: bundle.asOf,
    });

    // `report`, not `fired`: this is the set of leaks the client-facing report
    // will actually carry (in-scope, ranked, with the long-cycle-nurture fold-in
    // applied). Counting off `fired` would put a leak on his to-do list that the
    // document never prints — a chore he can't clear by asking anything.
    const report = detected.report;
    const counts = {
      total: report.length,
      observed: report.filter((f) => f.grade === "observed").length,
      disclosed: report.filter((f) => f.grade === "disclosed").length,
      inferred: report.filter((f) => f.grade === "inferred").length,
    };

    // Agent A's catalogue query. It reads the grade each fire already CARRIES
    // rather than recomputing it, so this list can never disagree with the voice
    // the deliverable actually uses.
    const gaps = inferredGaps(report);
    const collectible: LeakGap[] = [];
    const structural: LeakGap[] = [];
    for (const gap of gaps) {
      if (!gap.ask) {
        // No question we ask can settle this one. It is NOT a to-do — presenting
        // it as one would be a permanent nag he can never clear.
        structural.push({
          leakId: gap.leakId,
          leakName: gap.leakName,
          question: null,
          field: null,
          answerOnFile: null,
        });
        continue;
      }
      collectible.push({
        leakId: gap.leakId,
        leakName: gap.leakName,
        question: gap.ask.question,
        field: gap.ask.field,
        answerOnFile: ANSWER_ON_FILE[gap.ask.field]?.(business) ?? null,
      });
    }

    const body: LeakGapsResponse = {
      businessId: business.id,
      scanned: true,
      // The capture date, surfaced rather than refreshed. A stale snapshot is
      // still the picture this panel is reading, and saying when it was taken is
      // the honest alternative to quietly re-scraping to freshen it.
      researchAt: business.researchSnapshotAt?.toISOString() ?? bundle.asOf ?? null,
      counts,
      collectible,
      structural,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("leak-gaps error:", error);
    return NextResponse.json({ error: "Failed to read leak gaps" }, { status: 500 });
  }
}
