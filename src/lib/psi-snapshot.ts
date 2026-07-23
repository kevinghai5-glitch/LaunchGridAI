// Part H3 · PageSpeed snapshot reuse.
//
// PageSpeed Insights is a live measurement — two calls to the same URL minutes
// apart return slightly different scores (79/4.1s vs 76/4.2s). That divergence
// used to leak into the deliverables: the cold audit and the asset pack each ran
// their own PSI fetch, so the same site showed two different speed numbers.
//
// Fix: measure ONCE per business, persist the whole PsiBundle, and reuse those
// exact values across every artifact. A TTL lets a stale snapshot refresh so the
// data doesn't ossify forever.

import { prisma } from "@/lib/prisma";
import { runPageSpeed, type PsiBundle } from "@/lib/pagespeed";

// Reuse a snapshot for 30 days before re-measuring.
const PSI_SNAPSHOT_TTL_MS = 1000 * 60 * 60 * 24 * 30;

interface PsiSnapshotHost {
  id: string;
  website: string | null;
  psiSnapshot: unknown;
  psiSnapshotAt: Date | null;
}

/** Return the business's PageSpeed snapshot, measuring + persisting it on the
 *  first run and reusing the identical stored values on every run after (until
 *  the TTL lapses). Guarantees the cold audit and the asset pack render the same
 *  numbers. Persistence failures degrade gracefully to the freshly-measured
 *  bundle.
 *
 *  @param forceRefresh  The deliberate "refresh research" action — re-measure and
 *                       re-persist even if a fresh snapshot exists. Kept in lockstep
 *                       with the research snapshot so one refresh busts both. */
export async function resolvePsiSnapshot(
  business: PsiSnapshotHost,
  { forceRefresh = false }: { forceRefresh?: boolean } = {}
): Promise<PsiBundle> {
  const fresh =
    business.psiSnapshotAt != null &&
    Date.now() - business.psiSnapshotAt.getTime() < PSI_SNAPSHOT_TTL_MS;
  if (!forceRefresh && fresh && business.psiSnapshot) {
    return business.psiSnapshot as PsiBundle;
  }

  const psi = await runPageSpeed(business.website);
  // Only persist a usable measurement — never overwrite a good snapshot with an
  // unavailable one (a transient PSI outage shouldn't wipe the stored numbers).
  if (psi.available) {
    await prisma.business
      .update({
        where: { id: business.id },
        data: { psiSnapshot: psi as unknown as object, psiSnapshotAt: new Date() },
      })
      .catch(() => {});
  } else if (business.psiSnapshot) {
    return business.psiSnapshot as PsiBundle;
  }
  return psi;
}
