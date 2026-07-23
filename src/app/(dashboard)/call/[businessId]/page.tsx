// "On the Zoom" runner — the live sales-call cockpit.
//
// This is the missing handoff in the funnel: a Booked Zoom → a single screen that
// walks Diagnose (show the audit) → Pivot (leaks become the offer) → Proposal
// (present the two-part investment live) → record ONE outcome. It recomposes the
// exact deliverables the prospect will see (ColdAuditView + PublicProposal) so the
// rep presents from the same artifacts, then advances the lead's lifecycle state.

import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proposalContentFromRow, buildProposalDefaults } from "@/lib/proposal-defaults";
import { ZoomRunner } from "@/components/call/ZoomRunner";
import type { AssetPack, ColdAuditReport } from "@/types";

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
        where: { type: { in: ["COLD_AUDIT", "ASSETS"] }, deletedAt: null },
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

  const auditRow = business.generatedSystems.find((s) => s.type === "COLD_AUDIT");
  const packRow = business.generatedSystems.find((s) => s.type === "ASSETS");
  const audit = (auditRow?.content as unknown as ColdAuditReport) ?? null;
  const pack = (packRow?.content as unknown as AssetPack) ?? null;

  const bizLite = {
    name: business.name,
    industry: business.industry,
    city: business.city,
  };

  // Present the real proposal if one exists; otherwise an audit-grounded default so
  // the Proposal phase is never empty on the call.
  const proposalRow = business.proposals[0];
  const proposal = proposalRow
    ? proposalContentFromRow({ ...proposalRow, business: bizLite })
    : buildProposalDefaults(bizLite, { pack, audit });

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
      audit={audit}
      proposal={proposal}
    />
  );
}
