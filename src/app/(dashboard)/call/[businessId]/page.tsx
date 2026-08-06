// "On the Zoom" runner — the live sales-call cockpit.
//
// This is the missing handoff in the funnel: a Booked Zoom → a single screen that
// walks Diagnose (the four observed values, read out loud) → Pivot (leaks become
// the offer) → Offer (present the two-part investment live) → record ONE
// outcome. Diagnose swapped from the cold audit to the observed-facts row when
// the audit was deleted (owner ruling, 2026-08-01): same beat, numbers instead
// of prose. The values are computed HERE, server-side, from the snapshot columns
// — the multi-MB snapshots themselves never reach the client.
//
// Phases 2 and 3 read the SAVED CALCULATOR, not a generated proposal. The runner
// shows the client exactly the page his share link resolves to, so there is no
// version of the offer that exists only on the call.

import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildClientOffer } from "@/lib/client-offer";
import { observedFactsFor } from "@/lib/observed-facts";
import { ZoomRunner } from "@/components/call/ZoomRunner";

export const dynamic = "force-dynamic";

export default async function ZoomRunnerPage({
  params,
}: {
  params: { businessId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const business = await prisma.business.findFirst({
    where: { id: params.businessId, userId: session.user.id, deletedAt: null },
    include: { leakAssessment: true },
  });

  if (!business) notFound();

  // The four pre-dial values, off the snapshots already on the row. Pure CPU —
  // no scrape, no API call; anything unmeasured renders as "—".
  const observedFacts = observedFactsFor(business);

  // Null when the calculator has not been filled in for this business. The
  // runner says so and links to it rather than inventing an offer: a figure
  // nobody agreed to is worse on a live call than an empty panel.
  const offer = business.leakAssessment
    ? buildClientOffer({
        business: {
          name: business.name,
          industry: business.industry,
          city: business.city,
        },
        computed: business.leakAssessment.computed,
        workflowToggles: business.workflowToggles,
      })
    : null;

  return (
    <ZoomRunner
      businessId={business.id}
      business={{
        name: business.name,
        industry: business.industry,
        city: business.city,
        phone: business.phone,
        website: business.website,
        status: business.status,
      }}
      observedFacts={observedFacts}
      offer={offer}
    />
  );
}
