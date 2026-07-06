import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/dashboard/TopBar";
import { DashboardBody } from "./DashboardBody";

export const dynamic = "force-dynamic";

function relTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

// Build a cumulative time series from dated values for a sparkline.
// Returns [] when there is too little history to be meaningful.
function cumulativeSeries(points: { at: Date; value: number }[]): number[] {
  if (points.length < 2) return [];
  const sorted = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
  let running = 0;
  return sorted.map((p) => (running += p.value));
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = session.user.id;

  const [
    businessCount,
    proposalCount,
    wonDeals,
    pipelineDeals,
    recentBusinesses,
    allDeals,
    recentGenerations,
    recentProposals,
    recentSavedBiz,
    opportunityPool,
  ] = await Promise.all([
    prisma.business.count({ where: { userId } }),
    prisma.proposal.count({ where: { userId } }),
    prisma.deal.findMany({
      where: { userId, stage: "WON" },
      select: { monthlyValue: true, updatedAt: true, business: { select: { name: true } } },
    }),
    prisma.deal.findMany({
      where: { userId, stage: { in: ["SYSTEMS_GENERATED", "PROPOSAL_SENT", "FOLLOW_UP"] } },
      select: { monthlyValue: true, createdAt: true },
    }),
    prisma.business.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.deal.findMany({
      where: { userId },
      select: { stage: true, monthlyValue: true, businessId: true },
    }),
    prisma.generatedSystem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        type: true,
        createdAt: true,
        businessId: true,
        business: { select: { name: true } },
      },
    }),
    prisma.proposal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        status: true,
        createdAt: true,
        monthlyPrice: true,
        business: { select: { name: true } },
      },
    }),
    prisma.business.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { name: true, city: true, address: true, createdAt: true },
    }),
    prisma.business.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        website: true,
        rating: true,
        reviewCount: true,
      },
    }),
  ]);

  const totalMRR = wonDeals.reduce((s, d) => s + d.monthlyValue, 0);
  const pipelineMRR = pipelineDeals.reduce((s, d) => s + d.monthlyValue, 0);
  const wonCount = wonDeals.length;
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const stageCounts = allDeals.reduce((acc, d) => {
    acc[d.stage] = (acc[d.stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ---- Real sparklines (cumulative MRR / pipeline over deal history) ----
  const sparkMRR = cumulativeSeries(
    wonDeals.map((d) => ({ at: d.updatedAt, value: d.monthlyValue }))
  );
  const sparkPipe = cumulativeSeries(
    pipelineDeals.map((d) => ({ at: d.createdAt, value: d.monthlyValue }))
  );

  // ---- Real unified activity feed ----
  type Activity = {
    kind: "signed" | "generated" | "proposal" | "saved";
    tone: "money" | "accent" | "neutral";
    actor: string;
    what: string;
    at: number;
    when: string;
    highlight?: boolean;
  };
  const events: Activity[] = [];

  for (const d of wonDeals) {
    events.push({
      kind: "signed",
      tone: "money",
      actor: d.business?.name ?? "A client",
      what: `signed · $${d.monthlyValue.toLocaleString()}/mo`,
      at: d.updatedAt.getTime(),
      when: relTime(d.updatedAt),
      highlight: true,
    });
  }
  for (const g of recentGenerations) {
    const label = g.type === "ASSETS" ? "Growth Infrastructure Pack" : g.type === "LEAD" ? "Lead system" : "Content system";
    events.push({
      kind: "generated",
      tone: "accent",
      actor: "Studio",
      what: `shipped ${label} for ${g.business?.name ?? "a business"}`,
      at: g.createdAt.getTime(),
      when: relTime(g.createdAt),
    });
  }
  for (const p of recentProposals) {
    const verb = p.status === "SENT" || p.status === "VIEWED" ? "sent" : p.status === "ACCEPTED" ? "closed" : "drafted";
    events.push({
      kind: "proposal",
      tone: "neutral",
      actor: "You",
      what: `${verb} proposal for ${p.business?.name ?? "a business"}`,
      at: p.createdAt.getTime(),
      when: relTime(p.createdAt),
    });
  }
  for (const b of recentSavedBiz) {
    events.push({
      kind: "saved",
      tone: "neutral",
      actor: "Radar",
      what: `saved ${b.name}${b.city ? ` · ${b.city}` : ""}`,
      at: b.createdAt.getTime(),
      when: relTime(b.createdAt),
    });
  }

  const activity = events
    .sort((a, b) => b.at - a.at)
    .slice(0, 6)
    .map(({ at, ...rest }) => rest);

  // ---- Real opportunities (scored from actual signals) ----
  const opportunities = opportunityPool
    .map((b) => {
      const rating = b.rating ?? 0;
      const reviewCount = b.reviewCount ?? 0;
      let score = 50;
      const gaps: string[] = [];
      if (!b.website) {
        score += 30;
        gaps.push("No website detected");
      }
      if (rating > 0 && rating < 4.2) {
        score += 18;
        gaps.push(`${rating.toFixed(1)}★ rating`);
      }
      if (reviewCount === 0) {
        score += 12;
        gaps.push("No reviews yet");
      } else if (reviewCount < 25) {
        score += 16;
        gaps.push("Thin review volume");
      } else if (reviewCount < 75) {
        score += 8;
        gaps.push("Modest review volume");
      }
      return {
        score: Math.min(99, score),
        name: b.name,
        city: b.city ?? b.address ?? "—",
        weakness: gaps.slice(0, 2).join(", ") || "Strong presence · upsell candidate",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // ---- Real recent generations list ----
  const wonBizIds = new Set(allDeals.filter((d) => d.stage === "WON").map((d) => d.businessId));
  const generations = recentGenerations.slice(0, 4).map((g) => {
    const label = g.type === "ASSETS" ? "Growth Infrastructure Pack" : g.type === "LEAD" ? "Lead system" : "Content system";
    return {
      title: label,
      sub: g.business?.name ?? "—",
      time: relTime(g.createdAt),
      closed: g.businessId ? wonBizIds.has(g.businessId) : false,
    };
  });

  return (
    <>
      <TopBar title="Home" />
      <DashboardBody
        firstName={firstName}
        totalMRR={totalMRR}
        pipelineMRR={pipelineMRR}
        wonCount={wonCount}
        businessCount={businessCount}
        proposalCount={proposalCount}
        stageCounts={stageCounts}
        sparkMRR={sparkMRR}
        sparkPipe={sparkPipe}
        activity={activity}
        opportunities={opportunities}
        generations={generations}
        recentBusinesses={recentBusinesses.map((b) => ({
          id: b.id,
          name: b.name,
          industry: b.industry ?? "—",
          city: b.city ?? b.address ?? "—",
          rating: b.rating ?? 0,
          status: "saved",
        }))}
      />
    </>
  );
}
