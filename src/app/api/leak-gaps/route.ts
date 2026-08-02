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
// IT IS ALSO THE READ SIDE OF AN INPUT SURFACE. The panel renders a control on
// every collectible gap so the answer gets recorded in the row that asks for it,
// and then re-reads this route so the count visibly drops. That means it is now
// called several times during one 15-minute call rather than once — which is
// exactly why rule 1 below is not negotiable.
//
// THREE RULES THIS ROUTE EXISTS TO KEEP:
//
//  1. IT COSTS NOTHING TO OPEN. It reads the PERSISTED research + PageSpeed
//     snapshots straight off the Business row and never calls
//     resolveResearchSnapshot / resolvePsiSnapshot, because those CAPTURE when
//     the snapshot is missing or stale — every panel open would spend Firecrawl,
//     Places, DataForSEO and PageSpeed quota. An operator panel that bills for
//     being looked at is a panel he stops looking at. Detection itself is pure
//     CPU over the stored bundle, so re-reading after every answer is free.
//
//  2. NO SNAPSHOT MEANS "WE HAVEN'T LOOKED", NOT "NOTHING IS MISSING". With no
//     stored research there is nothing to run detection against, so the answer is
//     `scanned: false` and an empty list — and the UI says "run a scan first"
//     rather than rendering the empty list as a clean bill of health. An empty
//     list that means two opposite things is how a quality panel starts lying.
//
//  3. IT IS FED EXACTLY WHAT THE GENERATOR IS FED. This panel is a claim about
//     what the NEXT pack will say. Every intake answer the generator reads has to
//     be read here too — an answer this route silently ignores shows up as a
//     question the operator answers, watches not clear, and concludes is broken.
//     See the clientIntake block below: it mirrors /api/generate/assets field for
//     field, and the only deliberate omissions are documented there.

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
  PAST_CUSTOMER_CONTACT_OPTIONS,
  RESPONSE_SPEED_OPTIONS,
  REVIEW_REPLY_OWNER_OPTIONS,
  SOCIAL_ENQUIRIES_OPTIONS,
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
  socialEnquiries: string | null;
  pastCustomerContact: string | null;
  reviewReplyOwner: string | null;
};

/**
 * The stored answer for one intake field, in the TWO shapes the panel needs:
 *
 *   · `value` — the raw slug / boolean, which is what a control renders its
 *     selected state from. Without it the panel would have to map a human label
 *     back to an option to know which chip is lit, and a reverse lookup over
 *     labels is a second copy of the vocabulary free to disagree with the first.
 *   · `label` — the same answer in the operator's own words ("Not sure"), which
 *     is what the copy quotes back at him.
 *
 * Resolved together from ONE lookup, so the chip that lights up and the sentence
 * underneath it can never disagree about what is on file.
 */
interface StoredAnswer {
  value: string | boolean | null;
  label: string | null;
}

/** Nothing recorded. Both halves null — "never asked", which is emphatically not
 *  the same fact as "no" and must never be rendered as one. */
const NOT_ON_FILE: StoredAnswer = { value: null, label: null };

/** Look a stored slug up in the vocabulary the operator saw on the form, so the
 *  panel echoes his own words back ("Not sure") instead of a database slug. An
 *  unrecognised slug reads as unanswered in BOTH halves — it can't be shown in
 *  the control either, so claiming it as an answer on file would be a fiction. */
function fromOptions(
  raw: string | null,
  options: { value: string; label: string }[]
): StoredAnswer {
  if (!raw) return NOT_ON_FILE;
  const hit = options.find((o) => o.value === raw);
  return hit ? { value: hit.value, label: hit.label } : NOT_ON_FILE;
}

/** A yes/no column has three states, not two: true, false, and never-asked. The
 *  third one is a real answer and stays null here — collapsing it into "No" is
 *  the single mistake the whole evidence-grade system turns on. */
function fromBoolean(v: boolean | null): StoredAnswer {
  if (v === null) return NOT_ON_FILE;
  return { value: v, label: v ? "Yes" : "No" };
}

/**
 * THE ANSWER ALREADY ON FILE for the field a gap names, or NOT_ON_FILE when that
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
 *
 * EVERY FIELD ANY intakeAsk POINTS AT MUST HAVE AN ENTRY. Three of them
 * (socialEnquiries, pastCustomerContact, reviewReplyOwner) were missing, which
 * meant the questions that closed the last structural gaps were the only ones
 * whose recorded answer the panel could not show — and now that the panel is
 * where the answer gets typed, a field with no entry renders a control that never
 * shows what is already selected.
 */
