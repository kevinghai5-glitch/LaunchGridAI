/** Persistence for a generated cold audit — the ONE place a COLD_AUDIT row is
 *  written.
 *
 *  This exists because the rule it enforces is easy to violate by accident: two
 *  routes generate a cold audit (POST /api/generate/cold-audit, and the inline
 *  fallback inside POST /api/generate/proposal when the stored pack can't
 *  dollarize a leak), and a plain `create()` in either of them silently breaks a
 *  link that is already sitting in a prospect's inbox. Import this instead.
 */
import { prisma } from "@/lib/prisma";
import { assertNoDisclosedFindings } from "@/lib/cold-audit";
import type { ColdAuditReport } from "@/types";
import type { GeneratedSystem } from "@prisma/client";

/** Persist a freshly generated cold audit for a business, reusing that business's
 *  existing public share id.
 *
 *  ── WHY THE ID IS REUSED ──────────────────────────────────────────────────────
 *  The teaser link (/a/<publicId>) is emailed to the prospect BEFORE the Zoom. If
 *  a regeneration minted a fresh id, the link already in their inbox would go on
 *  serving the superseded audit forever while the operator worked from the new
 *  one. One business, one link, always resolving to the current audit.
 *
 *  ── WHY THE OLD ROW HANDS THE ID OVER FIRST ───────────────────────────────────
 *  `publicId` is `@unique` across the whole GeneratedSystem table and that index
 *  knows nothing about `deletedAt` — two rows holding the same value is a
 *  constraint violation even when one of them is soft-deleted. So the old row is
 *  renamed inside the same transaction, immediately before the new row claims the
 *  value. Postgres checks a unique index per statement, so the UPDATE frees the
 *  value before the INSERT takes it.
 *
 *  The old row is NOT deleted and never will be: it keeps its content and its
 *  createdAt, and is marked `deletedAt` + given a traceable retired id derived
 *  from its own row id (unique by construction — row ids are cuids, and a row can
 *  only be retired once because a soft-deleted row is never selected as
 *  `previous` again).
 */
export async function persistColdAudit(params: {
  businessId: string;
  userId: string;
  /** Typed, not `unknown`: the pre-sale guarantee below can only be checked on a
   *  report whose shape we actually know. Both callers already hold one. */
  report: ColdAuditReport;
}): Promise<GeneratedSystem> {
  const { businessId, userId, report } = params;

  // ── PHASE 1 · NOTHING IS DISCLOSED BEFORE THE SALE ──────────────────────────
  // The cold audit is a PRE-SALE document: the prospect has not been through
  // intake, so nothing in it can honestly be attributed to them. detectLeaks
  // makes that a compile error on the generation path (its pre-sale input variant
  // declares `intake?: never`), and this is the write-side backstop for anything
  // that got past the compiler via a cast or an untyped body.
  //
  // It runs HERE rather than in the route because this function is the ONLY
  // sanctioned way to write a COLD_AUDIT row — putting the gate on the single
  // choke point means a future second caller inherits it instead of having to
  // remember it. Throwing is deliberate: a breached guarantee is worth a failed
  // generation, and quietly downgrading the finding would hide the bug the
  // guarantee exists to catch.
  assertNoDisclosedFindings(report, `persistColdAudit(business ${businessId})`);

  const previous = await prisma.generatedSystem.findFirst({
    where: { businessId, userId, type: "COLD_AUDIT", deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, publicId: true },
  });

  if (!previous) {
    // First audit for this business — mint the id every later regeneration inherits.
    return prisma.generatedSystem.create({
      data: {
        businessId,
        userId,
        type: "COLD_AUDIT",
        content: report as object,
      },
    });
  }

  const [, system] = await prisma.$transaction([
    prisma.generatedSystem.update({
      where: { id: previous.id },
      data: { publicId: `retired-${previous.id}`, deletedAt: new Date() },
    }),
    prisma.generatedSystem.create({
      data: {
        businessId,
        userId,
        type: "COLD_AUDIT",
        content: report as object,
        publicId: previous.publicId,
      },
    }),
  ]);

  return system;
}
