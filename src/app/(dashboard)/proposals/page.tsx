import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, ExternalLink, DollarSign } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusColors: Record<string, string> = {
  DRAFT: "gray",
  SENT: "blue",
  VIEWED: "yellow",
  ACCEPTED: "green",
  REJECTED: "red",
};

export default async function ProposalsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const proposals = await prisma.proposal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { business: true },
  });

  const totalValue = proposals.reduce(
    (sum, p) => (p.status === "ACCEPTED" ? sum + p.monthlyPrice : sum),
    0
  );

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Proposals" subtitle="Manage your client proposals" />
      <div className="p-6 space-y-6">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="panel px-4 py-2 flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-gray-400">{proposals.length} total</span>
            </div>
            {totalValue > 0 && (
              <div className="panel px-4 py-2 flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-green-400" />
                <span className="text-green-400">{formatCurrency(totalValue)}/mo accepted</span>
              </div>
            )}
          </div>
          <Button variant="blue" size="sm" asChild>
            <Link href="/proposals/new">
              <Plus className="h-4 w-4 mr-2" />
              New Proposal
            </Link>
          </Button>
        </div>

        {/* Proposals list */}
        {proposals.length === 0 ? (
          <div className="text-center py-24">
            <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No proposals yet</h3>
            <p className="text-gray-500 text-sm mb-6">Create your first proposal and start closing recurring clients.</p>
            <Button variant="blue" asChild>
              <Link href="/proposals/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Proposal
              </Link>
            </Button>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="divide-y divide-white/[0.06]">
              {proposals.map((proposal) => (
                <Link
                  key={proposal.id}
                  href={`/proposals/${proposal.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors truncate">
                      {proposal.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {proposal.business.name} · {formatDate(proposal.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-white">
                      {formatCurrency(proposal.monthlyPrice)}/mo
                    </span>
                    <Badge variant={statusColors[proposal.status] as "blue" | "green" | "gray" | "yellow" | "red"}>
                      {proposal.status}
                    </Badge>
                    <a
                      href={`/p/${proposal.publicId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-500 hover:text-blue-400 transition-colors"
                      aria-label="Open public proposal"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
