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
import { materializeScreenshotBundle } from "@/lib/screenshot-store";
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
import { assertPackValid, type ValidationCheck } from "@/lib/exporters/validate-pack";
import {
  DELIVERABLES,
  deliverableContext,
  renderDeliverableHtml,
} from "@/lib/exporters/deliverables";
import { readComputed } from "@/lib/client-offer";
import type { ComputedAssessment } from "@/lib/leak-calculator";
import type { AssetPack } from "@/types";

export const dynamic = "force-dynamic";
// Enrichment + five-deliverable generation is heavy; give it as much room as the
// platform allows.
export const maxDuration = 300;

/** One operator-facing line for a pack the validator refused (F1).
 *
 *  `verdict.report` lists EVERY check, passes included — that is right for a CLI
 *  and unusable in a toast, so it rides along in the payload while this names the
 *  laws that actually broke. Deduped: a single law can fail more than once. */
/** The visible words of the three RENDERED documents.
 *
 *  THE GATE MUST JUDGE WHAT SHIPS. It used to validate the whole pack object,
 *  which still carries sections no document renders — the generated leak
 *  analysis chief among them. So generation refused a pack over a sentence in
 *  `intelligence.leakAnalysis` that no client could ever read, and the dialog's
 *  own advice ("regenerate") produced the same refusal every time: a loop with
 *  no exit.
 *
 *  The laws are unchanged and still block. They are simply read against the
 *  documents rather than the JSON around them. */
