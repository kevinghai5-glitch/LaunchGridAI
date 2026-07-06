import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { PublicProposal } from "@/components/proposals/PublicProposal";
import { proposalContentFromRow } from "@/lib/proposal-defaults";

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

  const content = proposalContentFromRow(proposal);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F4F2EC",
        padding: "48px 16px",
      }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 820,
          border: "1px solid #E7E3D8",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(26,24,20,.05)",
        }}
      >
        <PublicProposal business={proposal.business} content={content} />
      </div>
      <p
        className="text-center"
        style={{
          fontSize: 12,
          color: "#6B6659",
          marginTop: 24,
        }}
      >
        Delivered via LaunchGrid
      </p>
    </div>
  );
}
