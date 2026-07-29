import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAssetZipChecked } from "@/lib/exporters";
import { formatOverrideLog } from "@/lib/exporters/validate-pack";
import type { AssetPack } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Bundle the latest generated Growth Asset Pack for a business into a ZIP of the
// five real deliverable files (.html, .pdf, .docx, .txt, .html).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const businessId = body?.businessId;
    const providedPack = body?.assetPack as AssetPack | undefined;
    // Untyped on purpose — it comes off the wire and evaluateOverride is the one
    // place allowed to decide what a valid override looks like.
    const override = body?.override as unknown;
    if (!businessId || typeof businessId !== "string") {
      return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    }

    // Prefer the pack the client already has in memory (works for an unsaved,
    // just-generated pack); otherwise fall back to the last saved one.
    let pack = providedPack;
    // Set only when the bytes we are about to ship ARE a saved row's content.
    // That distinction decides whether the override may rewrite that row's
    // content later — see the paper-trail block below.
    let sourceSystemId: string | null = null;
    if (!pack?.meta || !pack.file1) {
      const latest = await prisma.generatedSystem.findFirst({
        where: { businessId, userId: session.user.id, type: "ASSETS", deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      if (!latest) {
        return NextResponse.json(
          { error: "No asset pack found. Generate the pack first." },
          { status: 404 }
        );
      }
      pack = latest.content as unknown as AssetPack;
      sourceSystemId = latest.id;
    }

    if (!pack?.meta || !pack.file1) {
      return NextResponse.json(
        { error: "This pack predates the export format. Regenerate it, then export." },
        { status: 409 }
      );
    }

    // ── F1 · BLOCKING GATE, third and last boundary ─────────────────────────────
    // Migrated off the deprecated buildAssetZip, which BLOCKED correctly (it throws
    // PackExportBlockedError) but whose exception fell into the catch below and
    // reached the operator as a bare 500 with no reason in it. buildAssetZipChecked
    // renders and validates the FINAL deliverable HTML and only bundles a ZIP once
    // nothing fatal is left, returning a structured failure instead of throwing —
    // so the operator is told which laws broke rather than "Failed to export".
    //
    // This is the last gate, not the only one: the pack was already checked at
    // generation and again at save. It stays because the pack can arrive in the
    // request body (an unsaved, just-generated one) and because this boundary is
    // the only place the RENDERED html is inspected.
    //
    // `override` is threaded through, NOT consulted here. Without it the behaviour
    // is exactly what it was: a fatal check blocks. With it, the ZIP is built only
    // when the caller echoed back every currently-failing check id and typed a
    // reason (Phase 0.6 escape hatch).
    const built = await buildAssetZipChecked(pack, override);
    if (!built.ok) {
      console.error(`Export blocked for business ${businessId}:\n${built.report}`);
      if (built.overrideError)
        console.error(
          `Override refused for business ${businessId} (${built.overrideErrorCode}): ${built.overrideError}`
        );
      return NextResponse.json(
        {
          error: built.overrideError ?? built.report,
          report: built.report,
          checks: built.fails,
          violations: built.violations,
          // EVERYTHING that blocked, each with a stable id. This is both what the
          // UI must render in full and the exact set an override has to
          // acknowledge — the operator cannot waive a check they were not shown,
          // because they cannot produce its id without being sent it.
          fatalChecks: built.fatals,
          overrideError: built.overrideError,
          overrideErrorCode: built.overrideErrorCode,
          // Warnings never block; returned here only so one payload carries the
          // whole picture.
          warnings: built.warns,
        },
        { status: 422 }
      );
    }

    // ── The paper trail for a forced export ─────────────────────────────────────
    // Three places, because a governance record with one copy is a record that can
    // be lost: the server log (loud, greppable), the archive comment inside the
    // ZIP (travels with the file the client received), and the DB row.
    let trailRecorded = false;
    if (built.governance) {
      console.error(formatOverrideLog(businessId, built.governance));

      const trail = {
        overrideReason: built.governance.reason,
        overriddenChecks: built.governance.checks as unknown as object,
        overriddenAt: new Date(built.governance.at),
      };

      if (sourceSystemId) {
        // The saved row's OWN content is what we just shipped, so it is honest to
        // stamp the governance block into it: from here on that pack answers
        // "did this go out over a known violation?" by itself, with no lookup.
        const written = await prisma.generatedSystem.updateMany({
          where: { id: sourceSystemId, userId: session.user.id },
          data: { ...trail, content: built.pack as unknown as object },
        });
        trailRecorded = written.count > 0;
      } else {
        // The pack came off the wire, so the saved row holds DIFFERENT bytes. The
        // columns still get written — "an export for this business was forced at
        // T for reason R over these checks" is true regardless of which copy was
        // in the browser tab — but `content` is left alone. Export is not save,
        // and silently replacing what the operator saved would be a worse bug
        // than a thin trail.
        const written = await prisma.generatedSystem.updateMany({
          where: { businessId, userId: session.user.id, type: "ASSETS", deletedAt: null },
          data: trail,
        });
        trailRecorded = written.count > 0;
      }

      if (!trailRecorded)
        console.error(
          `Override for business ${businessId} could NOT be recorded in the database — this pack has never been saved. The ZIP comment and this log are the only trail.`
        );
    }

    return new NextResponse(built.zip as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${built.filename}"`,
        "Content-Length": String(built.zip.length),
        // Same-origin fetch can read these, so the UI can say what actually
        // happened instead of showing a plain success toast for a forced export.
        "X-Pack-Override": built.governance ? "forced" : "none",
        "X-Pack-Override-Recorded": built.governance ? String(trailRecorded) : "n/a",
      },
    });
  } catch (error) {
    console.error("Export assets error:", error);
    return NextResponse.json({ error: "Failed to export deliverables" }, { status: 500 });
  }
}