function renderedTextFor(
  pack: AssetPack,
  input: { assessment: ComputedAssessment | null; workflowToggles: unknown; kickoffAt: Date | null }
): string {
  const ctx = deliverableContext(input);
  return DELIVERABLES.map((d) => renderDeliverableHtml(pack, d.id, ctx))
    .join("\n")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

function invalidPackMessage(fails: ValidationCheck[]): string {
  const laws = Array.from(new Set(fails.map((f) => f.law)));
  return `This pack fails ${fails.length} of its own deliverable law${
    fails.length === 1 ? "" : "s"
  } and was not saved: ${laws.join(", ")}. Fix the inputs and regenerate before it goes near a client.`;
}

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
      // `computed` rides along so the generation gate can render the Diagnosis and
      // judge the DOCUMENTS rather than the raw pack (see renderedTextFor).
      include: {
        leakAssessment: { select: { monthlyEnquiries: true, avgJobValue: true, computed: true } },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // ── THE TWO NUMBERS COME FROM THE ASSESSMENT, AND ONLY FROM THERE ─────────
    // They used to live on Business.monthlyLeadVolume / avgClientValueCad, with
    // the intake screen mirroring every save onto those columns so this path kept
    // working mid-rebuild. That mirror is gone: two writable homes for one fact is
    // how the calculator and a document come to quote different numbers for the
    // same client.
    //
    // The columns still EXIST (renaming or dropping a live column is destructive
    // and this codebase does not do that) — nothing reads or writes them any more.
    // Verified before cutting over: zero non-deleted businesses carried a value in
    // either column, so no client's numbers were stranded by this change.
    const enquiries = business.leakAssessment?.monthlyEnquiries ?? null;
    const jobValue = business.leakAssessment?.avgJobValue ?? null;

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

    // Build the signed bundle, then IMMEDIATELY materialize it into our own
    // stored files — fetch each shot once here, on our server, and rewrite the
    // URLs to /api/assets/screenshot/<id>. Nothing downstream (the LLM prompt
    // passthrough, the exporter) ever sees a signed ScreenshotOne URL, so no
    // access key can reach the delivered document and ScreenshotOne is billed
    // once per image rather than once per client open.
    const screenshots = await materializeScreenshotBundle(
      buildScreenshotBundle({
        target: { url: business.website, label: `${business.name} (Target)` },
        competitors: competitors.map((c) => ({
          url: c.website ?? null,
          label: `Competitor: ${c.name}`,
        })),
      }),
      { userId: session.user.id, businessId: business.id }
    );

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
    // BENCHMARK mode. A single provided field is enough to flip a document to real
    // mode for the templates that can use it.
    // Intake booleans (null = unknown/not asked) join the numbers here: any one
    // provided flips this business out of the pure pre-intake path. Booleans drive
    // confirmed-vs-benchmark leak framing; `true` suppresses the matching leak.
    const hasAnyIntake =
      jobValue != null ||
      enquiries != null ||
      business.hasCrm != null ||
      business.hasFollowUpSequence != null ||
      business.hasReminderSystem != null ||
      business.hasPastCustomerDatabase != null ||
      business.hasCallTracking != null ||
      business.hasOnlinePayment != null ||
      business.afterHoursHandling != null ||
      business.missedCallHandling != null ||
      business.responseSpeed != null ||
      business.socialEnquiries != null ||
      business.pastCustomerContact != null ||
      // The two applicability answers. takesDeposits changes no leak at all — it
      // decides whether Text-to-Pay is in the build — but an answered question is
      // still intake, and a pack generated for a client who has answered anything
      // must not be watermarked "INTERNAL TEST".
      business.takesDeposits != null ||
      business.reviewReplyOwner != null ||
      business.bookingMethod != null ||
      business.gbpManagement != null ||
      business.buildPriorities != null;
    // ── F4 · ONE CAPTURED NUMBER, ONE SLOT ────────────────────────────────────
    // LeakAssessment.monthlyEnquiries is the ONLY volume we ever capture, and it
    // means INBOUND ENQUIRIES PER MONTH — that is the calculator's own question
    // ("enquiries a month") and the intake screen's confirmation of it. It used to
    // be written into BOTH intake volume slots, which silently invented two more
    // real-world quantities nobody was ever asked for. The two slots are consumed
    // by two different math templates in leak-narrative.ts, and they are NOT
    // interchangeable:
    //
    //   · monthlyEnquiries → missed_call_value. Its frame renders the number
    //     verbatim as "N enquiries/mo × a X% missed-call rate × …". Enquiries is
    //     precisely what that sentence claims the number is, so the client's real
    //     figure belongs here — and it beats the ~20-enquiry ASSUMPTION the
    //     BENCHMARK fallback would print in its place.
    //
    //   · monthlyBookedAppointments → no_show_value. Its frame renders the number
    //     as "N booked/mo × a X% no-show rate × …". BOOKED APPOINTMENTS ARE NOT
    //     ENQUIRIES. Aliasing printed the enquiry count back to the client as
    //     their booking count, inside a dollar figure they are asked to believe.
    //     We capture no booking count, and the enquiry→booking ratio is not a
    //     number we know for this business. Per the ruling ("separate them, or
    //     derive calls and bookings from enquiries with a stated, visible ratio")
    //     we take the first branch: the slot stays EMPTY, and no_show_value falls
    //     back to its BENCHMARK path — the cited vertical no-show range with NO
    //     dollar figure — exactly as it does for a pre-intake pack. Law 5 is
    //     unaffected: that leak carries statIds, so it stays quantified by its
    //     cited stats rather than by an invented figure.
    //
    // The two intake slots are named for what they actually hold, so the mapping
    // below reads as plainly as it behaves.
    const clientIntake = hasAnyIntake
      ? {
          avgJobValueCad: jobValue ?? undefined,
          // The assessment's monthlyEnquiries IS inbound enquiries — same meaning
          // the old column carried, now with one writer instead of two.
          monthlyEnquiries: enquiries ?? undefined,
          // monthlyBookedAppointments is DELIBERATELY OMITTED — we never ask for a
          // booking count. Do not "fix" this by aliasing the enquiry count in;
          // that aliasing is the bug this comment exists to prevent.
          hasCrm: business.hasCrm ?? undefined,
          hasFollowUpSequence: business.hasFollowUpSequence ?? undefined,
          hasReminderSystem: business.hasReminderSystem ?? undefined,
          hasPastCustomerDatabase: business.hasPastCustomerDatabase ?? undefined,
          hasCallTracking: business.hasCallTracking ?? undefined,
          hasOnlinePayment: business.hasOnlinePayment ?? undefined,
          // The three "how do enquiries get handled today" answers. Stored as
          // strings (no Prisma enums in this codebase by convention), so they are
          // cast to the contract's union here — the Zod enum on the write path is
          // what guarantees only these slugs ever reach the column.
          afterHoursHandling:
            (business.afterHoursHandling as
              | "AUTO_RESPONSE"
              | "NEXT_MORNING"
              | "NOTHING"
              | "UNKNOWN"
              | null) ?? undefined,
          missedCallHandling:
            (business.missedCallHandling as
              | "INSTANT_TEXT_BACK"
              | "CALL_BACK_WHEN_FREE"
              | "VOICEMAIL_ONLY"
              | "UNKNOWN"
              | null) ?? undefined,
          responseSpeed:
            (business.responseSpeed as
              | "UNDER_5_MIN"
              | "FEW_HOURS"
              | "DAY_OR_TWO"
              | "NOT_TRACKED"
              | null) ?? undefined,
          // The two answers that closed the last structural evidence gaps. Same
          // string-column convention as the three above.
          //   socialEnquiries  → social_dm_unmanaged. YES confirms it; NO and
          //     NO_ACCOUNTS both suppress it. (NO_ACCOUNTS is separately the fact
          //     that switches the Social DM Capture workflow off in the build.)
          //   pastCustomerContact → no_database_reactivation. SYSTEMATIC
          //     suppresses; OCCASIONAL / OVER_A_YEAR / NEVER confirm the list is
          //     going cold, which the "do you have a list?" answer beside it could
          //     never establish on its own.
          socialEnquiries:
            (business.socialEnquiries as "YES" | "NO" | "NO_ACCOUNTS" | null) ?? undefined,
          pastCustomerContact:
            (business.pastCustomerContact as
              | "SYSTEMATIC"
              | "OCCASIONAL"
              | "OVER_A_YEAR"
              | "NEVER"
              | null) ?? undefined,
          // The two applicability answers, same string-column convention again.
          //   takesDeposits → NO LEAK READS IT. It is the fact that decides whether
          //     the Text-to-Pay workflow is in the build (NEVER takes it out), and
          //     it is carried here so the build described by these deliverables is
          //     the same build the toggles panel resolves. Do NOT wire it to
          //     hasOnlinePayment: that one only suppresses payment_booking_friction,
          //     and the two run in opposite directions (see leak-taxonomy.ts).
          //   reviewReplyOwner → no_review_replies. NOBODY fires it as a disclosed
          //     finding; OWNER and STAFF_OR_AGENCY suppress it; unanswered does not
          //     fire it at all, because nothing we fetch can see owner replies.
          takesDeposits:
            (business.takesDeposits as "ALWAYS" | "SOMETIMES" | "NEVER" | null) ?? undefined,
          reviewReplyOwner:
            (business.reviewReplyOwner as "NOBODY" | "OWNER" | "STAFF_OR_AGENCY" | null) ??
            undefined,
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

      // ── F1 · BLOCKING GATE ──────────────────────────────────────────────────
      // The MERGED pack is what gets judged, not the regenerated section: a fresh
      // section can break a law the rest of the pack satisfied (a new dollar
      // figure that contradicts the exec summary, a lead-gen phrase, a hype word),
      // and the merged object is the thing that would have been persisted. A fatal
      // check means it is neither written nor returned as a success — the
      // previously saved pack stays live and untouched.
      //
      // allowedNumbers is the fired-leak whitelist computed above, so the
      // dollar-determinism guard runs at full strength (belt (b) — every stamped
      // integer must be a member of the set — not just belt (a)).
      const verdict = assertPackValid(merged, leaks.allowedNumbers, {
        renderedText: renderedTextFor(merged, {
          assessment: readComputed(business.leakAssessment?.computed ?? null),
          workflowToggles: business.workflowToggles,
          kickoffAt: business.kickoffAt,
        }),
      });
      if (!verdict.ok) {
        return NextResponse.json(
          {
            error: invalidPackMessage(verdict.fails),
            checks: verdict.fails,
            // Warnings never block. They travel on BOTH branches so the operator
            // reads one complete picture.
            warnings: verdict.warns,
            report: verdict.report,
          },
          { status: 422 }
        );
      }

      // ── F2 · NON-DESTRUCTIVE REGENERATION ───────────────────────────────────
      // This used to prisma.update() the latest row in place, overwriting the
      // previous pack's content with no history row and no way back — the one
      // write in the codebase that destroyed a prior deliverable. It now follows
      // the same shape as the full-save path (/api/assets/save): SOFT-delete the
      // live row (deletedAt — the row and its content stay in the database
      // forever, they are simply filtered out of every read) and CREATE the new
      // one, inside a single transaction so no reader ever sees zero or two live
      // packs. Ordering matters: the soft-delete runs first, so the new row cannot
      // be swept up by its own updateMany.
      const [, system] = await prisma.$transaction([
        prisma.generatedSystem.updateMany({
          where: {
            businessId: business.id,
            userId: session.user.id,
            type: "ASSETS",
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        }),
        prisma.generatedSystem.create({
          data: {
            businessId: business.id,
            userId: session.user.id,
            type: "ASSETS",
            content: merged as unknown as object,
          },
        }),
      ]);

      return NextResponse.json({ system, assetPack: merged, warnings: verdict.warns });
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

          // ── F1 · BLOCKING GATE, on the streaming contract's own terms ────────
          // The only success frame this protocol has is {type:"done", assetPack},
          // and both consumers treat "a stream that ended without a done frame" as
          // a failure. So a fatal check emits an error frame and the done frame is
          // never sent — the pack cannot be returned as a success.
          //
          // The frame is typed "error" rather than a new "invalid" type on
          // purpose: studio/page.tsx and library/page.tsx already render
          // `msg.error`, so the operator sees the REAL reason today instead of the
          // generic "Failed to generate deliverables" a frame type they don't know
          // would have produced. `reason: "invalid"` is the discriminator a client
          // can branch on later to render `checks` as a list; extra keys are
          // ignored by today's parsers, so the contract is widened, not broken.
          const verdict = assertPackValid(assetPack, leaks.allowedNumbers, {
            renderedText: renderedTextFor(assetPack, {
              assessment: readComputed(business.leakAssessment?.computed ?? null),
              workflowToggles: business.workflowToggles,
              kickoffAt: business.kickoffAt,
            }),
          });
          if (!verdict.ok) {
            console.error(
              `[generate/assets] pack BLOCKED for business ${business.id} (${business.name}):\n${verdict.report}`
            );
            send({
              type: "error",
              reason: "invalid",
              status: 422,
              error: invalidPackMessage(verdict.fails),
              checks: verdict.fails,
              warnings: verdict.warns,
              report: verdict.report,
            });
            return; // the finally below still closes the controller
          }

          // Warnings never block — they ride along with the pack so the operator
          // can read them beside a successful generation.
          send({ type: "done", assetPack, warnings: verdict.warns });
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
