// Cold-Open Audit generation engine.
//
// Produces the free, 1-page "here's what's quietly costing you customers"
// mini-report we send BEFORE pitching the full 5-file pack. It is deliberately
// short, specific, and non-salesy: 3-5 sharp findings grounded in real signals
// (PageSpeed, screenshot, scrape, reviews, competitors) plus ONE soft, editable,
// reply-driving close tied to the single highest-impact finding.
//
// The whole point is to lead with undeniable, specific value so the reply rate
// is high and the later pitch lands warm. It must never read like a templated
// blast or an AI sales pitch.

import { openai, ASSET_MODEL } from "./openai";
import { intelligenceToPromptBlock } from "./audit-intelligence";
import type { GenerationContext } from "./asset-generation";
import type { ColdAuditReport, ColdAuditFinding } from "@/types";

interface ColdAuditModelOutput {
  headline: string;
  intro: string;
  findings: ColdAuditFinding[];
  closingCta: { tiedToFinding: string; message: string };
}

const COLD_AUDIT_RULES = `STYLE & QUALITY RULES (follow strictly):
- You are a sharp growth consultant doing a quick, genuine favor — NOT a salesperson. This is a free mini-audit sent cold, before any pitch. Its only job is to be so specific and useful that the owner wants to reply.
- Every finding must be grounded in the REAL signals provided (page speed, screenshot read, website copy, reviews, competitors). Reference what you actually observed. NEVER invent metrics, reviews, or competitor names.
- Be hyper-specific to THIS business, city, and niche. If a stranger could not tell which business this was written for, it has failed.
- Lead with what's quietly costing them customers — framed as their lost bookings/calls/revenue, in plain language. No jargon (no "LCP", "CLS", "conversion rate optimization"). The owner cares about money and time, not metrics.
- Tone: warm, direct, confident, human, peer-to-peer. Like a smart friend who happens to do this for a living noticed something and shot over a quick note. No hype, no fluff, no corporate voice.
- The close is SOFT. One low-friction, reply-driving ask tied to the single biggest finding. Offer a small next step (a quick reply, a 2-line answer, a no-obligation look) — never "book a call to buy" energy. No pricing, no package, no pressure.
- BANNED: "unlock", "supercharge", "revolutionary", "game-changing", "10x", "leverage", "synergy", "I hope this email finds you well", and any obvious AI/guru filler.
- Return ONLY valid JSON matching the requested shape exactly. No commentary outside the JSON.`;

function profileBlock(ctx: GenerationContext): string {
  const b = ctx.business;
  const lines = [
    `Name: ${b.name}`,
    `Industry: ${b.industry ?? b.category ?? "local business"}`,
    `City: ${b.city ?? "their local area"}`,
    `Rating: ${b.rating ? `${b.rating}/5 from ${b.reviewCount ?? 0} reviews` : "not available"}`,
    `Website: ${b.website ?? "none on record"}`,
  ];
  let block = `BUSINESS PROFILE\n${lines.join("\n")}`;
  if (ctx.websiteText) {
    block += `\n\nLIVE WEBSITE COPY (their ACTUAL site — reference real services, offers, weak CTAs, missing trust signals):\n"""\n${ctx.websiteText.slice(0, 9000)}\n"""`;
  } else {
    block += `\n\nNo readable website copy was available — note that honestly and infer likely gaps from the niche.`;
  }
  return block;
}

// Picks the best target screenshot for embedding: prefer the target's desktop
// shot, fall back to the target's mobile, then any shot at all.
function pickTargetScreenshot(ctx: GenerationContext): string | null {
  const shots = ctx.intel.screenshots?.shots ?? [];
  if (!shots.length) return null;
  const isTarget = (label: string) => /target/i.test(label);
  const targetDesktop = shots.find((s) => isTarget(s.label) && s.viewport === "desktop");
  if (targetDesktop) return targetDesktop.imageUrl;
  const targetAny = shots.find((s) => isTarget(s.label));
  if (targetAny) return targetAny.imageUrl;
  const anyDesktop = shots.find((s) => s.viewport === "desktop");
  return (anyDesktop ?? shots[0]).imageUrl;
}

