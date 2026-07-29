// /api/workflow-toggles — WHAT THIS CLIENT'S BUILD ACTUALLY CONTAINS.
//
// GET   ?businessId=…                    the resolved fourteen, with locks
// PATCH { businessId, workflowId, on }   persist ONE operator decision
//
// The arithmetic is NOT here. It is `resolveWorkflows` in src/lib/workflow-toggles.ts,
// which is pure and is the only place the precedence (operator > rule > default,
// except a locked workflow) is written down. This file does three things: check
// the caller owns the row, rebuild what detection needs from the snapshot already
// on disk, and refuse a write the resolver would not honour.
//
// THREE RULES THIS ROUTE EXISTS TO KEEP:
//
//  1. IT COSTS NOTHING TO OPEN. Detection runs ON DEMAND from the PERSISTED
//     researchSnapshot. It never calls resolveResearchSnapshot / resolvePsiSnapshot,
//     because those CAPTURE when the snapshot is missing or stale — every open of
//     the panel would spend Firecrawl, Places, DataForSEO and PageSpeed quota. An
//     operator panel that bills for being looked at is a panel he stops looking at.
//     (Same rule, same reason, as /api/leak-gaps.)
//
//  2. NO SNAPSHOT MEANS "WE HAVEN'T LOOKED", NOT "NOTHING IS LOCKED". With no
//     stored research there is nothing to detect against, so nothing can lock and
//     the list is defaults and rules only. The answer says `scanned: false` so the
//     UI can render an honest "run a scan first" instead of an all-defaults list
//     that reads like a considered result.
//
//  3. THE API REFUSES WHAT THE RESOLVER WOULD REFUSE. A locked workflow cannot be
//     switched off through this route. The resolver ignores a stored `false` under
//     a lock anyway, so accepting the write would only put a value in the database
//     that nothing honours — and the next person to read that column would believe
//     a decision was made that never took effect. A stale tab or a UI bug must not
//     be able to create that state.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import type { Business } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import { buildBusinessFacts } from "@/lib/business-facts";
import { buildScreenshotBundle } from "@/lib/screenshotone";
import { detectLeaks } from "@/lib/leak-detection";
import type { ClientIntake } from "@/lib/leak-taxonomy";
import { workflowById } from "@/lib/workflow-catalogue";
import {
  readStoredToggles,
  resolveWorkflows,
  resolvedWorkflowById,
  toTogglesResponse,
  withOverride,
  type ResolvedWorkflow,
} from "@/lib/workflow-toggles";
import type { ResearchBundle } from "@/lib/research-snapshot";
import type { PsiBundle } from "@/lib/pagespeed";

export const dynamic = "force-dynamic";

/** A stored snapshot is JSON, so it can predate today's shape or have been written
 *  by a run that half-failed. Detection would throw on a bundle missing
 *  `scrape` / `page`, and a 500 on an operator panel reads as "the app is broken"
 *  instead of "this client hasn't been scanned". A bundle that fails this check is
 *  treated exactly like no bundle at all: honest, and recoverable by running a scan.
 *  (Deliberately identical to the guard in /api/leak-gaps — see the note at the
 *  bottom of this file about extracting the pair.) */
