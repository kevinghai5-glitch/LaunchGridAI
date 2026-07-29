// Save endpoint — persists a generated AssetPack to the operator's Library.
// Generation itself no longer writes to the DB; nothing appears in the Library
// until the operator explicitly saves it here. Saving replaces any prior saved
// pack for the same business so the Library shows one entry per business.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assertPackValid,
  evaluateOverride,
  formatOverrideLog,
  withGovernance,
} from "@/lib/exporters/validate-pack";
import type { AssetPack, PackGovernance } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const businessId = body?.businessId;
  const assetPack = body?.assetPack as AssetPack | undefined;
  // Untyped on purpose — it comes off the wire and evaluateOverride is the one
  // place allowed to decide what a valid override looks like.
  const override = body?.override as unknown;

  if (!businessId || typeof businessId !== "string") {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }
  if (!assetPack?.meta || !assetPack.file1) {
    return NextResponse.json({ error: "A complete asset pack is required" }, { status: 400 });
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // ── F1 · BLOCKING GATE ──────────────────────────────────────────────────────
  // /api/generate/assets already refuses to hand back a failing pack, but this
  // route does not trust that: it accepts a pack straight off the wire, which can
  // be an older one held in a stale browser tab, one edited client-side, or a
  // hand-posted body. Re-validating here is the difference between "the generator
  // is careful" and "a failing pack cannot enter the Library". A fatal check means
  // NOTHING is written — the previously saved pack stays live and the operator
  // gets the report back.
  //
  // No allowedNumbers: the fired-leak whitelist is a generation-time artifact and
  // does not survive into the persisted pack, so the dollar-determinism guard runs
  // in its always-on form (every stamped figure must appear verbatim in its own
  // mathFrame). Generation runs the strict form; this is the floor, not a relaxation.
  const verdict = assertPackValid(assetPack);

  // ── The escape hatch (Phase 0.6) ────────────────────────────────────────────
  // Default behaviour is unchanged: no `override` in the body → a fatal check
  // means nothing is written. The override exists only so a rule that
  // false-positives at 11pm cannot make the operator physically unable to work,
  // because the real alternative is that this gate gets commented out and
  // enforcement dies silently. It costs a typed reason plus an acknowledgement of
  // the exact failing checks (see evaluateOverride for why the echo is the only
  // honest way a server can know the operator was shown them).
  let governance: PackGovernance | undefined;
  if (!verdict.ok) {
    const decision = evaluateOverride(verdict.fails, override, "save");
    if (decision.status !== "granted") {
      const laws = Array.from(new Set(verdict.fails.map((f) => f.law)));
      const blocked = `This pack fails ${verdict.fails.length} of its own deliverable law${
        verdict.fails.length === 1 ? "" : "s"
      } and was not saved: ${laws.join(", ")}. Regenerate it before sending it to a client.`;
      if (decision.status === "rejected")
        console.error(
          `Save override refused for business ${business.id} (${decision.code}): ${decision.message}`
        );
      return NextResponse.json(
        {
          error: decision.status === "rejected" ? decision.message : blocked,
          report: verdict.report,
          checks: verdict.fails,
          // The acknowledgeable set, each entry carrying its stable id. Identical
          // to `checks` here — save has no rendered-HTML layer — but named the
          // same as on the export route so one UI can drive both gates.
          fatalChecks: verdict.fails,
          overrideError: decision.status === "rejected" ? decision.message : undefined,
          overrideErrorCode: decision.status === "rejected" ? decision.code : undefined,
          // Warnings never block; they travel on both branches.
          warnings: verdict.warns,
        },
        { status: 422 }
      );
    }
    governance = decision.governance;
    console.error(formatOverrideLog(business.id, governance));
  }

  // Stamp the override onto the pack itself, so the stored JSON says on its own
  // that it was saved over a known violation. `withGovernance` also CLEARS a
  // stale block on the clean path — a pack that came back from a browser tab
  // still carrying an old marker must not re-save itself as overridden when it
  // now passes.
  const packToSave = withGovernance(assetPack, governance);

  // One saved pack per business: SOFT-delete prior saves (never hard-delete — the
  // old packs stay in the DB, filtered out of reads via deletedAt: null), then
  // store the latest.
  const [, system] = await prisma.$transaction([
    prisma.generatedSystem.updateMany({
      where: { businessId: business.id, userId: session.user.id, type: "ASSETS", deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.generatedSystem.create({
      data: {
        businessId: business.id,
        userId: session.user.id,
        type: "ASSETS",
        content: packToSave as unknown as object,
        // Spread rather than write nulls: the three columns stay untouched (and
        // the Json column avoids Prisma's JsonNull/DbNull dance) on every normal
        // save, so a row carrying them means one thing only.
        ...(governance
          ? {
              overrideReason: governance.reason,
              overriddenChecks: governance.checks as unknown as object,
              overriddenAt: new Date(governance.at),
            }
          : {}),
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    id: system.id,
    savedAt: system.createdAt,
    warnings: verdict.warns,
    // Present only on a forced save, so the UI can say "saved over N failing
    // checks" instead of a plain success toast.
    override: governance ?? undefined,
  });
}
