import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeCrmRollup } from "@/lib/crm-rollup";
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

  // The Opportunities page only ever shows ONE niche's un-triaged batch — the
  // most recently generated one (see api/opportunities/daily GET). The sidebar
  // badge must mirror exactly that, or it inflates with stale SUGGESTED leads
  // from older niche generations the page never displays. So scope the count to
  // the latest niche's batch, not every SUGGESTED+DAILY row ever generated.
  const latestSuggested = await prisma.business.findFirst({
    where: { userId: session.user.id, status: "SUGGESTED", source: "DAILY", deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { industry: true },
  });

  // MRR / pipeline / clients come from the CANONICAL source (Business.status +
  // latest proposal), not the never-populated Deal table that rendered $0.
  const [rollup, proposalCount, opportunityCount] = await Promise.all([
    computeCrmRollup(session.user.id),
    prisma.proposal.count({
      where: { userId: session.user.id, status: { notIn: ["ACCEPTED", "REJECTED"] }, deletedAt: null },
    }),
    // Un-triaged batch for the latest niche only — matches what Opportunities
    // shows. 0 when there's no current batch (e.g. everything's been triaged
    // or cleared), so the badge disappears instead of showing stale leftovers.
    latestSuggested?.industry
      ? prisma.business.count({
          where: {
            userId: session.user.id,
            status: "SUGGESTED",
            source: "DAILY",
            industry: latestSuggested.industry,
            deletedAt: null,
          },
        })
      : Promise.resolve(0),
  ]);
  const totalMRR = rollup.totalMRR;
  const pipelineMRR = rollup.pipelineMRR;
  const activeClients = rollup.activeClients;
  const pipelineCount = rollup.pipelineCount;

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
