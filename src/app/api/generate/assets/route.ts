import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/internal-session";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openai, DEFAULT_MODEL } from "@/lib/openai";
import { generateAssetsSchema } from "@/lib/validations";
import { checkPlanLimit } from "@/lib/limits";
import { fetchWebsiteText } from "@/lib/website-analyzer";

export const dynamic = "force-dynamic";
// Website fetch + full asset-pack generation can take a while; give it room.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limitCheck = await checkPlanLimit(session.user.id, "generations");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Generation limit reached (${limitCheck.limit}). Upgrade to Pro for unlimited.`,
          limitReached: true,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = generateAssetsSchema.safeParse(body);
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

    // Ground the generation in the business's real public website copy when available.
    const websiteText = await fetchWebsiteText(business.website);

    const websiteContext = websiteText
      ? `\n\nThe business website contains the following copy (use it to reference their ACTUAL services, offers, tone, and to identify weak CTAs / missing trust signals / outdated positioning):\n"""\n${websiteText}\n"""`
      : `\n\nNo website copy was available. Infer likely services from the industry and category, and clearly improve weak positioning typical for this business type.`;

    const prompt = `You are a senior conversion strategist at a top local-marketing agency. Produce a complete, ready-to-deploy growth asset pack for ONE specific local business. Everything must feel custom-made for THIS business — reference their real name, city, category, and (when present) their actual services and copy. No generic fluff.

BUSINESS PROFILE
Name: ${business.name}
Industry: ${business.industry ?? "local business"}
Category: ${business.category ?? business.industry ?? "local business"}
City: ${business.city ?? "their local area"}
Rating: ${business.rating ? `${business.rating}/5 from ${business.reviewCount ?? 0} reviews` : "N/A"}
Website: ${business.website ?? "none"}
Description: ${business.description ?? "none provided"}${websiteContext}

RULES
- Be specific and modern. Improve weak CTAs, add missing trust/review infrastructure, modernize outdated messaging.
- NEVER invent fake reviews, fake stats, or fake results. Where a real proof point is needed, use bracketed placeholders exactly like [Insert real customer review], [Insert years in business], [Insert actual testimonial].
- No cringe guru/hype language. Sound like a sharp operator.

Return ONLY valid JSON matching this exact shape:
{
  "businessSummary": {
    "positioning": "1-2 sentence read on how this business currently positions itself and the core opportunity",
    "services": ["specific service 1", "service 2", "service 3"],
    "strengths": ["concrete strength 1", "strength 2"],
    "opportunities": ["specific weakness/gap to fix 1", "gap 2", "gap 3"],
    "localAngle": "how to use their city/neighborhood to win locally"
  },
  "landingPage": {
    "heroHeadline": "punchy, specific hero headline",
    "heroSubheadline": "supporting subheadline that builds credibility",
    "offer": "the offer section + positioning paragraph",
    "ctaPrimary": "primary CTA button copy",
    "ctaUrgency": "one line of honest urgency/scarcity framing (no fake countdowns)",
    "trustSignals": ["trust signal suggestion 1", "2", "3", "4"]
  },
  "leadCapture": {
    "qualificationQuestions": ["5 to 7 sharp qualification questions tailored to this business"],
    "intakeFlow": ["step 1 of the intake flow", "step 2", "step 3", "step 4"],
    "leadScoring": "concrete lead-scoring logic (what makes a lead hot vs cold for this business)",
    "thankYouPage": "thank-you page copy with the next step"
  },
  "emailSequence": [
    {"day": 1, "subject": "Day 1 welcome subject", "body": "full welcome email body", "purpose": "welcome"},
    {"day": 2, "subject": "...", "body": "...", "purpose": "authority"},
    {"day": 3, "subject": "...", "body": "...", "purpose": "proof"},
    {"day": 4, "subject": "...", "body": "...", "purpose": "problem"},
    {"day": 5, "subject": "...", "body": "...", "purpose": "authority/proof"},
    {"day": 6, "subject": "...", "body": "...", "purpose": "cta"},
    {"day": 7, "subject": "...", "body": "...", "purpose": "urgency"}
  ],
  "smsSequence": [
    {"label": "Instant confirmation", "timing": "immediately after opt-in", "message": "text message"},
    {"label": "24-hour follow-up", "timing": "+24 hours", "message": "text message"},
    {"label": "48-hour follow-up", "timing": "+48 hours", "message": "text message"},
    {"label": "No-show recovery", "timing": "after a missed appointment", "message": "text message"}
  ],
  "bookingPage": {
    "whatToExpect": ["what to expect bullet 1", "2", "3"],
    "socialProofStructure": "how to structure social proof on the booking page",
    "objectionHandling": [
      {"objection": "common objection 1", "response": "rebuttal copy"},
      {"objection": "objection 2", "response": "rebuttal copy"},
      {"objection": "objection 3", "response": "rebuttal copy"}
    ],
    "appointmentFraming": "how to frame the appointment so it feels valuable and low-risk"
  }
}`;

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.75,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("No content from AI");

    const assetPack = JSON.parse(content);

    const system = await prisma.generatedSystem.create({
      data: {
        businessId: business.id,
        userId: session.user.id,
        type: "ASSETS",
        content: assetPack,
      },
    });

    return NextResponse.json({ system, assetPack });
  } catch (error) {
    console.error("Generate assets error:", error);
    return NextResponse.json(
      { error: "Failed to generate asset pack" },
      { status: 500 }
    );
  }
}
