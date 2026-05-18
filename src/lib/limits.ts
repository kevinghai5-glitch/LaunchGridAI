import { prisma } from "@/lib/prisma";

export type LimitFeature = "businessSaves" | "generations" | "proposals";

export async function checkPlanLimit(
  userId: string,
  feature: LimitFeature
): Promise<{ allowed: boolean; current: number; limit: number; plan: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const plan = user?.plan ?? "free";

  if (plan === "pro") {
    return { allowed: true, current: 0, limit: Infinity, plan };
  }

  // Free plan limits
  const limits: Record<LimitFeature, number> = {
    businessSaves: 10,
    generations: 5,
    proposals: 3,
  };

  const limit = limits[feature];
  let current = 0;

  switch (feature) {
    case "businessSaves":
      current = await prisma.business.count({ where: { userId } });
      break;
    case "generations":
      current = await prisma.generatedSystem.count({ where: { userId } });
      break;
    case "proposals":
      current = await prisma.proposal.count({ where: { userId } });
      break;
  }

  return {
    allowed: current < limit,
    current,
    limit,
    plan,
  };
}
