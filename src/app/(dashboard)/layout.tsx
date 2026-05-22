import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

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
