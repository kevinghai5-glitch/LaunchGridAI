import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/search?q=… — the data source behind the ⌘K command palette.
//
// Two rules keep this route fast enough to hit on every few keystrokes:
//
//  1. SMALL FLAT OBJECTS ONLY. A Business row also carries the multi-MB
//     research/PSI snapshot blobs; the `select` lists below are the wall that
//     keeps those off this hot path. Never widen them to `include`.
//  2. Empty query is the palette's RESTING state, not an error: it returns the
//     5 most recently-touched businesses so the palette is useful before a
//     single keystroke. (The static Pages list lives client-side in
//     CommandPalette.tsx — no fetch needed for those.)

const RECENT_LIMIT = 5;
const BUSINESS_LIMIT = 8;

// The flat shape every business hit ships with — id/name/city/status, nothing
// else. city + status render in the palette so two same-named rows can be told
// apart.
const BUSINESS_SELECT = {
  id: true,
  name: true,
  city: true,
  status: true,
} as const;

// "Most recently worked" first; rows never touched fall back to newest-created.
const RECENCY_ORDER = [
  { lastActivityAt: { sort: "desc", nulls: "last" } },
  { createdAt: "desc" },
] as const;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

    if (!q) {
      const recent = await prisma.business.findMany({
        where: { userId: session.user.id, deletedAt: null },
        orderBy: [...RECENCY_ORDER],
        take: RECENT_LIMIT,
        select: BUSINESS_SELECT,
      });
      return NextResponse.json({
        businesses: recent.map((b) => ({ ...b, href: `/businesses/${b.id}` })),
      });
    }

    const businesses = await prisma.business.findMany({
        where: {
          userId: session.user.id,
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { industry: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: [...RECENCY_ORDER],
        take: BUSINESS_LIMIT,
        select: BUSINESS_SELECT,
    });

    return NextResponse.json({
      businesses: businesses.map((b) => ({ ...b, href: `/businesses/${b.id}` })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
