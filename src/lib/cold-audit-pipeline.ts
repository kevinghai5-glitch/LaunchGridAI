// Shared cold-audit orchestration: gathers the real external signals for a
// business (website fetch, reviews, competitors, scrape, PageSpeed, DataForSEO,
// screenshots), builds the audit intelligence, and runs the grounded cold-audit
// generator. Used by the cold-audit route directly and by the proposal
// generator as an on-the-fly fallback when no audit is on file.

import type { Business } from "@prisma/client";
import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import { buildBusinessFacts } from "@/lib/business-facts";
import { resolvePsiSnapshot } from "@/lib/psi-snapshot";
import { resolveResearchSnapshot } from "@/lib/research-snapshot";
import { buildScreenshotBundle } from "@/lib/screenshotone";
import { generateColdAudit, type PreSaleGenerationContext } from "@/lib/cold-audit";
import { scopeViolations } from "@/lib/exporters/cold-audit-html";
import type { LeakContext } from "@/lib/asset-generation";
import { detectLeaks } from "@/lib/leak-detection";
import {
  buildLeakInputs,
  leakInputsToPromptBlock,
  allowedNumbersFor,
  computeMathEstimate,
} from "@/lib/leak-narrative";
import type { ColdAuditReport } from "@/types";

/** The ONLY columns a pre-sale audit is allowed to read off a Business row.
 *
 *  The row itself carries the whole intake form — hasCrm, hasFollowUpSequence,
 *  responseSpeed, missedCallHandling, avgClientValueCad and the rest — and the
 *  cold audit is written BEFORE any of that exists, for a prospect who has told us
 *  nothing. Taking the full record and remembering not to touch those columns is
 *  the kind of rule that holds until someone adds one convenient line. Narrowing
 *  the parameter instead means `business.hasCrm` in here is a compile error.
 *
 *  Callers are unaffected: a full Business still satisfies this, so both routes
 *  keep passing the row they already loaded. */
export type ColdAuditBusiness = Pick<
  Business,
  // identity + public listing facts
  | "id"
  | "name"
  | "address"
  | "phone"
  | "website"
  | "city"
  | "industry"
  | "category"
  | "description"
  | "rating"
  | "reviewCount"
  | "googlePlaceId"
  | "ownerName"
  // persisted research/PSI snapshots (so a regenerate costs no scrape budget)
  | "researchSnapshot"
  | "researchSnapshotAt"
  | "psiSnapshot"
  | "psiSnapshotAt"
>;