const STORED_ANSWER: Partial<
  Record<keyof ClientIntake, (row: IntakeRow) => StoredAnswer>
> = {
  hasCrm: (r) => fromBoolean(r.hasCrm),
  hasFollowUpSequence: (r) => fromBoolean(r.hasFollowUpSequence),
  hasReminderSystem: (r) => fromBoolean(r.hasReminderSystem),
  hasPastCustomerDatabase: (r) => fromBoolean(r.hasPastCustomerDatabase),
  hasCallTracking: (r) => fromBoolean(r.hasCallTracking),
  hasOnlinePayment: (r) => fromBoolean(r.hasOnlinePayment),
  afterHoursHandling: (r) => fromOptions(r.afterHoursHandling, AFTER_HOURS_HANDLING_OPTIONS),
  missedCallHandling: (r) => fromOptions(r.missedCallHandling, MISSED_CALL_HANDLING_OPTIONS),
  responseSpeed: (r) => fromOptions(r.responseSpeed, RESPONSE_SPEED_OPTIONS),
  bookingMethod: (r) => fromOptions(r.bookingMethod, BOOKING_METHOD_OPTIONS),
  socialEnquiries: (r) => fromOptions(r.socialEnquiries, SOCIAL_ENQUIRIES_OPTIONS),
  pastCustomerContact: (r) => fromOptions(r.pastCustomerContact, PAST_CUSTOMER_CONTACT_OPTIONS),
  reviewReplyOwner: (r) => fromOptions(r.reviewReplyOwner, REVIEW_REPLY_OWNER_OPTIONS),
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
    // Everything the generator's intake carries, minus the two money numbers —
    // the six yes/no systems, the three "how is an enquiry handled today"
    // answers, how they book, and the four vocabulary answers that close the
    // last structural gaps. Every detector reads them; none of them reads a
    // number.
    //
    // THIS LIST HAS TO STAY EQUAL TO /api/generate/assets, and it did not: three
    // answers the detectors genuinely read (socialEnquiries, pastCustomerContact,
    // reviewReplyOwner) were absent here, so this panel kept reporting a leak as
    // still-guessed after the client had answered the very question that settles
    // it. That was survivable while the panel was only a to-do list. It is not
    // survivable now that the question is answered IN the panel: he clicks the
    // answer, the row refuses to clear, and the feature reads as broken. If you
    // add an intake field the detectors read, add it here in the same commit.
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
      // The four answers that closed the last structural evidence gaps, same
      // string-column convention as the three above. Each one genuinely moves a
      // leak, so leaving it out made this panel disagree with the pack:
      //   socialEnquiries     → social_dm_unmanaged. YES confirms it; NO and
      //                         NO_ACCOUNTS both suppress it entirely.
      //   pastCustomerContact → no_database_reactivation. SYSTEMATIC suppresses;
      //                         the other three confirm the list is going cold.
      //   reviewReplyOwner    → no_review_replies. NOBODY fires it as disclosed;
      //                         OWNER / STAFF_OR_AGENCY suppress it; unanswered
      //                         does not fire it at all. It can therefore never
      //                         appear as a collectible gap — it is carried so the
      //                         COUNTS (total / disclosed) match the pack's.
      //   takesDeposits       → NO leak reads it. It decides whether Text-to-Pay
      //                         is in the build. Carried purely so this object
      //                         stays field-for-field identical to the generator's,
      //                         because a partial copy is how the drift above got
      //                         in and stayed invisible.
      socialEnquiries:
        (business.socialEnquiries as ClientIntake["socialEnquiries"]) ?? undefined,
      pastCustomerContact:
        (business.pastCustomerContact as ClientIntake["pastCustomerContact"]) ?? undefined,
      reviewReplyOwner:
        (business.reviewReplyOwner as ClientIntake["reviewReplyOwner"]) ?? undefined,
      takesDeposits: (business.takesDeposits as ClientIntake["takesDeposits"]) ?? undefined,
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
        // it as one would be a permanent nag he can never clear, and it gets no
        // control in the panel for the same reason.
        structural.push({
          leakId: gap.leakId,
          leakName: gap.leakName,
          question: null,
          field: null,
          answerOnFile: null,
          currentValue: null,
        });
        continue;
      }
      const stored = STORED_ANSWER[gap.ask.field]?.(business) ?? NOT_ON_FILE;
      collectible.push({
        leakId: gap.leakId,
        leakName: gap.leakName,
        question: gap.ask.question,
        field: gap.ask.field,
        answerOnFile: stored.label,
        currentValue: stored.value,
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
