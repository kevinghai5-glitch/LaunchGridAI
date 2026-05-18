import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/dashboard/TopBar";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Sparkles,
  FileText,
  DollarSign,
  ArrowRight,
  Search,
  Zap,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = session.user.id;

  const [
    businessCount,
    systemCount,
    proposalCount,
    wonDeals,
    recentBusinesses,
    recentProposals,
  ] = await Promise.all([
    prisma.business.count({ where: { userId } }),
    prisma.generatedSystem.count({ where: { userId } }),
    prisma.proposal.count({ where: { userId } }),
    prisma.deal.findMany({
      where: { userId, stage: "WON" },
      select: { monthlyValue: true },
    }),
    prisma.business.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.proposal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { business: true },
    }),
  ]);

  const mrr = wonDeals.reduce((sum, d) => sum + d.monthlyValue, 0);

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title={`Good day, ${session.user.name?.split(" ")[0] ?? "there"} 👋`}
        subtitle="Here's your LaunchGrid overview"
      />

      <div className="p-6 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Saved Businesses"
            value={businessCount}
            icon={Building2}
            description="Total businesses in your pipeline"
          />
          <StatCard
            title="Systems Generated"
            value={systemCount}
            icon={Sparkles}
            description="Lead + Content systems created"
          />
          <StatCard
            title="Proposals"
            value={proposalCount}
            icon={FileText}
            description="Total proposals created"
          />
          <StatCard
            title="Estimated MRR"
            value={formatCurrency(mrr)}
            icon={DollarSign}
            description="From won deals"
            trend={mrr > 0 ? `${wonDeals.length} active client${wonDeals.length !== 1 ? "s" : ""}` : undefined}
          />
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/businesses" className="glass-card p-5 flex items-center gap-4 group hover:border-blue-500/30 transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Search className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">Find Businesses</div>
                <div className="text-xs text-gray-500">Search by industry & city</div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
            </Link>

            <Link href="/proposals/new" className="glass-card p-5 flex items-center gap-4 group hover:border-blue-500/30 transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">New Proposal</div>
                <div className="text-xs text-gray-500">Build & send a proposal</div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
            </Link>

            <Link href="/deals" className="glass-card p-5 flex items-center gap-4 group hover:border-blue-500/30 transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Zap className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">View Pipeline</div>
                <div className="text-xs text-gray-500">Manage your deals</div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
            </Link>
          </div>
        </div>

        {/* Recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent businesses */}
          <div className="panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Recent Businesses</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/businesses" className="text-xs text-gray-400 hover:text-blue-400">View all</Link>
              </Button>
            </div>
            {recentBusinesses.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No businesses saved yet. <Link href="/businesses" className="text-blue-400 hover:underline">Find some.</Link></p>
            ) : (
              <div className="space-y-3">
                {recentBusinesses.map((b) => (
                  <Link key={b.id} href={`/businesses/${b.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.03] transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{b.name}</div>
                      <div className="text-xs text-gray-500 truncate">{b.city ?? b.address ?? "—"}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent proposals */}
          <div className="panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Recent Proposals</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/proposals" className="text-xs text-gray-400 hover:text-blue-400">View all</Link>
              </Button>
            </div>
            {recentProposals.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No proposals yet. <Link href="/proposals/new" className="text-blue-400 hover:underline">Create one.</Link></p>
            ) : (
              <div className="space-y-3">
                {recentProposals.map((p) => (
                  <Link key={p.id} href={`/proposals/${p.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{p.title}</div>
                      <div className="text-xs text-gray-500">{p.business.name} · ${p.monthlyPrice}/mo</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === "WON" ? "bg-green-500/10 text-green-400" :
                      p.status === "SENT" ? "bg-blue-500/10 text-blue-400" :
                      p.status === "VIEWED" ? "bg-yellow-500/10 text-yellow-400" :
                      "bg-white/[0.05] text-gray-400"
                    }`}>
                      {p.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
