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
import { AGENCY_NAME } from "./brand";
import { enforceColdAuditLaws } from "./exporters/cold-audit-html";
import { statGuard, voiceLint } from "./leak-narrative";
import type { GenerationContext } from "./asset-generation";
import type { ColdAuditReport, ColdAuditFinding } from "@/types";

// Gather the cold-audit model prose for the governance guards.
function coldAuditText(o: ColdAuditModelOutput): string {
  return [
    o.headline,
    o.intro,
    o.headlineCost,
    ...(o.findings ?? []).flatMap((f) => [f.title, f.problem, f.whyItCosts]),
    ...(o.deeperLeakQuestions ?? []),
    o.closingCta?.message,
  ]
    .filter(Boolean)
    .join("\n");
}

interface ColdAuditModelOutput {
  headline: string;
  intro: string;
  headlineCost: string;
  findings: ColdAuditFinding[];
  deeperLeakQuestions: string[];
  closingCta: { tiedToFinding: string; message: string };
}

const COLD_AUDIT_RULES = `YOU ARE a senior client-acquisition strategist running a premium engagement. This is the opening move on a live sales call: you pulled the prospect's real site and you're showing them, on screen, where they're quietly losing clients. Warm but direct — the expert who already sees the problem. The reader is a skeptical, often older, NON-technical owner. This is the FREE teaser/hook, NOT the paid report.

NON-NEGOTIABLE LAWS (follow strictly):
- LAW 1 GROUND IN REAL DATA: every finding rests on the REAL signals provided (page speed, screenshot read, website copy, reviews, real competitor names + real review counts). NEVER invent a metric, competitor, or figure.
- LAW 2 MAKE IT PAINFUL, SPEND-ANCHORED — NEVER INVENT THEIR REVENUE: this is pre-intake; you do NOT know their lead volume, customer value, or revenue, so make ZERO claims about dollars they are losing per month. Anchor the pain to what they ALREADY PAY to earn a lead — e.g. "You pay to get these leads. In your market a single lead runs [industry cost-per-lead where supplied]; every one that slips through this gap is money you already spent, gone." The "headlineCost" is the single most damaging leak framed this way — a spend-anchored gut-punch, not a fabricated monthly loss total. Only print a cost figure if it is supplied to you (industry cost-per-lead / their stated ad spend); otherwise land the finding on a vivid specific consequence. Never invent a dollar range, and never "could lead to missed opportunities."
- LAW 3 PREVIEW DEEPER LEAKS AS QUESTIONS: response time, follow-up, no-shows, and qualification CANNOT be measured from outside. Put them in deeperLeakQuestions as 2-3 pointed questions that plant the pain, e.g. "When a lead fills out your form at 8pm, how fast do they hear back? If it's hours, you're handing those clients to whoever called first." Questions only — do NOT measure or solve them.
- LAW 4 WITHHOLD THE SOLUTION: state the problem and the cost. NEVER give the fix, the rewritten copy, the tool, or the steps. That is what they pay for. Giving away fixes turns you into free help.
- LAW 5 NO TAUTOLOGIES: ban anything true of every business ("clients look for social proof", "a clear CTA drives action"). Every line is specific to THIS business using its real data and named competitors' real numbers.
- LAW 6 VOICE: brief on praise — ONE honest line acknowledging a real strength, then pivot fast to the bleed. Confident about what you measured, no hype, no emoji, short sentences. No "quick wins", "opportunities to optimize", "boost your visibility".
- LAW 7 FRAME AGAINST REAL COMPETITORS: use the actual scraped competitors and their actual numbers ("16 reviews vs. Powell's 300+"). The gap against a named local rival creates urgency.
- LAW 8 LABEL ASSUMPTIONS: if lead volume or customer value isn't from real data, label it plainly ("assuming ~X leads/mo — we'll confirm your real numbers"). Never present an assumption as a measured fact.
- LAW 9 PLAIN LANGUAGE: the reader is non-technical. Explain any jargon inline in one short plain clause the FIRST time it appears (e.g. "your mobile page takes 4.5 seconds to load — slow enough that many people leave before they see you").
- LAW 10 CTA = PIVOT TO THE OFFER, NEVER FREEBIES: closingCta opens the door to the paid engagement, not more free help. Good: "This is a fraction of what I found — want me to walk you through everything that's leaking and what fixing it looks like?" FORBIDDEN: offering to send free fixes, tips, or "quick wins".
- LAW 11 EVIDENCE-TIER HONESTY: any finding that rests on an INDUSTRY PATTERN rather than something you directly observed (a leak marked [tier: BENCHMARK] in the governed set) MUST lead with the cited industry rate and HEDGE the business-specific claim — you cannot see inside their operation. Shape: "when [plausible business situation], calls likely hit voicemail — and 85% of callers who reach voicemail never call back (CallRail)." Hedged verbs (likely, typically, most) for the business claim; the industry stat is the cited fact, not the business's own number. NEVER assert an internal fact you could not observe from outside (their exact response time, their real close rate, that THEY specifically miss calls). Directly-observed findings (tier OBSERVED) may be stated as fact.
- SCOPE: preview only the leaks the paid product fixes (speed-to-lead, response time, qualification, follow-up, no-shows, on-page conversion/trust). Do NOT pitch lead-gen, SEO, ads, or "visibility/local authority".
- This is the teaser, not the report: 3-5 findings, the most damaging ONLY. Not comprehensive.
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

  const leakBlock = ctx.leaks
    ? `\n════════ GOVERNED LEAK SET — write ONLY about these leaks (the 3 most provable) ════════\n${ctx.leaks.promptBlock}\n`
    : "";

  const prompt = `${COLD_AUDIT_RULES}

