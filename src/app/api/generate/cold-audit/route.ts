import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateColdAuditSchema } from "@/lib/validations";
import { checkPlanLimit } from "@/lib/limits";
import { runColdAuditPipeline } from "@/lib/cold-audit-pipeline";
import { assertNoDisclosedFindings } from "@/lib/cold-audit";
import { persistColdAudit } from "@/lib/cold-audit-store";

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
      where: { id: parsed.data.businessId, userId: session.user.id, deletedAt: null },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const report = await runColdAuditPipeline(business);

    // Nothing is disclosed before the sale. The generator checked this already;
    // it is checked again HERE because persisting is the irreversible step — this
    // row is what the public /a/[publicId] teaser renders from, so a disclosure
    // that gets written is a disclosure already on a URL we hand to a prospect.
    // It throws (→ 500) instead of saving a repaired copy: a breach of a guarantee
    // this strong is worth a failed generation, not a quiet correction.
    assertNoDisclosedFindings(report, "before persist");

    // F3 · the share link must be stable per business. persistColdAudit owns the
    // publicId hand-over and the soft-delete of the superseded row; it is the only
    // sanctioned way to write a COLD_AUDIT. See src/lib/cold-audit-store.ts.
    const system = await persistColdAudit({
      businessId: business.id,
      userId: session.user.id,
      report,
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
