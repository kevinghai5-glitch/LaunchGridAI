// "On the Zoom" runner — the live sales-call cockpit.
//
// This is the missing handoff in the funnel: a Booked Zoom → a single screen that
// walks Diagnose (the four observed values, read out loud) → Pivot (leaks become
// the offer) → Proposal (present the two-part investment live) → record ONE
// outcome. Diagnose swapped from the cold audit to the observed-facts row when
// the audit was deleted (owner ruling, 2026-08-01): same beat, numbers instead
// of prose. The values are computed HERE, server-side, from the snapshot columns
// — the multi-MB snapshots themselves never reach the client.

import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proposalContentFromRow, buildProposalDefaults } from "@/lib/proposal-defaults";
import { observedFactsFor } from "@/lib/observed-facts";
import { ZoomRunner } from "@/components/call/ZoomRunner";
import type { AssetPack } from "@/types";

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
    include: {
      generatedSystems: {
        where: { type: "ASSETS", deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { type: true, content: true },
      },
      proposals: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!business) notFound();

  const packRow = business.generatedSystems.find((s) => s.type === "ASSETS");
  const pack = (packRow?.content as unknown as AssetPack) ?? null;

  // The four pre-dial values, off the snapshots already on the row. Pure CPU —
  // no scrape, no API call; anything unmeasured renders as "—".
  const observedFacts = observedFactsFor(business);

  const bizLite = {
    name: business.name,
    industry: business.industry,
    city: business.city,
  };

  // Present the real proposal if one exists; otherwise a pack-grounded default so
  // the Proposal phase is never empty on the call.
  const proposalRow = business.proposals[0];
  const proposal = proposalRow
    ? proposalContentFromRow({ ...proposalRow, business: bizLite })
    : buildProposalDefaults(bizLite, { pack });

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
      proposal={proposal}
    />
  );
}