${profileBlock(ctx)}

AUDIT INTELLIGENCE BRIEFING (heuristically extracted from real signals — treat as ground truth where marked real, respect the labelled assumptions):
${intelligenceToPromptBlock(ctx.intel)}
${leakBlock}
TASK: Write the FREE one-page COLD AUDIT shown live on a sales call for this business — the hook that makes the hidden conversion leaks visible, painful, and spend-anchored, then pivots to the paid engagement.${ctx.leaks ? " Write ONLY about the governed leaks above — do not introduce leaks not in that set." : ""} Find the 3-5 MOST DAMAGING things quietly costing them bookings/calls/revenue right now, grounded in the real signals above. Order them most → least impactful. Withhold every fix (Law 4).

${hasPsi
  ? "Real page-speed was measured for this site. If slowness or instability is a genuine issue, you may surface it as ONE finding — but translate it entirely into business consequences (people bounce before the page loads, lost mobile calls), explaining any number in plain language inline (Law 9). Never raw metric names."
  : "Page-speed was not measured for this run — do not claim anything about site speed."}

headline: a direct title that names the business (NOT "a quick note", not a soft hook).
intro: ONE sentence — acknowledge one REAL strength you observed, then pivot to "but here's where you're quietly losing clients" (Law 6).
headlineCost: the single prominent gut-punch tied to the #1 leak (Law 2). ${ctx.leaks?.headline?.benchmarkFrame
  ? `NAME the #1 leak ("${ctx.leaks.headline.leakName}") and state its computed benchmark-mode monthly figure EXACTLY as given here: "${ctx.leaks.headline.benchmarkFrame}". Keep the "assuming …" assumption clause and the kickoff line intact — it is a labeled industry estimate, not a claim about their real revenue.`
  : `frame it against what they already pay to earn a lead, NOT an invented monthly loss, e.g. "You already pay to get these leads — every one that hits this gap is money you spent to acquire someone who now slips away before they ever reach you." Only include a cost figure if one is supplied to you; otherwise keep it a vivid consequence. Make ZERO claims about their revenue (Law 2).`}

Each finding:
- title: short, specific, plain-English, naming WHAT is wrong (e.g. "Your booking link is buried below three scrolls") — never the fix.
- problem: what's actually happening and WHERE, referencing what you observed on their site/reviews/listing, and where it helps, the gap vs a NAMED competitor's real numbers (Law 7). Describe the problem only — NEVER tell them how to fix it, never give the rewritten copy, the tool, or the steps (Law 4). No "you should…", "add a…", "make sure to…", "simply…".
- whyItCosts: ends in a concrete cost — a spend-anchored cost only where a figure is supplied to you (industry cost-per-lead / their stated spend), else a vivid specific consequence (Law 2). Never invent a dollar amount for lost revenue, never "could lead to missed opportunities".
- severity: "high" | "medium" | "low"

deeperLeakQuestions: 2-3 pointed questions about the leaks you CAN'T measure from outside — response time, follow-up, no-shows, qualification (Law 3). Each must probe a DISTINCT leak — never two questions on the same topic. Each plants the pain and previews what the paid offer fixes. Make ONE of them the pipeline question: "How many inquiries came in last month — and how many actually became clients?" (the inquiry→client gap is where the money hides). Questions only — never answer or solve them.

