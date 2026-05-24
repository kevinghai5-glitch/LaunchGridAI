import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/internal-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openai, DEFAULT_MODEL } from "@/lib/openai";
import { generateContentSchema } from "@/lib/validations";
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
    const parsed = generateContentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const business = await prisma.business.findFirst({
      where: { id: parsed.data.businessId, userId: session.user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const prompt = `You are an expert social media strategist creating a Content Calendar System for a local business.

Business: "${business.name}"
Industry: ${business.industry ?? "local business"}
City: ${business.city ?? "local area"}

Create a comprehensive, custom content strategy for THIS specific business. Reference their name and industry throughout.

Return ONLY valid JSON with this exact structure:
{
  "contentPillars": ["Pillar 1 name + brief description", "Pillar 2", "Pillar 3", "Pillar 4"],
  "thirtyDayPlan": [
    {"day": 1, "format": "Reel/Carousel/Static/Story", "hook": "Attention-grabbing first line", "caption": "Full caption with call to action", "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]},
    {"day": 3, "format": "format", "hook": "hook", "caption": "caption", "hashtags": ["tags"]},
    {"day": 5, "format": "format", "hook": "hook", "caption": "caption", "hashtags": ["tags"]},
    {"day": 7, "format": "format", "hook": "hook", "caption": "caption", "hashtags": ["tags"]},
    {"day": 10, "format": "format", "hook": "hook", "caption": "caption", "hashtags": ["tags"]},
    {"day": 14, "format": "format", "hook": "hook", "caption": "caption", "hashtags": ["tags"]},
    {"day": 18, "format": "format", "hook": "hook", "caption": "caption", "hashtags": ["tags"]},
    {"day": 21, "format": "format", "hook": "hook", "caption": "caption", "hashtags": ["tags"]},
    {"day": 25, "format": "format", "hook": "hook", "caption": "caption", "hashtags": ["tags"]},
    {"day": 30, "format": "format", "hook": "hook", "caption": "caption", "hashtags": ["tags"]}
  ],
  "shortFormHooks": ["Hook 1 for Reels/TikTok", "Hook 2", "Hook 3", "Hook 4", "Hook 5"],
  "localAngles": ["Local content angle 1 specific to their city", "Angle 2", "Angle 3", "Angle 4"]
}`;

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content from AI");

    const contentSystem = JSON.parse(content);

    const system = await prisma.generatedSystem.create({
      data: {
        businessId: business.id,
        userId: session.user.id,
        type: "CONTENT",
        content: contentSystem,
      },
    });

    return NextResponse.json({ system, contentSystem });
  } catch (error) {
    console.error("Generate content error:", error);
    return NextResponse.json({ error: "Failed to generate content system" }, { status: 500 });
  }
}
