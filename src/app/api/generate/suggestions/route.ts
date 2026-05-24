import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/internal-session";
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
      where: { id: parsed.data.businessId, userId: session.user.id },
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

Return ONLY valid JSON with this exact structure:
{
  "painPoint": "A specific, realistic pain point this type of business likely faces (2-3 sentences, mention the business name)",
  "outreachAngle": "A compelling first-contact message angle — what problem you'd lead with and why they'd care (2-3 sentences)",
  "suggestedOffer": "A specific monthly retainer offer: what's included, what problem it solves, and a price range ($297-$797/mo)"
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