export async function generateColdAudit(
  ctx: GenerationContext
): Promise<ColdAuditReport> {
  const b = ctx.business;
  const psi = ctx.intel.performance;
  const hasPsi = Boolean(psi?.available);

  const prompt = `${COLD_AUDIT_RULES}

${profileBlock(ctx)}

AUDIT INTELLIGENCE BRIEFING (heuristically extracted from real signals — treat as ground truth where marked real, respect the labelled assumptions):
${intelligenceToPromptBlock(ctx.intel)}

TASK: Write a free, one-page COLD-OPEN AUDIT for this business — a short note you'd send before ever pitching. Find the 3-5 most specific, highest-impact things quietly costing them bookings/calls/revenue right now, grounded in the real signals above. Order them most → least impactful. Then write ONE soft close tied to the #1 finding.

${hasPsi
  ? "Real page-speed was measured for this site. If slowness or instability is a genuine issue, you may surface it as ONE finding — but translate it entirely into business consequences (people bounce before the page loads, lost mobile calls), never numbers or metric names."
  : "Page-speed was not measured for this run — do not claim anything about site speed."}

Each finding:
- title: short, specific, plain-English (e.g. "Your booking link is buried below three scrolls")
- problem: what's actually happening, referencing what you observed on their site/reviews/listing
- whyItCosts: the concrete consequence in their language (lost calls, missed bookings, customers picking a competitor)
- severity: "high" | "medium" | "low"

The intro is 1-2 warm sentences explaining why you're reaching out, with zero pitch. The headline is a short, personal hook that names the business.

The closingCta is soft: name which finding it ties to (the #1) and write a low-friction, reply-driving ask (a quick yes/no, a 2-line reply, "want me to send the quick fix?") — no pricing, no package, no call-to-buy.

Return JSON in EXACTLY this shape:
{
  "headline": "short personal hook naming the business",
  "intro": "1-2 warm sentences, no pitch",
  "findings": [
    {"title": "...", "problem": "...", "whyItCosts": "...", "severity": "high|medium|low"}
  ],
  "closingCta": {
    "tiedToFinding": "the title (or short reference) of the #1 finding this ties to",
    "message": "the soft, low-friction, reply-driving ask"
  }
}

Provide 3-5 findings, ordered most → least impactful.`;

  const response = await openai.chat.completions.create({
    model: ASSET_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });
  const content = response.choices[0].message.content;
  if (!content) throw new Error("No content from AI");
  const out = JSON.parse(content) as ColdAuditModelOutput;

  // Overlay the REAL measured performance numbers; the model never sees raw
  // metrics and must not invent them.
  let performance: ColdAuditReport["performance"];
  if (hasPsi && psi) {
    const mobile = psi.mobile;
    performance = {
      available: true,
      mobileScore: mobile?.performanceScore ?? null,
      lcpSeconds: mobile?.metrics.lcpSeconds ?? null,
      clsValue: mobile?.metrics.cls ?? null,
      readout:
        "Measured on a typical phone. Slower, less stable pages quietly cost calls and bookings before people ever see your offer.",
    };
  }

  return {
    businessName: b.name,
    city: b.city ?? "",
    industry: b.industry ?? b.category ?? "local business",
    websiteUrl: b.website ?? "",
    screenshotUrl: pickTargetScreenshot(ctx),
    headline: out.headline ?? `A quick look at ${b.name}'s site`,
    intro: out.intro ?? "",
    findings: (out.findings ?? []).slice(0, 5),
    performance,
    closingCta: out.closingCta ?? { tiedToFinding: "", message: "" },
    generatedAt: new Date().toISOString(),
    dataConfidence: ctx.intel.dataConfidence,
  };
}
