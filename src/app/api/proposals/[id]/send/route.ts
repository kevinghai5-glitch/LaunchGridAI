import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendProposalEmail } from "@/lib/resend";
import { sendProposalSchema } from "@/lib/validations";
import { APP_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = sendProposalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const proposal = await prisma.proposal.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: { business: true },
    });

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const proposalUrl = `${APP_URL}/p/${proposal.publicId}`;

    await sendProposalEmail({
      recipientEmail: parsed.data.recipientEmail,
      recipientName: parsed.data.recipientName,
      businessName: proposal.business.name,
      proposalTitle: proposal.title,
      proposalUrl,
      senderName: session.user.name ?? "Your LaunchGrid Partner",
      monthlyPrice: proposal.monthlyPrice,
    });

    // Mark as sent
    await prisma.proposal.update({
      where: { id: params.id },
      data: { status: "SENT" },
    });

    return NextResponse.json({ success: true, proposalUrl });
  } catch (error) {
    console.error("Send proposal error:", error);
    const message = error instanceof Error ? error.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
