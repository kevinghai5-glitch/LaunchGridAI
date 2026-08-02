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

  // ── THE THEME FENCE ────────────────────────────────────────────────────────
  // `lg-app` is where the dark dashboard theme is actually APPLIED — canvas,
  // body ink, font stack, Inter feature settings, letter-spacing, ::selection,
  // focus ring, scrollbars, accent-color, color-scheme and the default border
  // colour. Every one of those was global in globals.css until now, and global
  // meant it also reached the two CLIENT-FACING routes that share the root
  // layout: /a/[publicId] (the cold-audit teaser a prospect opens from the
  // pre-call email) and /p/[publicId] (the public proposal). Both are
  // cream/serif brand documents. Putting the theme here instead of on <html>
  // is what makes it structurally impossible for either to inherit it.
  //
  // `lg-dashboard` carries min-width: 1320px, which the operator's tables need.
  // It is a SEPARATE class from lg-app on purpose — that rule used to live on
  // `body`, where it was telling a prospect's phone to render a 1320px viewport.
  //
  // `data-theme="dark"` is the selector tailwind.config.ts keys the `dark:`
  // variant to. It sits here, not on <html>, so `dark:` cannot reach a
  // prospect's page either.
  //
  // Do not move any of these three to the root layout.
  return (
    <div
      className="lg-app lg-dashboard flex"
      data-theme="dark"
      style={{ minHeight: "100vh" }}
    >
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
