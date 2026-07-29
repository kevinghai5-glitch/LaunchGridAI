// Returns the latest saved Cold-Open Audit for a given business (owned by the
// user). Used by Studio to restore the last audit on refresh / session resume.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertStoredColdAuditSafe } from "@/lib/exporters/validate-pack";
import type { ColdAuditReport } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  }

  // Resolves the NEWEST non-deleted audit row, never a remembered row id — which
  // is what makes the stable publicId (F3) safe: the id is reused on each
  // regeneration, and every read path (this route, /a/[publicId], the call-queue
  // and calendar auditPeeks) selects by business + newest-live, so a reused id can
  // only ever land on the current audit.
  const latest = await prisma.generatedSystem.findFirst({
    where: { businessId, userId: session.user.id, type: "COLD_AUDIT", deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, content: true, publicId: true },
  });

  if (!latest) return NextResponse.json({ audit: null });

  // Same read-path gate as the public teaser, on the operator's side of the wall.
  // This one reports rather than throws: the operator is the person who can act on
  // it, and a 500 here would hide the reason behind a generic fetch failure in the
  // Studio. A breached row still never renders — the response carries no audit.
  const stored = latest.content as unknown as ColdAuditReport;
  try {
    assertStoredColdAuditSafe(stored, `cold-audit/latest (business ${businessId})`);
  } catch (err) {
    console.error(`[cold-audit/latest] stored audit refused for ${businessId}:`, err);
    return NextResponse.json(
      {
        audit: null,
        error:
          err instanceof Error
            ? err.message
            : "This stored cold audit fails its own governance checks. Regenerate it.",
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    audit: latest.content,
    generatedAt: latest.createdAt,
    id: latest.id,
    // Studio already holds `coldPublicId` state and resets it correctly; without
    // this it had nothing to read on the restore path, so "Copy preview link"
    // stayed hidden for an audit restored after a refresh.
    publicId: latest.publicId,
  });
}
