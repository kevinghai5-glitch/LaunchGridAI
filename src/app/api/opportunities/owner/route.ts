// On-demand owner/decision-maker resolution for a SINGLE business.
//
// POST { id } — resolves the owner name for one prospect from a free native read
// of its site (homepage + one About/Team page), caches it on the row, and returns
// it. Used when a prospect card is opened so the "Ask for <owner>" line can fill
// in without the daily generation ever fanning a per-site fetch across all 30
// (which blew the request budget). Regex-only + short-timeout — fast and cheap.
//
// Idempotent: if the owner is already cached it's returned as-is with no fetch.
// A blank result is a valid answer (verifiable-or-silent) and is not persisted,
// so a later refresh can still find a name if the site later names one.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveOwnerFromWebsite, resolveOwnerViaSearch } from "@/lib/owner-name";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const biz = await prisma.business.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    select: { id: true, name: true, website: true, city: true, ownerName: true },
  });
  if (!biz) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Already resolved — return the cached name, no fetch.
  if (biz.ownerName) {
    return NextResponse.json({ ownerName: biz.ownerName });
  }

  // Single business the operator is viewing — afford the AI fallback tier for a
  // higher hit-rate (the daily batch stays regex-only for speed). Two tiers:
  //   1. the business's own site (About/Team page), then
  //   2. a "<name> <city> owner" web search — for the many local sites that never
  //      name an owner but whose owner is listed in a directory / BBB / LinkedIn.
  let ownerName = await resolveOwnerFromWebsite(biz.website, biz.name, { useAI: true }).catch(
    () => null
  );
  if (!ownerName) {
    ownerName = await resolveOwnerViaSearch(biz.name, biz.city).catch(() => null);
  }

  // Only persist a found name (never clobber with a blank); a null just means
  // the site doesn't clearly name an owner, which is a fine answer to show.
  if (ownerName) {
    await prisma.business.update({ where: { id: biz.id }, data: { ownerName } }).catch(() => {});
  }

  return NextResponse.json({ ownerName: ownerName ?? null });
}
