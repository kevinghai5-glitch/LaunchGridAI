import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/dashboard/TopBar";
import { DashboardBody } from "./DashboardBody";

export const dynamic = "force-dynamic";

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
  ] = await Promise.all([
    prisma.business.count({ where: { userId } }),
    prisma.proposal.count({ where: { userId } }),
    prisma.deal.findMany({
      where: { userId, stage: "WON" },
      select: { monthlyValue: true },
    }),
    prisma.deal.findMany({
      where: { userId, stage: { in: ["SYSTEMS_GENERATED", "PROPOSAL_SENT", "FOLLOW_UP"] } },
      select: { monthlyValue: true },
    }),
    prisma.business.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.deal.findMany({
      where: { userId },
      select: { stage: true, monthlyValue: true },
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
