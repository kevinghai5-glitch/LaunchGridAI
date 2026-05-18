import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CheckCircle2, Mail, PhoneCall } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Metadata } from "next";

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

  // Mark as viewed (fire and forget)
  void markViewed(params.publicId);

  const deliverables = Array.isArray(proposal.deliverables)
    ? (proposal.deliverables as string[])
    : [];
  const benefits = Array.isArray(proposal.benefits)
    ? (proposal.benefits as string[])
    : [];
  const systemsIncluded = Array.isArray(proposal.systemsIncluded)
    ? (proposal.systemsIncluded as string[])
    : [];

  return (
    <div className="min-h-screen bg-[#0A0B0F] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-sm text-gray-500 mb-2">Proposal for</p>
          <h1 className="text-3xl font-bold text-white mb-1">{proposal.business.name}</h1>
          {proposal.business.city && (
            <p className="text-gray-400">{proposal.business.industry} · {proposal.business.city}</p>
          )}
        </div>

        {/* Main card */}
        <div className="bg-[#0F1424] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Title bar */}
          <div className="p-8 border-b border-white/10">
            <h2 className="text-2xl font-bold text-white mb-3">{proposal.title}</h2>
            {systemsIncluded.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {systemsIncluded.map((s) => (
                  <span key={s} className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                    {s}
                  </span>
                ))}
              </div>
            )}
            <p className="text-gray-300 leading-relaxed">{proposal.packageOverview}</p>
          </div>

          {/* Price */}
          <div className="p-8 bg-gradient-to-r from-blue-600/10 to-blue-500/5 border-b border-white/10">
            <p className="text-sm text-gray-400 mb-1">Monthly Investment</p>
            <p className="text-5xl font-black text-blue-400">
              {formatCurrency(proposal.monthlyPrice)}
              <span className="text-xl text-gray-400 font-normal">/month</span>
            </p>
          </div>

          {/* Deliverables */}
          {deliverables.length > 0 && (
            <div className="p-8 border-b border-white/10">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-5">
                What&apos;s Included
              </h3>
              <ul className="space-y-3">
                {deliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-200">
                    <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Benefits */}
          {benefits.length > 0 && (
            <div className="p-8 border-b border-white/10">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-5">
                Why It Works
              </h3>
              <ul className="space-y-3">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next steps */}
          {proposal.nextSteps && (
            <div className="p-8 border-b border-white/10">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
                Next Steps
              </h3>
              <p className="text-gray-300 leading-relaxed">{proposal.nextSteps}</p>
            </div>
          )}

          {/* CTAs */}
          <div className="p-8 space-y-4">
            <a
              href={`mailto:?subject=Accepting your proposal&body=I'd like to accept your proposal: ${proposal.title}`}
              className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-lg transition-colors"
            >
              <CheckCircle2 className="h-5 w-5" />
              Accept Proposal
            </a>
            <a
              href={`mailto:?subject=Question about proposal&body=I have a question about: ${proposal.title}`}
              className="flex items-center justify-center gap-3 w-full py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:border-white/20 font-medium transition-colors"
            >
              <Mail className="h-4 w-4" />
              Have questions? Reach out
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-700 mt-8">
          Delivered via LaunchGrid AI
        </p>
      </div>
    </div>
  );
}
