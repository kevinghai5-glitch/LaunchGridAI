import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/internal-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openai, DEFAULT_MODEL } from "@/lib/openai";
import { generateProposalSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = generateProposalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { id: parsed.data.businessId, userId: session.user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { monthlyPrice, systemsIncluded } = parsed.data;
    const systemsText = systemsIncluded.length > 0
      ? `Systems included: ${systemsIncluded.join(", ")}`
      : "General AI systems package";

    const prompt = `You are a professional digital agency proposal writer.

Client Business: "${business.name}"
Industry: ${business.industry ?? "local business"}
City: ${business.city ?? "local area"}
Monthly Price: $${monthlyPrice}/month
${systemsText}

Write a compelling, professional proposal for this SPECIFIC business. Use their name throughout.

Return ONLY valid JSON with this exact structure:
{
  "title": "Proposal title (e.g., 'AI-Powered Growth System for [Business Name]')",
  "packageOverview": "2-3 sentence overview of what you're offering and why it matters for this specific business",
  "deliverables": [
    "Specific deliverable 1",
    "Specific deliverable 2",
    "Specific deliverable 3",
    "Specific deliverable 4",
    "Specific deliverable 5"
  ],
  "monthlyPrice": ${monthlyPrice},
  "benefits": [
    "Benefit 1 with specific outcome",
    "Benefit 2",
    "Benefit 3",
    "Benefit 4"
  ],
  "nextSteps": "Clear next steps for the business owner to move forward (2-3 sentences)",
  "emailMessage": "A professional, friendly email message to send with this proposal (3-4 sentences, personalized to the business)"
}`;

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content from AI");

    const proposalData = JSON.parse(content);

    return NextResponse.json({ proposalData });
  } catch (error) {
    console.error("Generate proposal error:", error);
    return NextResponse.json({ error: "Failed to generate proposal" }, { status: 500 });
  }
}
