import { prisma } from "@/lib/prisma";

// Internal-use build: there is no sign-in. Every request resolves to a single
// owner account. We find-or-create it so the existing user-scoped data layer
// (Prisma queries keyed by userId, plan limits, etc.) keeps working unchanged.

const INTERNAL_EMAIL = process.env.INTERNAL_USER_EMAIL ?? "owner@launchgrid.local";
const INTERNAL_NAME = process.env.INTERNAL_USER_NAME ?? "Owner";

export interface InternalSession {
  user: {
    id: string;
    name: string | null;
    email: string;
    plan: string;
  };
}

let cachedUserId: string | null = null;

async function getOwner() {
  if (cachedUserId) {
    const existing = await prisma.user.findUnique({ where: { id: cachedUserId } });
    if (existing) return existing;
    cachedUserId = null;
  }

  const found = await prisma.user.findUnique({ where: { email: INTERNAL_EMAIL } });
  const owner =
    found ??
    (await prisma.user.create({
      data: { email: INTERNAL_EMAIL, name: INTERNAL_NAME, plan: "pro" },
    }));

  cachedUserId = owner.id;
  return owner;
}

// Drop-in replacement for next-auth's getServerSession. The options argument is
// accepted (so call sites stay unchanged) but ignored. Always returns a session.
export async function getServerSession(
  _options?: unknown
): Promise<InternalSession> {
  const owner = await getOwner();
  return {
    user: {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      plan: owner.plan,
    },
  };
}
