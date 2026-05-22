import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { PublicProposal } from "@/components/proposals/PublicProposal";

interface PageProps {
  params: { publicId: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const proposal = await prisma.proposal.findUnique({
    where: { publicId: params.publicId },
    include: { business: true },
  });
  if (!proposal) return { title: "Proposal Not Found" };
  return {
    title: `${proposal.title} — Proposal for ${proposal.business.name}`,
    description: proposal.packageOverview,
  };
}

async function markViewed(publicId: string) {
  await prisma.proposal.updateMany({
    where: { publicId, status: "SENT" },
    data: { status: "VIEWED" },
  });
}

export default async function PublicProposalPage({ params }: PageProps) {
  const proposal = await prisma.proposal.findUnique({
    where: { publicId: params.publicId },
    include: { business: true },
  });

  if (!proposal) notFound();

  void markViewed(params.publicId);

  const deliverables = Array.isArray(proposal.deliverables)
    ? (proposal.deliverables as string[])
    : [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "48px 16px",
      }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 760,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <PublicProposal
          business={proposal.business}
          title={proposal.title}
          overview={proposal.packageOverview}
          price={proposal.monthlyPrice}
          deliverables={deliverables}
        />
      </div>
      <p
        className="text-center"
        style={{
          fontSize: 12.5,
          color: "var(--text-subtle)",
          marginTop: 24,
        }}
      >
        Delivered via LaunchGrid AI
      </p>
    </div>
  );
}
