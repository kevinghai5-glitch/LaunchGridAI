import { getServerSession } from "@/lib/internal-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/dashboard/Sidebar";

// Resolves the internal owner + reads live data on every request.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  const wonDeals = await prisma.deal.findMany({
    where: { userId: session.user.id, stage: "WON" },
    select: { monthlyValue: true },
  });
  const totalMRR = wonDeals.reduce((s, d) => s + d.monthlyValue, 0);

  return (
    <div className="flex" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar
        totalMRR={totalMRR}
        userName={session.user.name ?? "Account"}
        userPlan={session.user.plan === "pro" ? "Pro · Annual" : "Free"}
      />
      <main className="flex-1 min-w-0 flex flex-col">{children}</main>
    </div>
  );
}
