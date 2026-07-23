// Library API — returns the operator's saved businesses, most-recent first, each
// with its full work history: generated asset pack (→ 4 deliverables), cold audits,
// and proposals. Powers the /library control centre.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DELIVERABLE_STATUSES } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businesses = await prisma.business.findMany({
    // A business enters the Library ONLY once it's been logged as Zoom Booked
    // (or moved beyond it — no-show, on the zoom, proposal, won, closed). That
    // BOOKED_ZOOM disposition is the single gate: cold prospects, called-but-
    // -not-booked leads, and anything with stray generated work stay OUT until
    // a Zoom is actually on the calendar. DELIVERABLE_STATUSES == "Zoom booked
    // or beyond".
    where: {
      userId: session.user.id,
      deletedAt: null,
      status: { in: DELIVERABLE_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      city: true,
      industry: true,
      category: true,
      website: true,
      photoUrl: true,
      createdAt: true,
      // Intake fields — surfaced inline in the Library so the operator can set
      // the confirmed-vs-benchmark framing + copy emphasis right where they
      // regenerate the D1–D4 deliverables (these are the only inputs that change
      // what the deliverables say).
      avgClientValueCad: true,
      monthlyLeadVolume: true,
      hasCrm: true,
      hasFollowUpSequence: true,
      hasReminderSystem: true,
      hasPastCustomerDatabase: true,
      servicesFocus: true,
      bookingMethod: true,
      bookingToolName: true,
      gbpManagement: true,
      buildPriorities: true,
      generatedSystems: {
        where: { type: { in: ["ASSETS", "COLD_AUDIT"] }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, publicId: true, createdAt: true },
      },
      proposals: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          publicId: true,
          setupFee: true,
          monthlyPrice: true,
          createdAt: true,
        },
      },
    },
  });

  const items = businesses.map((b) => {
    const packs = b.generatedSystems.filter((g) => g.type === "ASSETS");
    const audits = b.generatedSystems.filter((g) => g.type === "COLD_AUDIT");
    const latestPack = packs[0];

    // The most-recent activity timestamp across all artifacts for this business.
    const stamps = [
      b.createdAt,
      ...b.generatedSystems.map((g) => g.createdAt),
      ...b.proposals.map((p) => p.createdAt),
    ];
    const lastActivity = stamps.reduce((a, c) => (c > a ? c : a), b.createdAt);

    return {
      id: b.id,
      businessId: b.id,
      hasPack: Boolean(latestPack),
      packDate: latestPack?.createdAt.toISOString() ?? null,
      lastActivity: lastActivity.toISOString(),
      createdAt: b.createdAt.toISOString(),
      business: {
        id: b.id,
        name: b.name,
        city: b.city,
        industry: b.industry,
        category: b.category,
        website: b.website,
        photoUrl: b.photoUrl,
        avgClientValueCad: b.avgClientValueCad,
        monthlyLeadVolume: b.monthlyLeadVolume,
        hasCrm: b.hasCrm,
        hasFollowUpSequence: b.hasFollowUpSequence,
        hasReminderSystem: b.hasReminderSystem,
        hasPastCustomerDatabase: b.hasPastCustomerDatabase,
        servicesFocus: b.servicesFocus,
        bookingMethod: b.bookingMethod,
        bookingToolName: b.bookingToolName,
        gbpManagement: b.gbpManagement,
        buildPriorities: b.buildPriorities,
      },
      audits: audits.map((a) => ({
        id: a.id,
        publicId: a.publicId,
        createdAt: a.createdAt.toISOString(),
      })),
      proposals: b.proposals.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        publicId: p.publicId,
        setupFee: p.setupFee,
        monthlyPrice: p.monthlyPrice,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  });

  return NextResponse.json({ items });
}
