import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateColdAuditSchema } from "@/lib/validations";
import { checkPlanLimit } from "@/lib/limits";
import { fetchWebsitePage } from "@/lib/website-analyzer";
import { fetchPlaceReviews, findCompetitors } from "@/lib/google-places";
import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import { firecrawlSite } from "@/lib/firecrawl";
import { buildBusinessFacts } from "@/lib/business-facts";
import { runPageSpeed } from "@/lib/pagespeed";
import { runDataForSeo } from "@/lib/dataforseo";
import { buildScreenshotBundle } from "@/lib/screenshotone";
import { generateColdAudit } from "@/lib/cold-audit";
import type { GenerationContext } from "@/lib/asset-generation";

export const dynamic = "force-dynamic";
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
    const parsed = generateColdAuditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const business = await prisma.business.findFirst({
      where: { id: parsed.data.businessId, userId: session.user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Same enrichment as the full pack — the audit lives or dies on real signals.
    const [page, reviews, competitors, scrape, psi, dfs] = await Promise.all([
      fetchWebsitePage(business.website),
      fetchPlaceReviews(business.googlePlaceId),
      findCompetitors(
        business.industry ?? business.category,
        business.city,
        business.googlePlaceId
      ),
      firecrawlSite(business.website),
      runPageSpeed(business.website),
      runDataForSeo(business.name, business.address),
    ]);

    const verifiedFacts = buildBusinessFacts({
      scrape,
      fallbackText: page.text,
      places: {
        name: business.name,
        phone: business.phone,
        address: business.address,
        website: business.website,
      },
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

    const websiteHtmlForSignals =
      scrape.used && scrape.homepage
        ? scrape.homepage.html || page.html
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
    };

    const report = await generateColdAudit(ctx);

    const system = await prisma.generatedSystem.create({
      data: {
        businessId: business.id,
        userId: session.user.id,
        type: "COLD_AUDIT",
        content: report as unknown as object,
      },
    });

    return NextResponse.json({ system, coldAudit: report });
  } catch (error) {
    console.error("Generate cold audit error:", error);
    return NextResponse.json(
      { error: "Failed to generate cold audit" },
      { status: 500 }
    );
  }
}
