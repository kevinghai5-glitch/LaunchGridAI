// Dashboard + sidebar revenue rollup — computed from the CANONICAL source
// (Business.status + the latest proposal's retainer), exactly like the CRM board
// (see src/app/api/crm/route.ts). The legacy Deal table is never populated, so
// anything that read MRR/pipeline from it rendered $0 forever even with live
// clients. This reads the real lifecycle instead, so the Home page and the
// sidebar snapshot always reflect actual won/in-motion revenue.

import { prisma } from "@/lib/prisma";
import { stageForStatus, type CrmStageId } from "@/lib/crm";

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
      proposals: {
        where: { deletedAt: null },
        select: { monthlyPrice: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
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
    // Prefer an attached deal's value, else the latest proposal's retainer.
    const dealValue = b.deals.reduce((s, d) => s + (d.monthlyValue || 0), 0);
    const monthlyValue = dealValue || b.proposals[0]?.monthlyPrice || 0;
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
        r.pipelinePoints.push({ at: b.proposals[0]?.createdAt ?? b.createdAt, value: monthlyValue });
      }
    }
  }

  return r;
}
