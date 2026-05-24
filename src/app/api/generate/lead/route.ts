import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/internal-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openai, DEFAULT_MODEL } from "@/lib/openai";
import { generateLeadSchema } from "@/lib/validations";
import { checkPlanLimit } from "@/lib/limits";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limitCheck = await checkPlanLimit(session.user.id, "generations");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: `Generation limit reached (${limitCheck.limit}). Upgrade to Pro for unlimited.`, limitReached: true },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = generateLeadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { id: parsed.data.businessId, userId: session.user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const prompt = `You are an expert digital marketing strategist building a Lead Capture System for a local business.

Business: "${business.name}"
Industry: ${business.industry ?? "local business"}
City: ${business.city ?? "local area"}
Rating: ${business.rating ? `${business.rating}/5` : "N/A"}

Build a complete, custom lead capture system for THIS specific business. Reference the business name and industry throughout.

Return ONLY valid JSON with this exact structure:
{
  "headline": "A compelling, specific headline for their lead capture page (use business name/industry)",
  "subheadline": "Supporting sub-headline that adds credibility and urgency",
  "qualificationQuestions": ["Question 1 to qualify leads", "Question 2", "Question 3", "Question 4", "Question 5"],
  "bookingCTA": "The primary call-to-action button text and brief instruction",
  "followUpSequence": [
    {"day": 1, "channel": "email", "message": "Full follow-up message text"},
    {"day": 2, "channel": "sms", "message": "SMS follow-up text"},
    {"day": 4, "channel": "email", "message": "Full follow-up email text"},
    {"day": 7, "channel": "email", "message": "Final follow-up email text"},
    {"day": 10, "channel": "sms", "message": "Last chance SMS"}
  ],
  "offerPositioning": "How to position this business's main offer to new leads (2-3 sentences)",
  "businessStrategy": "Overall lead capture strategy advice for this specific business type (3-4 sentences)"
}`;

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content from AI");

    const leadSystem = JSON.parse(content);

    const system = await prisma.generatedSystem.create({
      data: {
        businessId: business.id,
        userId: session.user.id,
        type: "LEAD",
        content: leadSystem,
      },
    });

    return NextResponse.json({ system, leadSystem });
  } catch (error) {
    console.error("Generate lead error:", error);
    return NextResponse.json({ error: "Failed to generate lead system" }, { status: 500 });
  }
}