function asResearchBundle(value: unknown): ResearchBundle | null {
  if (!value || typeof value !== "object") return null;
  const b = value as Partial<ResearchBundle>;
  // `subpages` is checked because both this route and toScrapeData spread it — an
  // old bundle without it would throw halfway through detection.
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

/**
 * THE INTAKE THE BUILD READS.
 *
 * Two of these columns are here for a reason that has nothing to do with leaks and
 * everything to do with what gets installed, so dropping one would silently change
 * a client's build:
 *
 *   · socialEnquiries — "NO_ACCOUNTS" is the applicability fact that switches the
 *     Social DM Capture workflow OFF. Without this column the rule can never
 *     evaluate and that workflow would be quoted to every client who has no
 *     Facebook or Instagram account at all.
 *   · hasPastCustomerDatabase — `false` is the applicability fact that switches
 *     Database Reactivation OFF. There is nobody to send to.
 *
 * The rest are the answers the DETECTORS read, which is what decides the grade a
 * leak carries and therefore which workflows lock.
 *
 * THE MONEY NUMBERS ARE DELIBERATELY ABSENT. Average customer value and enquiry
 * volume feed the dollar math in leak-narrative.ts and nothing else — they never
 * move a leak on or off the list, never change a grade, and so can never change a
 * toggle. Copying them in would buy no accuracy here and would fork the one
 * sanctioned crossing from the enquiry-volume column into its intake slot.
 */
function intakeOf(business: Business): ClientIntake {
  return {
    hasCrm: business.hasCrm ?? undefined,
    hasFollowUpSequence: business.hasFollowUpSequence ?? undefined,
    hasReminderSystem: business.hasReminderSystem ?? undefined,
    hasPastCustomerDatabase: business.hasPastCustomerDatabase ?? undefined,
    hasCallTracking: business.hasCallTracking ?? undefined,
    hasOnlinePayment: business.hasOnlinePayment ?? undefined,
    // Stored as plain Strings (no Prisma enums by convention); the Zod enum on the
    // write path is what guarantees only these slugs reach the column.
    afterHoursHandling:
      (business.afterHoursHandling as ClientIntake["afterHoursHandling"]) ?? undefined,
    missedCallHandling:
      (business.missedCallHandling as ClientIntake["missedCallHandling"]) ?? undefined,
    responseSpeed: (business.responseSpeed as ClientIntake["responseSpeed"]) ?? undefined,
    bookingMethod: (business.bookingMethod as ClientIntake["bookingMethod"]) ?? undefined,
    bookingToolName: business.bookingToolName ?? undefined,
    socialEnquiries: (business.socialEnquiries as ClientIntake["socialEnquiries"]) ?? undefined,
    pastCustomerContact:
      (business.pastCustomerContact as ClientIntake["pastCustomerContact"]) ?? undefined,
  };

  // NOT READ, ON PURPOSE: servicesFocus and buildPriorities. Both are COPY
  // EMPHASIS — which service gets named first, which phase leads the roadmap —
  // and neither may add, remove or reweight a workflow. "Which of these do you
  // want prioritized in your build?" reads exactly like a scoping question and is
  // not one: the client paid for fourteen workflows, and telling us which he cares
  // about most is not him cancelling the other thirteen.
}

/**
 * Resolve the fourteen for one business, from the research already on disk.
 *
 * Everything between here and `detectLeaks` mirrors /api/generate/assets and
 * /api/leak-gaps exactly, minus the live capture. That is the whole point: this
 * panel is a claim about what the next pack will contain, so it has to be fed what
 * the next pack is fed. Anything that drifts here makes the panel confidently
 * wrong about a client's build.
 */
function resolveForBusiness(business: Business): {
  scanned: boolean;
  researchAt: string | null;
  resolved: ResolvedWorkflow[];
} {
  const overrides = readStoredToggles(business.workflowToggles);
  const intake = intakeOf(business);

  const bundle = asResearchBundle(business.researchSnapshot);
  if (!bundle) {
    // NOTHING MEASURED, SO NOTHING LOCKS. The rules and defaults still resolve —
    // they read intake answers, not scans — so the operator gets a real, usable
    // list. What he does not get is any lock, and `scanned: false` is what tells
    // the screen to say so rather than let the absence read as an all-clear.
    return {
      scanned: false,
      researchAt: null,
      resolved: resolveWorkflows({ intake, firedLeaks: null, overrides }),
    };
  }

  const psi = asPsiBundle(business.psiSnapshot);
  const { page, reviews, competitors, scrape, dfs } = bundle;

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

  // Signal detection runs over the FULL post-JS DOM (rawHtml) across every scraped
  // page — GTM-injected chat/booking widgets and forms behind a click only surface
  // there. Cleaned `html` strips scripts and causes confident false negatives,
  // which here would become LOCKS on workflows whose leak never really fired.
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

  // POST-INTAKE, declared. This is a post-sale operator surface: the client has
  // paid and the build is being configured. Declaring it means the answer never
  // depends on whether intake happens to be empty.
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
    intake,
    asOf: bundle.asOf,
  });

  return {
    scanned: true,
    // The capture date, surfaced rather than refreshed. A stale snapshot is still
    // the picture this panel is reading, and saying when it was taken is the
    // honest alternative to quietly re-scraping to freshen it.
    researchAt: business.researchSnapshotAt?.toISOString() ?? bundle.asOf ?? null,
    // `report`, not `fired`: the lock's whole justification is that the client's
    // report carries the finding, so it must be resolved against the set that
    // report actually prints — in-scope, ranked, with the long-cycle-nurture
    // fold-in applied. Locking on a fire the document never mentions would give an
    // operator a disabled switch he cannot explain to anyone.
    resolved: resolveWorkflows({ intake, firedLeaks: detected.report, overrides }),
  };
}

