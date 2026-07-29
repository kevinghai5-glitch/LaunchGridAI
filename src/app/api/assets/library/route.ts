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
      // The five Phase 0.6 fields. They MUST be selected here: the Library and the
      // business-detail page now render the same IntakeForm, and a field the feed
      // doesn't fetch shows as permanently blank on this screen only — which
      // reintroduces the exact defect the shared component removed, where which
      // screen the operator used changed what the deliverables said.
      hasCallTracking: true,
      hasOnlinePayment: true,
      afterHoursHandling: true,
      missedCallHandling: true,
      responseSpeed: true,
      // The two answers that closed the last structural evidence gaps — the social
      // channel and how cold the past-customer list has gone. Same rule as above:
      // selected AND returned below, or the Library shows them permanently blank
      // and the operator's answers depend on which screen he happened to open.
      socialEnquiries: true,
      pastCustomerContact: true,
      // The two applicability answers — the ones that decide what gets BUILT
      // rather than what a document says. Same rule as every field above, and it
      // bites harder here: an answer already on file that renders blank invites
      // the operator to answer it a second time, and one of the two questions
      // (deposits) reads almost identically to the one beside it.
      takesDeposits: true,
      reviewReplyOwner: true,
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
        // SELECTING A COLUMN IS ONLY HALF THE JOB — it also has to be returned.
        // These seven were fetched above but dropped here, so the Library rendered
        // them blank forever while the business-detail page (which reads the whole
        // row) showed the real answers: the same "which screen I used changed the
        // deliverables" defect the shared intake form was built to remove, just
        // moved one layer down into the feed.
        hasCallTracking: b.hasCallTracking,
        hasOnlinePayment: b.hasOnlinePayment,
        afterHoursHandling: b.afterHoursHandling,
        missedCallHandling: b.missedCallHandling,
        responseSpeed: b.responseSpeed,
        socialEnquiries: b.socialEnquiries,
        pastCustomerContact: b.pastCustomerContact,
        // Selected above AND returned here — the second half of the job, which is
        // the half that has now been forgotten twice. A column fetched but not
        // returned renders blank on this screen only, which is the "which screen I
        // used changed the deliverables" defect all over again.
        takesDeposits: b.takesDeposits,
        reviewReplyOwner: b.reviewReplyOwner,
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
