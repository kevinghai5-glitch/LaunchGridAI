// The client-facing offer, at a shareable URL.
//
// This replaced the generated proposal. It reads the SAVED calculator — the
// assessment the client watched being filled in on the call — plus the build
// decisions from intake, and assembles the page. Nothing is generated, so the
// link a client opens on Thursday says exactly what the screen said on Tuesday.
//
// PUBLIC AND UNAUTHENTICATED. Anyone holding the id sees this page, which is why
// the id is a cuid and why nothing on it is anything the client was not already
// shown. No operator notes, no internal scores, no other client's data.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { buildClientOffer } from "@/lib/client-offer";
import { ClientOffer } from "@/components/client/ClientOffer";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { publicId: string };
}

async function load(publicId: string) {
  return prisma.leakAssessment.findFirst({
    where: { publicId },
    include: {
      business: {
        select: { name: true, industry: true, city: true, workflowToggles: true, deletedAt: true },
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const row = await load(params.publicId);
  if (!row || row.business.deletedAt) return { title: "Not found" };
  return {
    title: `${row.business.name} — conversion recovery`,
    description: "What's leaking, what we build, and what it costs.",
  };
}

export default async function ClientOfferPage({ params }: PageProps) {
  const row = await load(params.publicId);

  // A soft-deleted business must stop serving its link. The row stays in the
  // database (nothing here is ever hard-deleted); the page simply goes.
  if (!row || row.business.deletedAt) notFound();

  const offer = buildClientOffer({
    business: {
      name: row.business.name,
      industry: row.business.industry,
      city: row.business.city,
    },
    computed: row.computed,
    workflowToggles: row.business.workflowToggles,
  });

  // No readable computation on the row. A page of zeroes and a page with no
  // figures look identical to a client and mean opposite things, so this shows
  // nothing rather than something wrong.
  if (!offer || !offer.priced) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "#F4F2EC", padding: "48px 16px" }}>
      <div
        className="mx-auto"
        style={{
          maxWidth: 860,
          border: "1px solid #E7E3D8",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(26,24,20,.05)",
        }}
      >
        <ClientOffer offer={offer} />
      </div>
      <p className="text-center" style={{ fontSize: 12, color: "#6B6659", marginTop: 24 }}>
        Delivered via ReclaimedHQ
      </p>
    </div>
  );
}
