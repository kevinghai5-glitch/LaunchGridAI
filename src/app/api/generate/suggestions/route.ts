import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openai, DEFAULT_MODEL } from "@/lib/openai";
import { generateSuggestionsSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = generateSuggestionsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const business = await prisma.business.findFirst({
      where: { id: parsed.data.businessId, userId: session.user.id, deletedAt: null },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const prompt = `You are an AI business consultant helping a digital agency owner approach local businesses.

Business: "${business.name}"
Industry: ${business.industry ?? "unknown"}
City: ${business.city ?? "unknown"}
Current Rating: ${business.rating ? `${business.rating}/5 (${business.reviewCount} reviews)` : "N/A"}
${business.address ? `Address: ${business.address}` : ""}

Generate specific, actionable outreach intelligence for this SPECIFIC business. Be direct and concrete.

THE OFFER IS FIXED — never invent a price, a package, or a price range:
- CAD $6,500 one-time: four done-for-you deliverables plus a built and branded booking page inside GoHighLevel.
- CAD $1,000/month: LeadGate AI lead qualification, ongoing management, and a monthly report.
This is NOT lead generation — no ads, no SEO, no "more leads". It converts the leads they already get. It is NOT a website build; anything said about their site is advisory only. Nothing is handed off for their team to implement — it is done for them.

Return ONLY valid JSON with this exact structure:
{
  "painPoint": "A specific, realistic pain point this type of business likely faces (2-3 sentences, mention the business name)",
  "outreachAngle": "A compelling first-contact message angle — what problem you'd lead with and why they'd care (2-3 sentences)",
  "suggestedOffer": "How the fixed offer above lands for THIS business: which of their leaks the $6,500 build closes and what the $1,000/mo keeps running. State the prices exactly as given."
}`;

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content from AI");

    const suggestions = JSON.parse(content);

    // Update the business with AI suggestions
    await prisma.business.update({
      where: { id: business.id },
      data: {
        painPoint: suggestions.painPoint,
        outreachAngle: suggestions.outreachAngle,
        suggestedOffer: suggestions.suggestedOffer,
      },
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Generate suggestions error:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