closingCta: name which finding it ties to (the #1) and write the PIVOT to the paid engagement (Law 10), e.g. "This is a fraction of what I found — want me to walk you through everything that's leaking and what fixing it looks like?" FORBIDDEN: offering free fixes, tips, or "quick wins".

Return JSON in EXACTLY this shape:
{
  "headline": "direct title naming the business",
  "intro": "one sentence: real strength, then pivot to the bleed",
  "headlineCost": "the spend-anchored gut-punch line (no invented revenue figures)",
  "findings": [
    {"title": "...", "problem": "...", "whyItCosts": "...", "severity": "high|medium|low"}
  ],
  "deeperLeakQuestions": ["pointed question 1", "pointed question 2"],
  "closingCta": {
    "tiedToFinding": "the title (or short reference) of the #1 finding this ties to",
    "message": "the pivot-to-paid ask"
  }
}

Provide 3-5 findings, ordered most → least impactful, and 2-3 deeper-leak questions.

SELF-CHECK before returning (fix anything that fails):
1. intro acknowledges ONE real strength, then pivots to the bleed — no "quick wins/boost visibility" softening (Law 6).
2. headlineCost is a spend-anchored gut-punch with NO invented revenue figure; every finding ends in a spend-anchored cost or a vivid consequence (Law 2).
3. NO finding gives away a fix, rewritten copy, tool, or how-to (Law 4).
4. deeperLeakQuestions are QUESTIONS about response time / follow-up / no-shows — never measured or solved (Law 3).
5. No tautologies; no lead-gen / SEO / "visibility" content; conversion leaks only.
6. Competitors named with real numbers; assumptions labeled (Laws 7, 8).
7. Any jargon explained inline in plain language (Law 9).
8. closingCta PIVOTS to the paid engagement — it does NOT offer free fixes, tips, "quick wins", or to "send/share" anything (Law 10).
9. Any finding on a [tier: BENCHMARK] leak LEADS with the cited industry rate and HEDGES the business claim (likely/typically/most); no internal fact is asserted that the outside scrape could not see (Law 11).`;

  const response = await openai.chat.completions.create({
    model: ASSET_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });
  const content = response.choices[0].message.content;
  if (!content) throw new Error("No content from AI");
  let out = JSON.parse(content) as ColdAuditModelOutput;

  // Governance boundary: scan the teaser prose for numbers outside the allowed
  // set (stat guard, decision 4) and banned voice tics, and regenerate ONCE with
  // a corrective addendum if it strays. Only runs when leak context is present.
  if (ctx.leaks) {
    const check = (o: ColdAuditModelOutput) => {
      const text = coldAuditText(o);
      const stat = statGuard(text, ctx.leaks!.allowedNumbers);
      const voice = voiceLint(text);
      return { ok: stat.ok && voice.ok, violations: [...stat.violations, ...voice.hits] };
    };
    const first = check(out);
    if (!first.ok) {
      const corrective = `${prompt}

════════ GOVERNANCE CORRECTION (your previous draft violated the rules) ════════
Your previous draft used disallowed content: ${first.violations.join(", ")}.
Rewrite it WITHOUT any of those. This is pre-intake — invent NO dollar amounts, percentages, or multipliers; anchor pain to what they already pay per lead (only figures supplied above). Remove the banned words entirely. Return the same JSON shape.`;
      const retryRes = await openai.chat.completions.create({
        model: ASSET_MODEL,
        messages: [{ role: "user", content: corrective }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });
      const retryContent = retryRes.choices[0].message.content;
      if (retryContent) {
        const retry = JSON.parse(retryContent) as ColdAuditModelOutput;
        if (check(retry).violations.length <= first.violations.length) out = retry;
      }
    }
  }

  // Part H1: hard-guarantee the headline-cost names the #1 leak and shows its
  // computed benchmark-mode monthly figure. The frame is pre-governed (its numbers
  // are in allowedNumbers), so it is safe to set deterministically here even if the
  // model drifted. Only overrides when the #1 leak actually has a computable figure.
  if (ctx.leaks?.headline?.benchmarkFrame) {
    const { leakName, benchmarkFrame } = ctx.leaks.headline;
    out.headlineCost = `${leakName}: ${benchmarkFrame}`;
  }

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

  // Hard-enforce the laws on the model output before it is ever persisted, so
  // saved JSON, the HTML deliverable, and the plaintext copy are all compliant.
  return enforceColdAuditLaws({
    businessName: b.name,
    city: b.city ?? "",
    industry: b.industry ?? b.category ?? "local business",
    websiteUrl: b.website ?? "",
    screenshotUrl: pickTargetScreenshot(ctx),
    headline: out.headline ?? `Where ${b.name} is quietly losing clients`,
    intro: out.intro ?? "",
    headlineCost: out.headlineCost ?? "",
    findings: (out.findings ?? []).slice(0, 5),
    deeperLeakQuestions: (out.deeperLeakQuestions ?? []).slice(0, 3),
    performance,
    closingCta: out.closingCta ?? { tiedToFinding: "", message: "" },
    agencyName: AGENCY_NAME,
    generatedAt: new Date().toISOString(),
    dataConfidence: ctx.intel.dataConfidence,
  });
}
