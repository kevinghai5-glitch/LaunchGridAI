// Dashboard + sidebar revenue rollup — computed from the CANONICAL source
// (Business.status), exactly like the CRM board (see src/app/api/crm/route.ts).
// The legacy Deal table is never populated, so anything that read MRR/pipeline
// from it rendered $0 forever even with live clients. This reads the real
// lifecycle instead, so the Home page and the sidebar snapshot always reflect
// actual won/in-motion revenue.
//
// WHERE THE RETAINER COMES FROM (changed 2026-08-06). It used to be read off the
// latest Proposal row. When the proposal generator was deleted and every row
// soft-deleted, that lookup returned nothing for every business and MRR silently
// fell to $0 — live clients and all. The retainer is now what it actually is:
// ONE price, the same for every client, in src/lib/constants.ts. A WON business
// is a signed client, and a signed client pays it. There is no per-client
// retainer to look up any more, so there is nothing to fall back from.

import { prisma } from "@/lib/prisma";
import { stageForStatus, type CrmStageId } from "@/lib/crm";
import { MONTHLY_RETAINER_CAD } from "@/lib/constants";

export interface CrmRollup {
  /** Sum of monthly retainer across WON leads. */
  totalMRR: number;
  /** Sum of monthly retainer across in-motion leads that already have a value. */
  pipelineMRR: number;
  /** Count of WON leads (active clients). */
  activeClients: number;
  /** Count of in-motion (warming) leads. */
  pipelineCount: number;
  /** Lead counts keyed by CRM stage id (drives the Home pipeline widget). */
  stageCounts: Record<string, number>;
  /** WON leads with their value + when they closed (activity feed + sparkline). */
  won: { id: string; name: string; monthlyValue: number; at: Date }[];
  /** Ids of WON businesses (used to mark generations as "signed"). */
  wonBizIds: Set<string>;
  /** Dated pipeline values for the in-motion sparkline. */
  pipelinePoints: { at: Date; value: number }[];
}

// Stages whose leads are "in motion" toward a close and can carry deal $.
const IN_MOTION: CrmStageId[] = ["INTERESTED", "BOOKED", "PROPOSAL"];

export async function computeCrmRollup(userId: string): Promise<CrmRollup> {
  const businesses = await prisma.business.findMany({
    where: { userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      lastActivityAt: true,
      createdAt: true,
      deals: { where: { deletedAt: null }, select: { monthlyValue: true } },
    },
  });

  const r: CrmRollup = {
    totalMRR: 0,
    pipelineMRR: 0,
    activeClients: 0,
    pipelineCount: 0,
    stageCounts: {},
    won: [],
    wonBizIds: new Set<string>(),
    pipelinePoints: [],
  };

  for (const b of businesses) {
    // A negotiated deal value wins if one was ever attached; otherwise it is the
    // standard retainer, which is what every client is actually on.
    const dealValue = b.deals.reduce((s, d) => s + (d.monthlyValue || 0), 0);
    const monthlyValue = dealValue || MONTHLY_RETAINER_CAD;
    const stage = stageForStatus(b.status);
    r.stageCounts[stage] = (r.stageCounts[stage] || 0) + 1;

    if (stage === "WON") {
      r.totalMRR += monthlyValue;
      r.activeClients += 1;
      r.wonBizIds.add(b.id);
      r.won.push({ id: b.id, name: b.name, monthlyValue, at: b.lastActivityAt ?? b.createdAt });
    } else if (IN_MOTION.includes(stage)) {
      r.pipelineCount += 1;
      if (monthlyValue > 0) {
        r.pipelineMRR += monthlyValue;
        r.pipelinePoints.push({ at: b.lastActivityAt ?? b.createdAt, value: monthlyValue });
      }
    }
  }

  return r;
}