async function loadBusiness(businessId: string, userId: string) {
  // Session-scoped like every other read here: the row must belong to the caller
  // and must not be soft-deleted.
  return prisma.business.findFirst({
    where: { id: businessId, userId, deletedAt: null },
  });
}

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

    const business = await loadBusiness(businessId, session.user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { scanned, researchAt, resolved } = resolveForBusiness(business);
    return NextResponse.json(
      toTogglesResponse({ businessId: business.id, scanned, researchAt, resolved })
    );
  } catch (error) {
    console.error("workflow-toggles GET error:", error);
    return NextResponse.json({ error: "Failed to read workflow toggles" }, { status: 500 });
  }
}

/** ONE decision per call. Deliberately not a whole map: a payload carrying all
 *  fourteen would let a stale tab overwrite a decision made in another tab
 *  seconds earlier, and an operator who loses a decision he watched himself make
 *  stops trusting the screen. */
const patchSchema = z.object({
  businessId: z.string().min(1, "Missing businessId"),
  workflowId: z.string().min(1, "Missing workflowId"),
  on: z.boolean({ required_error: "Missing on", invalid_type_error: "`on` must be true or false" }),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { businessId, workflowId, on } = parsed.data;

    // AN UNKNOWN ID IS REFUSED RATHER THAN STORED. Workflow ids are append-only
    // and this column is keyed by them, so a typo written here would sit in the
    // JSON forever, matching nothing and explaining nothing.
    const workflow = workflowById(workflowId);
    if (!workflow) {
      return NextResponse.json(
        { error: `Unknown workflow "${workflowId}" — not one of the 14 in the catalogue.` },
        { status: 400 }
      );
    }

    const business = await loadBusiness(businessId, session.user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Resolve BEFORE writing, against the same evidence the screen was rendered
    // from, so the refusal below is decided by the same function that will decide
    // what the client's build contains.
    const before = resolveForBusiness(business);
    const current = resolvedWorkflowById(before.resolved, workflowId);

    // THE REFUSAL. Switching off a workflow held on by a measurement is not a
    // decision the resolver would honour, so it is not a decision this route will
    // store. The message names the measurement, because "not allowed" with no
    // reason is how an operator ends up power-cycling a page at 11pm.
    if (on === false && current?.locked) {
      return NextResponse.json(
        {
          error: `"${workflow.name}" can't be switched off for this client.`,
          reason: current.lockReason,
          workflowId,
          locked: true,
        },
        { status: 409 }
      );
    }

    const next = withOverride(readStoredToggles(business.workflowToggles), workflowId, on);

    const updated = await prisma.business.updateMany({
      where: { id: businessId, userId: session.user.id, deletedAt: null },
      data: { workflowToggles: next },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Re-resolve and return the WHOLE set, not just the row that changed. One
    // decision can only move one workflow today, but the screen re-rendering from
    // the same payload a fresh GET would give is what guarantees it can never
    // drift from the server — and the day a decision does move something else,
    // this needs no change.
    const after = resolveForBusiness({ ...business, workflowToggles: next });
    return NextResponse.json(
      toTogglesResponse({
        businessId: business.id,
        scanned: after.scanned,
        researchAt: after.researchAt,
        resolved: after.resolved,
      })
    );
  } catch (error) {
    console.error("workflow-toggles PATCH error:", error);
    return NextResponse.json({ error: "Failed to save workflow toggle" }, { status: 500 });
  }
}

// FOR WHOEVER TOUCHES THIS NEXT: `asResearchBundle`, `asPsiBundle` and the whole
// snapshot → detection rebuild above are now duplicated between this route and
// /api/leak-gaps, character for character. They belong in one helper (a
// `detectFromSnapshot(business)` in src/lib — the natural home is next to
// resolveResearchSnapshot). They were not extracted here because that file has
// another owner this session and two agents editing it concurrently is worse than
// one duplicated block. Extract it, and both panels keep agreeing with the pack.
