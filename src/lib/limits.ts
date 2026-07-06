export type LimitFeature = "businessSaves" | "generations" | "proposals";

// This is a single-operator product with no tiers or billing — nothing is
// metered. Every feature is unlimited for everyone. The signature is kept so
// existing callers don't need to change.
export async function checkPlanLimit(
  _userId: string,
  _feature: LimitFeature
): Promise<{ allowed: boolean; current: number; limit: number; plan: string }> {
  return { allowed: true, current: 0, limit: Infinity, plan: "unlimited" };
}
