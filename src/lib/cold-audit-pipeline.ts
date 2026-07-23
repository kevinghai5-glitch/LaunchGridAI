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
import { generateColdAudit } from "@/lib/cold-audit";
import type { GenerationContext, LeakContext } from "@/lib/asset-generation";
import { detectLeaks } from "@/lib/leak-detection";
import {
  buildLeakInputs,
  leakInputsToPromptBlock,
  allowedNumbersFor,
  computeMathEstimate,
} from "@/lib/leak-narrative";
import type { ColdAuditReport } from "@/types";

export async function runColdAuditPipeline(
  business: Business
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
    asOf: research.asOf,
  });
  // Part H1: the #1 ranked cold-audit leak (coldAudit is score-desc) drives the
  // headline-cost block — named, with its computed benchmark-mode monthly figure.
  const headlineLeak = detected.coldAudit[0];
  const headlineMath = headlineLeak?.leak.mathTemplate
    ? computeMathEstimate(headlineLeak.leak.mathTemplate, detected.data)
    : null;

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
      ? { leakName: headlineLeak.leak.name, benchmarkFrame: headlineMath?.frame ?? null }
      : null,
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
  };

  return generateColdAudit(ctx);
}
