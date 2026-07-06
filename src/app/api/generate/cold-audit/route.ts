import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateColdAuditSchema } from "@/lib/validations";
import { checkPlanLimit } from "@/lib/limits";
import { runColdAuditPipeline } from "@/lib/cold-audit-pipeline";

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

    const report = await runColdAuditPipeline(business);

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
