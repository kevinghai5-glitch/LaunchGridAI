import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MotivationPopup } from "@/components/dashboard/MotivationPopup";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const [wonDeals, pipelineDeals, pipelineCount, proposalCount, opportunityCount] =
    await Promise.all([
      prisma.deal.findMany({
        where: { userId: session.user.id, stage: "WON" },
        select: { monthlyValue: true },
      }),
      prisma.deal.findMany({
        where: {
          userId: session.user.id,
          stage: { in: ["SYSTEMS_GENERATED", "PROPOSAL_SENT", "FOLLOW_UP"] },
        },
        select: { monthlyValue: true },
      }),
      prisma.deal.count({
        where: { userId: session.user.id, stage: { notIn: ["WON", "LOST"] } },
      }),
      prisma.proposal.count({
        where: { userId: session.user.id, status: { notIn: ["ACCEPTED", "REJECTED"] } },
      }),
      // Un-triaged generated batch — the SUGGESTED prospects awaiting approve/decline.
      // Clearing Opportunities hard-deletes these raw suggestions, so this drops to 0.
      prisma.business.count({
        where: { userId: session.user.id, status: "SUGGESTED", source: "DAILY" },
      }),
    ]);
  const totalMRR = wonDeals.reduce((s, d) => s + d.monthlyValue, 0);
  const pipelineMRR = pipelineDeals.reduce((s, d) => s + d.monthlyValue, 0);
  const activeClients = wonDeals.length;

  return (
    <div className="flex" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar
        totalMRR={totalMRR}
        pipelineMRR={pipelineMRR}
        activeClients={activeClients}
        opportunityCount={opportunityCount}
        pipelineCount={pipelineCount}
        proposalCount={proposalCount}
        userName={session.user.name ?? "Account"}
        userPlan={session.user.plan === "pro" ? "Operator" : "Free"}
      />
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
      <MotivationPopup />
    </div>
  );
}
