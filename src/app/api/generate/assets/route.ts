import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAssetsSchema } from "@/lib/validations";
import { checkPlanLimit } from "@/lib/limits";
import { fetchWebsitePage } from "@/lib/website-analyzer";
import { fetchPlaceReviews, findCompetitors } from "@/lib/google-places";
import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import {
  generateAssetPack,
  generateOneSection,
  buildMeta,
  type GenerationContext,
} from "@/lib/asset-generation";
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
      where: { id: parsed.data.businessId, userId: session.user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // ── Enrichment: ground the pack in the live site, real reviews, and local
    // competitors. Each source degrades gracefully to empty on failure.
    const [page, reviews, competitors] = await Promise.all([
      fetchWebsitePage(business.website),
      fetchPlaceReviews(business.googlePlaceId),
      findCompetitors(
        business.industry ?? business.category,
        business.city,
        business.googlePlaceId
      ),
    ]);

    const intel = buildAuditIntelligence({
      websiteHtml: page.html,
      hasWebsiteUrl: Boolean(business.website),
      reviews,
      competitors,
      self: { rating: business.rating, reviewCount: business.reviewCount },
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
      websiteText: page.text,
    };

    // ── Regenerate a single deliverable, merging into the latest stored pack.
    if (parsed.data.section) {
      const latest = await prisma.generatedSystem.findFirst({
        where: {
          businessId: business.id,
          userId: session.user.id,
          type: "ASSETS",
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

    // ── Full pack: all five deliverables.
    const assetPack = await generateAssetPack(ctx);

    const system = await prisma.generatedSystem.create({
      data: {
        businessId: business.id,
        userId: session.user.id,
        type: "ASSETS",
        content: assetPack as unknown as object,
      },
    });

    return NextResponse.json({ system, assetPack });
  } catch (error) {
    console.error("Generate assets error:", error);
    return NextResponse.json(
      { error: "Failed to generate asset pack" },
      { status: 500 }
    );
  }
}
