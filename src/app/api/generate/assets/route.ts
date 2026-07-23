import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAssetsSchema } from "@/lib/validations";
import { checkPlanLimit } from "@/lib/limits";
import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import { buildBusinessFacts } from "@/lib/business-facts";
import { resolvePsiSnapshot } from "@/lib/psi-snapshot";
import { resolveResearchSnapshot } from "@/lib/research-snapshot";
import { buildScreenshotBundle } from "@/lib/screenshotone";
import {
  generateAssetPack,
  generateOneSection,
  buildMeta,
  ASSET_PACK_PARTS,
  type GenerationContext,
  type LeakContext,
} from "@/lib/asset-generation";
import { detectLeaks } from "@/lib/leak-detection";
import { buildPriorityLabels } from "@/lib/intake-options";
import {
  buildLeakInputs,
  leakInputsToPromptBlock,
  allowedNumbersFor,
  voiceLint,
} from "@/lib/leak-narrative";
import type { AssetPack } from "@/types";

export const dynamic = "force-dynamic";
// Enrichment + five-deliverable generation is heavy; give it as much room as the
// platform allows.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limitCheck = await checkPlanLimit(session.user.id, "generations");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Generation limit reached (${limitCheck.limit}). Upgrade to Pro for unlimited.`,
          limitReached: true,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = generateAssetsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const business = await prisma.business.findFirst({
      where: { id: parsed.data.businessId, userId: session.user.id, deletedAt: null },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // ── Enrichment: ground the pack in the live site, real reviews, and local
    // competitors plus the premium signals (Firecrawl, PageSpeed, DataForSEO,
    // ScreenshotOne). The research bundle (native page, reviews, competitors,
    // Firecrawl scrape, DataForSEO) is captured ONCE and reused verbatim on every
    // regenerate — a plain regenerate is a zero-scrape, zero-API-cost operation.
    // Only the deliberate "refresh research" action (refreshResearch) busts the
    // snapshot and re-measures. PSI is kept in lockstep on the same refresh flag.
    const refreshResearch = parsed.data.refreshResearch ?? false;
    const [research, psi] = await Promise.all([
      resolveResearchSnapshot(business, { forceRefresh: refreshResearch }),
      resolvePsiSnapshot(business, { forceRefresh: refreshResearch }),
    ]);
    const { page, reviews, competitors, scrape, dfs } = research;

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
      competitors: competitors.map((c) => ({
        url: c.website ?? null,
        label: `Competitor: ${c.name}`,
      })),
    });

    // Prefer the richer Firecrawl markdown when we have it, else fall back to
    // the native scrape (still useful for legacy / Firecrawl-disabled runs).
    const websiteTextForPrompt = scrape.used && scrape.homepage
      ? [scrape.homepage.markdown, ...scrape.subpages.map((s) => s.markdown)]
          .filter(Boolean)
          .join("\n\n---\n\n")
          .slice(0, 18000)
      : page.text;

    // Signal detection runs over the FULL post-JS DOM (rawHtml) across every
    // scraped page — GTM-injected chat/booking widgets and forms behind a click
    // only surface in rawHtml, and only on the subpage that hosts them.
    const websiteHtmlForSignals = scrape.used && scrape.homepage
      ? [scrape.homepage, ...scrape.subpages]
          .map((p) => p.rawHtml || p.html)
          .filter(Boolean)
          .join("\n\n") || page.html
      : page.html;

    const intel = buildAuditIntelligence({
      websiteHtml: websiteHtmlForSignals,
      hasWebsiteUrl: Boolean(business.website),
      reviews,
      competitors,
      self: { rating: business.rating, reviewCount: business.reviewCount },
      verifiedFacts,
      performance: psi,
      dataForSeo: dfs,
      screenshots,
    });

    // ── Governance: run the closed leak taxonomy over the real research so every
    // deliverable is grounded ONLY in leaks that actually fired, graded
    // deterministically, with a bounded allowed-number set (Phases 1–5).
    // Deliverable numbers (manually entered on the Business record) drive REAL-mode
    // math in D1–D4. Blank → intake stays undefined → the deliverables render in
    // BENCHMARK mode. We map the operator's inquiry count onto both lead- and
    // call-volume slots (inbound inquiries stand in for the call-volume the
    // missed-call math needs). A single provided field is enough to flip a
    // document to real mode for the templates that can use it.
    // Intake booleans (null = unknown/not asked) join the numbers here: any one
    // provided flips this business out of the pure pre-intake path. Booleans drive
    // confirmed-vs-benchmark leak framing; `true` suppresses the matching leak.
    const hasAnyIntake =
      business.avgClientValueCad != null ||
      business.monthlyLeadVolume != null ||
      business.hasCrm != null ||
      business.hasFollowUpSequence != null ||
      business.hasReminderSystem != null ||
      business.hasPastCustomerDatabase != null ||
      business.bookingMethod != null ||
      business.gbpManagement != null ||
      business.buildPriorities != null;
    const clientIntake = hasAnyIntake
      ? {
          avgJobValueCad: business.avgClientValueCad ?? undefined,
          monthlyLeadVolume: business.monthlyLeadVolume ?? undefined,
          monthlyCallVolume: business.monthlyLeadVolume ?? undefined,
          hasCrm: business.hasCrm ?? undefined,
          hasFollowUpSequence: business.hasFollowUpSequence ?? undefined,
          hasReminderSystem: business.hasReminderSystem ?? undefined,
          hasPastCustomerDatabase: business.hasPastCustomerDatabase ?? undefined,
          bookingMethod:
            (business.bookingMethod as "PHONE_EMAIL_ONLY" | "BOOKING_TOOL" | "OTHER" | null) ??
            undefined,
          bookingToolName: business.bookingToolName ?? undefined,
        }
      : undefined;
    // Booking-tool reframe copy fires only when the client both books via a tool
    // AND named it. GBP framing + build-priority ordering are pure copy emphasis.
    const bookingToolName =
      business.bookingMethod === "BOOKING_TOOL"
        ? business.bookingToolName?.trim() || undefined
        : undefined;
    const buildPriorities = buildPriorityLabels(business.buildPriorities);

    // No intake at all → this is the pure pre-intake TESTING path. Every document
    // cover will carry an "INTERNAL TEST — generated without client intake" marker
    // (driven by ctx.intakePresent → meta.internalTest). Log it loudly at
    // generation time so a test pack is never mistaken for a client-ready one.
    if (!hasAnyIntake) {
      console.warn(
        `[generate/assets] INTERNAL TEST pack — no client intake for business ${business.id} (${business.name}). Deliverables will be watermarked. Add intake to remove the marker.`
      );
    }

    // Services they want more of — COPY EMPHASIS ONLY (never a fact/leak/number).
    // Runs through the same voice lint as generated copy before it reaches a prompt.
    let servicesFocus: string | undefined;
    const rawFocus = business.servicesFocus?.trim();
    if (rawFocus) {
      let cleaned = rawFocus;
      for (const hit of voiceLint(rawFocus).hits) {
        const re = new RegExp(hit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");
        cleaned = cleaned.replace(re, "");
      }
      cleaned = cleaned.replace(/\s+/g, " ").trim();
      servicesFocus = cleaned || undefined;
    }

    const detected = detectLeaks({
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
      placeReviews: reviews,
      intake: clientIntake,
      asOf: research.asOf,
    });
    const leakInputs = buildLeakInputs(detected.report, detected.data);
    const leaks: LeakContext = {
      report: detected.report,
      coldAudit: detected.coldAudit,
      outOfScope: detected.outOfScope,
      grades: detected.grades,
      promptBlock: leakInputsToPromptBlock(leakInputs),
      allowedNumbers: allowedNumbersFor(detected.report, detected.data),
      inputs: leakInputs,
    };

    const ctx: GenerationContext = {
      business: {
        name: business.name,
        industry: business.industry,
        category: business.category,
        city: business.city,
        rating: business.rating,
        reviewCount: business.reviewCount,
        website: business.website,
        description: business.description,
      },
      intel,
      websiteText: websiteTextForPrompt,
      leaks,
      servicesFocus,
      intakePresent: hasAnyIntake,
      bookingToolName,
      gbpManagement: business.gbpManagement ?? undefined,
      buildPriorities,
    };

    // ── Regenerate a single deliverable, merging into the latest stored pack.
    if (parsed.data.section) {
      const latest = await prisma.generatedSystem.findFirst({
        where: {
          businessId: business.id,
          userId: session.user.id,
          type: "ASSETS",
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!latest) {
        return NextResponse.json(
          { error: "Generate the full pack before regenerating a section." },
          { status: 400 }
        );
      }

      const existing = latest.content as unknown as AssetPack;
      const regenerated = await generateOneSection(parsed.data.section, ctx);

      const merged: AssetPack = {
        ...existing,
        meta: buildMeta(ctx),
        [parsed.data.section]: regenerated,
      } as AssetPack;

      const system = await prisma.generatedSystem.update({
        where: { id: latest.id },
        data: { content: merged as unknown as object },
      });

      return NextResponse.json({ system, assetPack: merged });
    }

    // ── Full pack: all nine deliverables, streamed. We emit newline-delimited
    // JSON progress events as each deliverable actually resolves, so the client
    // shows true completion (not a guessed timer), then a final "done" event
    // carrying the pack. Generation no longer persists on its own — the operator
    // decides what's worth keeping via "Save to library" (POST /api/assets/save).
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        try {
          // Enrichment already finished above; it's the first of 10 total steps.
          send({
            type: "progress",
            completed: 1,
            total: ASSET_PACK_PARTS + 1,
            label: "Research complete — writing deliverables",
          });
          const assetPack = await generateAssetPack(ctx, (done, total, label) => {
            send({ type: "progress", completed: done + 1, total: total + 1, label });
          });
          send({ type: "done", assetPack });
        } catch (err) {
          console.error("Generate assets stream error:", err);
          const s =
            typeof err === "object" && err !== null && "status" in err
              ? (err as { status?: number }).status
              : undefined;
          send({
            type: "error",
            status: s ?? 500,
            error:
              s === 429
                ? "The AI provider is rate-limiting this account right now. Wait a minute and try again."
                : "Failed to generate asset pack",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Generate assets error:", error);
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: number }).status
        : undefined;
    if (status === 429) {
      return NextResponse.json(
        {
          error:
            "The AI provider is rate-limiting this account right now. Wait a minute and try again.",
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate asset pack" },
      { status: 500 }
    );
  }
}
