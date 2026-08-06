// LIVE proof of the do-not-call guarantee, against the real Neon schema.
//
// Seeds one business per dial status, then runs the EXACT exclusion the generator
// runs (the shared resurfacesIntoFreshBatch predicate) and prints which Places a
// fresh batch would exclude. Also proves the CSV-export path flips fresh → dialed
// and writes an append-only history event.
//
// Everything happens inside a transaction that is ROLLED BACK at the end, so the
// proof leaves nothing behind and never deletes a row (honouring the no-hard-
// delete rule — there is simply nothing to delete).
//
// Run: node_modules/.bin/tsx scripts/prove-dnc.ts

import { prisma } from "../src/lib/prisma";
import { resurfacesIntoFreshBatch, recordDialStatusBulk } from "../src/lib/dial-status";

// The cooldown the generator uses (mirrors DECLINE_COOLDOWN_DAYS in crm.ts). Kept
// local so this script needs nothing from the app beyond the shared predicate.
const COOLDOWN_DAYS = 90;

const ROLLBACK = Symbol("rollback");

async function main() {
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_DAYS * 86_400_000);
  const longAgo = new Date(Date.now() - 200 * 86_400_000); // older than cooldown

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: `dnc-proof-${Date.now()}@example.test`, name: "DNC Proof" },
        select: { id: true },
      });

      // One business per dial status, each a cooled-down DECLINED (the ONLY shape
      // that could resurface) so the ONLY thing deciding exclusion is dialStatus.
      const specs = [
        { key: "fresh-decline", dialStatus: "fresh" },
        { key: "dialed", dialStatus: "dialed" },
        { key: "not_interested", dialStatus: "not_interested" },
        { key: "do_not_call", dialStatus: "do_not_call" },
        { key: "booked", dialStatus: "booked" },
        { key: "disqualified", dialStatus: "disqualified" },
      ];

      for (const s of specs) {
        await tx.business.create({
          data: {
            userId: user.id,
            googlePlaceId: `place_${s.key}`,
            name: `Proof ${s.key}`,
            status: "DECLINED",
            declinedAt: longAgo,
            dialStatus: s.dialStatus,
            source: "DAILY",
          },
        });
      }

      // Re-read exactly as the generate route does, then apply the SAME predicate.
      const known = await tx.business.findMany({
        where: { userId: user.id },
        select: { googlePlaceId: true, status: true, dialStatus: true, declinedAt: true, deletedAt: true },
      });

      const exclude = new Set<string>();
      for (const b of known) {
        if (!b.googlePlaceId) continue;
        if (!resurfacesIntoFreshBatch(b, cooldownCutoff)) exclude.add(b.googlePlaceId);
      }

      console.log("\n── Generation exclusion (a fresh batch would serve ONLY the un-excluded) ──\n");
      console.log("  dialStatus        placeId                excluded from generation?");
      console.log("  ─────────────────────────────────────────────────────────────────");
      let ok = true;
      for (const b of known) {
        const excluded = exclude.has(b.googlePlaceId!);
        // Only a cooled-down FRESH decline should come back; everything else stays out.
        const expectExcluded = b.dialStatus !== "fresh";
        const mark = excluded === expectExcluded ? "✓" : "✗ WRONG";
        if (excluded !== expectExcluded) ok = false;
        console.log(
          `  ${b.dialStatus.padEnd(16)}  ${b.googlePlaceId!.padEnd(20)}  ${
            excluded ? "EXCLUDED" : "served"
          }  ${mark}`
        );
      }
      if (!ok) throw new Error("PROOF FAILED: an exclusion did not match expectation");

      console.log(
        "\n  → do_not_call, not_interested, booked, disqualified and dialed are ALL excluded."
      );
      console.log("  → only the fresh (cooled-down) decline is served. do_not_call can never return.\n");

      // ── CSV export path: fresh → dialed, with a history event ──────────────
      const freshBiz = await tx.business.findFirst({
        where: { userId: user.id, dialStatus: "fresh" },
        select: { id: true, dialStatus: true },
      });
      console.log("── CSV export marks a business dialed ──\n");
      console.log(`  before export: dialStatus = ${freshBiz!.dialStatus}`);
      await recordDialStatusBulk(tx, {
        businessIds: [freshBiz!.id],
        userId: user.id,
        status: "dialed",
        source: "export",
      });
      const after = await tx.business.findUnique({
        where: { id: freshBiz!.id },
        select: { dialStatus: true, dialStatusAt: true },
      });
      const events = await tx.dialStatusEvent.findMany({
        where: { businessId: freshBiz!.id },
        select: { status: true, source: true },
      });
      console.log(`  after export:  dialStatus = ${after!.dialStatus} (at ${after!.dialStatusAt?.toISOString()})`);
      console.log(`  history event: ${events.map((e) => `${e.status}(${e.source})`).join(", ")}`);
      if (after!.dialStatus !== "dialed" || events.length !== 1) {
        throw new Error("PROOF FAILED: export did not flip to dialed with a history event");
      }
      console.log("\n  → a dialed business is now excluded from the next fresh batch (proven above).\n");

      // Roll everything back — the proof persists nothing and deletes nothing.
      throw ROLLBACK;
    });
  } catch (e) {
    if (e === ROLLBACK) {
      console.log("✓ prove-dnc: all assertions held. (transaction rolled back — no rows persisted)\n");
      return;
    }
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