export async function runColdAuditPipeline(
  business: ColdAuditBusiness
): Promise<ColdAuditReport> {
  // Same enrichment as the full pack — the audit lives or dies on real signals.
  // Both share the persisted research + PSI snapshots, so the cold audit and the
  // deliverables always agree on the same facts and neither pays to re-scrape.
  const [research, psi] = await Promise.all([
    resolveResearchSnapshot(business),
    resolvePsiSnapshot(business),
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

  const websiteTextForPrompt =
    scrape.used && scrape.homepage
      ? [scrape.homepage.markdown, ...scrape.subpages.map((s) => s.markdown)]
          .filter(Boolean)
          .join("\n\n---\n\n")
          .slice(0, 18000)
      : page.text;

  // Signal detection must run over the FULL post-JS DOM (rawHtml), across every
  // scraped page — GTM-injected chat/booking widgets and forms behind a click
  // only surface in rawHtml, and only on the subpage that hosts them. Cleaned
  // `html` strips scripts/iframes, causing confident false negatives.
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
    reviews,
    competitors,
    self: { rating: business.rating, reviewCount: business.reviewCount },
    verifiedFacts,
    performance: psi,
    dataForSeo: dfs,
    screenshots,
  });

  // Governance: the cold-audit teaser previews only the top-3 most provable
  // fired leaks (selectColdAudit), spend-anchored and pre-intake (Phases 1–5).
  //
  // `mode: "pre_sale"` is not documentation — it selects detectLeaks' pre-sale
  // input variant, whose `intake` field is typed `never`. Before this line the
  // cold audit was pre-intake only because nobody had happened to pass intake in.
  // After it, adding intake to this call does not produce a hedge-free sentence on
  // a free document: it fails to compile.
  const detected = detectLeaks({
    mode: "pre_sale",
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
    asOf: research.asOf,
  });
  // Part H1: the #1 ranked cold-audit leak (coldAudit is score-desc) drives the
  // headline-cost block — named, with its computed benchmark-mode monthly figure.
  const headlineLeak = detected.coldAudit[0];
  const headlineMath = headlineLeak?.leak.mathTemplate
    ? computeMathEstimate(headlineLeak.leak.mathTemplate, detected.data)
    : null;

  // C5 · THE HEADLINE FIGURE IS AN INDUSTRY ESTIMATE, AND ONLY EVER THAT.
  //
  // computeMathEstimate has two modes. BENCHMARK builds the figure from a stated
  // assumption ("assuming 20 enquiries a month — our assumption, not a number we
  // measured") times published industry rates, and says so in the same sentence.
  // REAL builds it from numbers the client gave us and prints "based on the
  // numbers you provided".
  //
  // A cold audit can only ever be BENCHMARK: nobody has given us a number yet.
  // REAL mode needs `intake`, and a pre-sale detection cannot carry intake at all
  // (it is typed `never`), so this cannot fire today. It is here because the cost
  // of being wrong is a free document telling a stranger we used figures they
  // never gave us — so if the mode is ever anything but BENCHMARK, we print no
  // figure at all rather than print that sentence.
  const benchmarkFrame =
    headlineMath && headlineMath.mode === "BENCHMARK" ? headlineMath.frame : null;

  const coldAuditInputs = buildLeakInputs(detected.coldAudit, detected.data);
  const leaks: LeakContext = {
    report: detected.report,
    coldAudit: detected.coldAudit,
    outOfScope: detected.outOfScope,
    grades: detected.grades,
    promptBlock: leakInputsToPromptBlock(coldAuditInputs),
    allowedNumbers: allowedNumbersFor(detected.coldAudit, detected.data),
    inputs: coldAuditInputs,
    headline: headlineLeak
      ? { leakName: headlineLeak.leak.name, benchmarkFrame }
      : null,
  };

  // PreSaleGenerationContext, not GenerationContext: the five intake-derived
  // fields (servicesFocus, intakePresent, bookingToolName, gbpManagement,
  // buildPriorities) are typed `never` on it, so setting one here — the natural
  // thing to do when copying context-building code over from the paid pack — is a
  // compile error rather than a disclosure printed on a free document.
  const ctx: PreSaleGenerationContext = {
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
  };

  const report = await generateColdAudit(ctx);

  // C6 · A LOGGED WARNING, NEVER A BLOCK.
  //
  // Everything upstream already tries twice to keep ads/SEO/lead-gen/website-
  // rebuild recommendations out of this document: the generator asks for a rewrite
  // when it spots one, and enforceColdAuditLaws lifts any survivor out sentence by
  // sentence before the document renders. So a hit here means both passes missed
  // something, which is worth knowing about.
  //
  // It logs and ships rather than throwing. A cold audit is generated at whatever
  // hour he happens to be working, and a hard stop here would leave him with no
  // document and no way forward at 11pm — over a scope wobble the render boundary
  // has already stripped. The line below is the record; the fix is a prompt edit
  // in the morning.
  const strays = scopeViolations(report);
  if (strays.length) {
    console.warn(
      `[cold-audit] ${business.name}: ${strays.length} out-of-scope sentence(s) survived generation ` +
        `(we do not sell ads/SEO/lead gen and do not rebuild websites). Shipped anyway, ` +
        `stripped at render: ${strays.map((s) => `"${s}"`).join(" ; ")}`
    );
  }

  return report;
}
