// Builds a ready-to-edit conversion proposal for a business, grounded in its
// stored audit (saved AssetPack leak analysis → ColdAudit findings). Deterministic
// and conservative: it never invents proof or dollar figures — when no audit is on
// file it returns clearly-labelled assumptions for the operator to confirm.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateProposalSchema } from "@/lib/validations";
import { buildProposalDefaults } from "@/lib/proposal-defaults";
import { runColdAuditPipeline } from "@/lib/cold-audit-pipeline";
import type { AssetPack, ColdAuditReport } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = generateProposalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { id: parsed.data.businessId, userId: session.user.id },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Pull the richest stored audit signal for this business.
    const [packRow, auditRow] = await Promise.all([
      prisma.generatedSystem.findFirst({
        where: { businessId: business.id, userId: session.user.id, type: "ASSETS" },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      }),
      prisma.generatedSystem.findFirst({
        where: { businessId: business.id, userId: session.user.id, type: "COLD_AUDIT" },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      }),
    ]);

    const pack = (packRow?.content as unknown as AssetPack) ?? null;
    const audit = (auditRow?.content as unknown as ColdAuditReport) ?? null;

    let proposalData = buildProposalDefaults(business, { pack, audit });

    // If the stored audit data couldn't dollarize the leak (no audit on file, or
    // an older/weak pack with no per-leak figures), run a fresh grounded
    // cold-audit on the fly so the proposal shows real diagnosed numbers instead
    // of conservative placeholders. Persist it so it's reusable next time, and
    // rebuild from the fresh audit alone so its figures take precedence. If the
    // pipeline fails (missing keys, nothing to read), keep the placeholders.
    if (!proposalData.roi.recovered && business.website) {
      try {
        const fresh = await runColdAuditPipeline(business);
        const rebuilt = buildProposalDefaults(business, { audit: fresh });
        if (rebuilt.roi.recovered) {
          await prisma.generatedSystem.create({
            data: {
              businessId: business.id,
              userId: session.user.id,
              type: "COLD_AUDIT",
              content: fresh as unknown as object,
            },
          });
          proposalData = rebuilt;
        }
      } catch (auditError) {
        console.error("Inline cold-audit for proposal failed:", auditError);
      }
    }

    return NextResponse.json({ proposalData });
  } catch (error) {
    console.error("Generate proposal error:", error);
    return NextResponse.json({ error: "Failed to generate proposal" }, { status: 500 });
  }
}
