// Cold-Open Audit generation engine.
//
// Produces the free, 1-page "here's what a scan can see from outside" document.
//
// WHAT CHANGED, AND IT CHANGES EVERYTHING ABOUT HOW THIS PROMPT IS WRITTEN
// (Phase 4). This document used to be the persuasion instrument — the thing that
// had to make the prospect want to buy. It isn't any more. The sale now runs:
// cold call → the prospect books a 15-minute Zoom → this lands in their inbox
// BEFORE the Zoom → on the Zoom it is a 2-3 MINUTE CREDIBILITY BEAT, and then the
// conversation moves inside the business, where the leaks are priced live from
// the owner's own answers.
//
// So this document's only job is to prove we looked, prove we can count, and EARN
// THE RIGHT TO ASK QUESTIONS. It is not trying to close anybody. Everything the
// model is told below follows from that: say plainly that the outside is the
// smaller half, keep every finding inside what a scan can actually see, and hand
// off to the questions rather than reaching for a close.
//
// It must never read like a templated blast or an AI sales pitch.

import { openai, ASSET_MODEL } from "./openai";
import { intelligenceToPromptBlock } from "./audit-intelligence";
import { AGENCY_NAME, SYSTEM_FRAMING } from "./brand";
import {
  enforceColdAuditLaws,
  outOfScopeHits,
  OUTSIDE_INSIDE_FRAME,
  PIVOT_QUESTIONS,
} from "./exporters/cold-audit-html";
import { statGuard, voiceLint, flatAssertionLint } from "./leak-narrative";
import type { LeakInput } from "./leak-narrative";
import type { GenerationContext } from "./asset-generation";
import type { ColdAuditReport, ColdAuditFinding, EvidenceGrade } from "@/types";

// ── PRE-SALE ONLY, AND THE COMPILER NOW ENFORCES IT ──────────────────────────
//
// The cold audit is a FREE, PRE-SALE document. Everything in it comes from a scan
// of their public pages, because at this point in the relationship the prospect
// has told us nothing — there is no intake form, no kickoff call, no numbers they
// handed over. Printing something "they told us" on a document sent to someone we
// have never spoken to is not a rough edge; it is a claim about a conversation
// that never happened.
//
// GenerationContext is the shape EVERY generator shares, and five of its fields
// carry material that can only have come from the client intake form. Until now
// the cold-audit pipeline simply never set them — correct by accident. Declaring
// them `never` makes setting one a COMPILE ERROR, so the guarantee survives the
// next person who copies a block of context-building code across from the paid
// pack. (`never` on an optional field means: absent typechecks, any value does
// not — including `intakePresent: false`, because a pre-sale document has no
// business saying anything at all about intake.)
export type PreSaleGenerationContext = GenerationContext & {
  servicesFocus?: never;
  intakePresent?: never;
  bookingToolName?: never;
  gbpManagement?: never;
  buildPriorities?: never;
};

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

/** One finding as the MODEL returns it: the four fields that get persisted, plus
 *  a pointer back to the governed leak it was written from. The pointer is a
 *  routing tag for us, never content — it is resolved and dropped before the
 *  finding is saved, so it can never reach the reader.
 *
 *  Exported alongside gradeColdAuditFindings so the grading rule can be asserted
 *  on directly, without paying for a generation. */
export interface ColdAuditModelFinding {
  title: string;
  problem: string;
  whyItCosts: string;
  severity: ColdAuditFinding["severity"];
  /** The governed leak this finding is about, named verbatim from the leak set.
   *  Optional: a drifting draft omits it and the finding falls back to matching
   *  on its own prose, then to the safe grade. */
  leak?: string;
}

interface ColdAuditModelOutput {
  headline: string;
  intro: string;
  headlineCost: string;
  findings: ColdAuditModelFinding[];
  deeperLeakQuestions: string[];
  closingCta: { tiedToFinding: string; message: string };
}

// ── Grading a finding (Phase 1) ──────────────────────────────────────────────
//
// Every finding has to carry the grade of the leak it was written from, because
// everything downstream — the HTML renderer, the public teaser, the plaintext
// copy — sees only the SAVED report and never the fired leaks. A renderer with no
// grade to read has to guess the provenance of a sentence, and it will guess
// wrong in whichever direction the prose happens to be phrased.
//
// The model writes the prose freely, so the link back to the governed leak is a
// pointer we ASK for and then RESOLVE ourselves against the fired set. A leak name
// the model invents resolves to nothing and is ignored.
//
// WHEN NOTHING RESOLVES, THE ANSWER IS "inferred", and that direction is
// deliberate. Grading something "inferred" that we did measure costs us one
// unnecessary hedge. Grading something "observed" that we did NOT measure licenses
// a flat assertion about the inside of a business we have never spoken to — the
// exact failure the grade exists to prevent. The cheap mistake is the safe one.

function normLeak(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Shared content words (>2 chars) between two strings. Same heuristic the paid
 *  pack uses to merge model prose back onto a fired leak (stampLeakAnalysis), so
 *  the free audit and the paid pack attribute prose to leaks the same way. */
function leakTokenOverlap(a: string, b: string): number {
  const bs = new Set(normLeak(b).split(" ").filter((w) => w.length > 2));
  return normLeak(a)
    .split(" ")
    .filter((w) => w.length > 2 && bs.has(w)).length;
}

/** Best governed leak for this text, or undefined when nothing clears the bar.
 *  A tie between two leaks that DISAGREE about the grade also returns undefined:
 *  picking one would be flipping a coin over how flatly the sentence may read. */
function bestGovernedMatch(
  hay: string,
  inputs: LeakInput[],
  minScore: number
): LeakInput | undefined {
  let best = 0;
  let winner: LeakInput | undefined;
  let ambiguous = false;
  for (const li of inputs) {
    const contains =
      normLeak(hay).includes(normLeak(li.name)) || normLeak(li.name).includes(normLeak(hay));
    const score = leakTokenOverlap(hay, li.name) + (contains ? 3 : 0);
    if (score < minScore) continue;
    if (score > best) {
      best = score;
      winner = li;
      ambiguous = false;
    } else if (score === best && winner && li.grade !== winner.grade) {
      ambiguous = true;
    }
  }
  return ambiguous ? undefined : winner;
}

/** Resolve a finding back to its governed leak. Two signals, strongest first:
 *    1. the model's own `leak` tag — it is copying a name straight off the
 *       numbered list we handed it, so one shared word is already meaningful;
 *    2. the finding's prose, which paraphrases heavily ("your booking link is
 *       buried below three scrolls"), so it needs TWO shared content words (or
 *       the leak's full name appearing verbatim) before it counts. A single
 *       shared word like "call" or "booking" is a coincidence, not an
 *       attribution. */
function matchGovernedLeak(
  f: ColdAuditModelFinding,
  inputs: LeakInput[]
): LeakInput | undefined {
  const tag = f.leak?.trim();
  const byTag = tag ? bestGovernedMatch(tag, inputs, 1) : undefined;
  if (byTag) return byTag;
  const prose = [f.title, f.problem, f.whyItCosts].filter(Boolean).join(" ").trim();
  return prose ? bestGovernedMatch(prose, inputs, 2) : undefined;
}

/** The grade of one finding as the model returned it. THE ONLY definition —
 *  the flat-assertion lint reads it mid-generation and the stamp below reads it
 *  on the way out, so the lint that let a sentence through and the grade saved
 *  beside that sentence can never disagree about its provenance. */
function findingGrade(
  f: ColdAuditModelFinding,
  inputs: LeakInput[] | undefined
): EvidenceGrade {
  // No governed leak set at all (the ungoverned fallback path) means there is no
  // provenance to point at, which IS "inferred" — we measured nothing we could
  // name if the owner asked us where a claim came from.
  if (!inputs?.length) return "inferred";
  return matchGovernedLeak(f, inputs)?.grade ?? "inferred";
}

/** The model's findings, cleaned into the persisted shape and STAMPED with the
 *  grade of the leak each one was written from. The `leak` tag is dropped here so
 *  it can never reach the saved JSON, the HTML, or the public teaser. */
export function gradeColdAuditFindings(
  raw: ColdAuditModelFinding[],
  inputs: LeakInput[] | undefined
): ColdAuditFinding[] {
  return raw.map((f) => ({
    title: f.title,
    problem: f.problem,
    whyItCosts: f.whyItCosts,
    severity: f.severity,
    evidenceGrade: findingGrade(f, inputs),
  }));
}

/** THE PRE-SALE GUARANTEE, CHECKED ONE LAST TIME ON THE WAY OUT.
 *
 *  Nothing is disclosed before the sale, and three separate things already make
 *  that true: detectLeaks' pre-sale input variant cannot carry intake at all
 *  (a compile error), PreSaleGenerationContext cannot carry an intake-derived
 *  field (also a compile error), and detectLeaks itself throws on a disclosed
 *  leak in pre-sale mode. So if this ever fires, the type system was defeated —
 *  an `any`, a cast, a JSON body, a hand-built report — and a free document about
 *  to go to a prospect is claiming they told us something they never told us.
 *
 *  It THROWS rather than dropping or downgrading the finding on purpose. Quietly
 *  repairing it would hide the only evidence that the guarantee was breached, and
 *  the breach is the bug worth knowing about — the bad sentence is just its
 *  symptom. */
export function assertNoDisclosedFindings(report: ColdAuditReport, at: string): void {
  const disclosed = (report.findings ?? []).filter((f) => f.evidenceGrade === "disclosed");
  if (disclosed.length === 0) return;
  throw new Error(
    `Cold audit (${at}) carries ${disclosed.length} finding(s) graded "disclosed": ` +
      `${disclosed.map((f) => `"${f.title}"`).join(", ")}. The cold audit is a PRE-SALE ` +
      `document and nothing has been disclosed yet, so this is only reachable by ` +
      `defeating the type system (a cast, an \`any\`, or a hand-built report). Find the ` +
      `caller that fed intake into the pre-sale path — do not downgrade the grade here.`
  );
}

const COLD_AUDIT_RULES = `YOU ARE a senior client-acquisition strategist running a premium engagement. Warm but direct — the expert who already sees part of the problem and is honest about which part. The reader is a skeptical, often older, NON-technical owner. This is the FREE pre-call document, NOT the paid report.

WHERE THIS DOCUMENT SITS, AND WHAT IT IS FOR: the prospect has ALREADY agreed to a 15-minute call. This is emailed to them beforehand, and on the call it gets 2-3 minutes of screen time before the conversation moves to how enquiries are actually handled inside their business. Its whole job is to prove we looked, prove we can count, and EARN THE RIGHT TO ASK QUESTIONS. IT IS NOT TRYING TO CLOSE ANYBODY. Do not write a pitch, do not build to a crescendo, do not oversell what a scan can see. A document that overclaims from outside gets contradicted the moment the owner starts answering questions, and then nothing else in it is believed.

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
- LAW 10 CTA = ONE ASK, AND IT IS THE CALL: closingCta is a single, quiet hand-off to the conversation — the questions we can only ask them. Good: "That's the half a scan can see. The other half is questions I can only ask you — that's what the call is for." THREE THINGS ARE FORBIDDEN, and the second one is the new one: (a) offering free fixes, tips or "quick wins"; (b) offering ANY SECOND WAY TO RESPOND — no "just reply to this email", no "give me a call", no "let me know", no "feel free to" — a second option is not friendlier, it is a way for them not to book; (c) a hard sell. One ask. Nothing competing with it.
- LAW 11 EVIDENCE-TIER HONESTY: any finding that rests on an INDUSTRY PATTERN rather than something you directly observed (a leak marked [tier: BENCHMARK] in the governed set) MUST lead with the cited industry rate and HEDGE the business-specific claim — you cannot see inside their operation. Shape: "when [plausible business situation], calls likely hit voicemail — and 85% of callers who reach voicemail never call back (CallRail)." Hedged verbs (likely, typically, most) for the business claim; the industry stat is the cited fact, not the business's own number. NEVER assert an internal fact you could not observe from outside (their exact response time, their real close rate, that THEY specifically miss calls). Directly-observed findings (tier OBSERVED) may be stated as fact.
- LAW 13 INVISIBLE LEAKS ARE NEVER FLAT FACTS: any leak marked [class: INVISIBLE] in the governed set happens INSIDE their operation — a cold scan cannot see it. NEVER write it as an operational fact about THEM ("you receive no follow-up", "your team doesn't return calls", "there is no reminder system", "calls go unanswered"). This is distinct from tier: even if a review lifts an invisible leak to EVIDENCED, attribute the operational claim to the review signal, not to certainty. The ONLY allowed shapes for an invisible leak are (a) a finding written as visible-absence + industry pattern + conditional ("There's no public booking path and no 'text us' option on the site — so every after-hours lead rides on the phone. In [industry], [cited pattern]. If that's how it works today, it's a quiet leak."), or (b) a question in deeperLeakQuestions. A [class: OBSERVED] leak (missing booking link, weak CTA, review counts) may be stated as fact.
- LAW 12 SYMPTOM, NOT A REDESIGN: every visible thing you name (a buried booking link, a weak hero, a slow page) is the SYMPTOM — the spot where the leak is visible — never the thing you sell. The prospect must NOT walk away thinking "they want to redesign my website." When you pivot (intro, deeperLeakQuestions, closingCta), frame these visible gaps as where a behind-the-scenes acquisition-SYSTEM problem shows up (lead response, follow-up, booking, qualification), not a cosmetic site problem. Never say or imply "redesign", "new look", "refresh", "make it pretty". The frame to leave them with: "you don't have a design problem, you have a leak problem — the page is just where you can see it dripping." (Still withhold the fix — Law 4.)
- LAW 14 THE OUTSIDE IS THE SMALLER HALF, AND THE DOCUMENT SAYS SO: the document already carries this frame, printed word-for-word near the top: "${OUTSIDE_INSIDE_FRAME.lead}" Write everything else so that sentence stays true. Never imply the scan saw the whole problem, never imply fixing what is visible fixes the business, and never claim or hint at knowledge of anything that happens after someone gets in touch. Do NOT restate the frame in your own words — it is already there; contradicting it or duplicating it in different wording is worse than leaving it alone.
- LAW 15 NEVER RECOMMEND TRAFFIC WORK OR A WEBSITE REBUILD: we fix conversion of demand that already exists. We do not sell ads, SEO, lead generation or "more leads", and WE DO NOT BUILD OR REBUILD WEBSITES. Every site finding is ADVISORY — it is where an acquisition-system leak happens to be visible, never a project we are proposing. FORBIDDEN in any field: telling them to invest in / run / try ads, PPC, SEO or lead gen; telling them to drive, generate or boost traffic, leads, visibility or rankings; telling them to redesign, rebuild, revamp, refresh or replace their website, homepage or any page. Naming a visible gap is fine. Prescribing a project is not.
${SYSTEM_FRAMING}
- SCOPE: preview only the leaks the paid product fixes (speed-to-lead, response time, qualification, follow-up, no-shows, on-page conversion/trust). Do NOT pitch lead-gen, SEO, ads, "visibility/local authority", or website work of any kind (Law 15).
- This is the pre-call document, not the report: 3-5 findings, the most damaging ONLY. Not comprehensive.
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
  ctx: PreSaleGenerationContext
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
TASK: Write the FREE one-page COLD AUDIT that is emailed to this business before their 15-minute call — the 2-3 minute credibility beat that shows what a scan can see from outside, says plainly that this is the smaller half, and hands off to the questions.${ctx.leaks ? " Write ONLY about the governed leaks above — do not introduce leaks not in that set." : ""} Find the 3-5 MOST DAMAGING things quietly costing them bookings/calls/revenue right now, grounded in the real signals above. Order them most → least impactful. Withhold every fix (Law 4). Do not try to close them (Law 10).

TWO SECTIONS ARE ALREADY WRITTEN AND YOU DO NOT WRITE THEM — the outside/inside frame near the top (Law 14) and a fixed set of six questions in the owner's own plain language, printed near the bottom:
${PIVOT_QUESTIONS.map((q) => `  · ${q.leak} — "${q.ask}"`).join("\n")}
Those six are the invisible half, and they are ASKED, not asserted. Do not answer them, do not assert any of them as a finding, and do not restate them in different words anywhere in your output.

${hasPsi
  ? "Real page-speed was measured for this site. If slowness or instability is a genuine issue, you may surface it as ONE finding — but translate it entirely into business consequences (people bounce before the page loads, lost mobile calls), explaining any number in plain language inline (Law 9). Never raw metric names."
  : "Page-speed was not measured for this run — do not claim anything about site speed."}

headline: a direct title that names the business (NOT "a quick note", not a soft hook).
intro: ONE sentence — acknowledge one REAL strength you observed, then pivot to "but here's where you're quietly losing clients" (Law 6).
headlineCost: the single prominent gut-punch tied to the #1 leak (Law 2). ${ctx.leaks?.headline?.benchmarkFrame
  ? `NAME the #1 leak ("${ctx.leaks.headline.leakName}") and state its computed benchmark-mode monthly figure EXACTLY as given here: "${ctx.leaks.headline.benchmarkFrame}". Keep the "assuming …" assumption clause and the kickoff line intact — it is a labeled industry estimate, not a claim about their real revenue.`
  : `frame it against what they already pay to earn a lead, NOT an invented monthly loss, e.g. "You already pay to get these leads — every one that hits this gap is money you spent to acquire someone who now slips away before they ever reach you." Only include a cost figure if one is supplied to you; otherwise keep it a vivid consequence. Make ZERO claims about their revenue (Law 2).`}

Each finding:
- leak: INTERNAL ROUTING TAG, never shown to the reader — the name of the governed leak this finding is about, copied VERBATIM from the leak set above. It must not appear in the title or the prose, and it must never be a name you invented. Use "" only if a finding genuinely isn't about any listed leak.
- title: short, specific, plain-English, naming WHAT is wrong (e.g. "Your booking link is buried below three scrolls") — never the fix.
- problem: what's actually happening and WHERE, referencing what you observed on their site/reviews/listing, and where it helps, the gap vs a NAMED competitor's real numbers (Law 7). Describe the problem only — NEVER tell them how to fix it, never give the rewritten copy, the tool, or the steps (Law 4). No "you should…", "add a…", "make sure to…", "simply…".
- whyItCosts: ends in a concrete cost — a spend-anchored cost only where a figure is supplied to you (industry cost-per-lead / their stated spend), else a vivid specific consequence (Law 2). Never invent a dollar amount for lost revenue, never "could lead to missed opportunities".
- severity: "high" | "medium" | "low"

deeperLeakQuestions: 2-3 pointed questions about the leaks you CAN'T measure from outside — response time, follow-up, no-shows, qualification (Law 3). WORKING MATERIAL, NOT FINAL COPY: the document prints the six fixed questions listed above instead, so these never reach the reader. They exist for one reason — they are the sanctioned place to put an invisible leak so it does not end up asserted as a finding. Questions only, never answered or solved.

closingCta: name which finding it ties to (the #1) and write the quiet hand-off to the call (Law 10), e.g. "That's the half a scan can see. The other half is questions I can only ask you — that's what the call is for." FORBIDDEN: free fixes/tips/"quick wins", a second way to respond ("reply to this email", "give me a call", "let me know"), or a hard sell.

Return JSON in EXACTLY this shape:
{
  "headline": "direct title naming the business",
  "intro": "one sentence: real strength, then pivot to the bleed",
  "headlineCost": "the spend-anchored gut-punch line (no invented revenue figures)",
  "findings": [
    {"leak": "exact name of the governed leak this finding is about (internal tag, never rendered)", "title": "...", "problem": "...", "whyItCosts": "...", "severity": "high|medium|low"}
  ],
  "deeperLeakQuestions": ["pointed question 1", "pointed question 2"],
  "closingCta": {
    "tiedToFinding": "the title (or short reference) of the #1 finding this ties to",
    "message": "the one-ask hand-off to the call"
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
8. closingCta is ONE ask and it is the call — no free fixes/tips/"quick wins", no second way to respond ("reply", "call me", "let me know", "feel free to"), no hard sell (Law 10).
9. Any finding on a [tier: BENCHMARK] leak LEADS with the cited industry rate and HEDGES the business claim (likely/typically/most); no internal fact is asserted that the outside scrape could not see (Law 11).
9b. No finding on a [class: INVISIBLE] leak states an internal behavior as flat fact ("you receive no follow-up", "calls go unanswered", "there is no reminder system"). Each is written as visible-absence + industry pattern + conditional, or moved into deeperLeakQuestions as a question (Law 13).
10. Nothing reads as a website redesign / "new look" / cosmetic refresh; every visible gap is framed as the symptom of a behind-the-scenes acquisition-system leak (Law 12).
11. NOTHING recommends ads, PPC, SEO, lead generation, "more traffic/leads/visibility/rankings", or redesigning/rebuilding any website or page. Site findings describe what is there; they never prescribe a project (Law 15).
12. Nothing claims or implies knowledge of what happens after someone contacts them, and nothing implies the scan saw the whole problem (Law 14). Every dollar figure reads as an industry estimate over a labelled assumption — never as a measurement of their business.`;

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
    // Flat-assertion lint runs only over the FINDINGS prose (+ the two lead-in
    // lines). The deeper-leak questions are the sanctioned home for invisible
    // leaks (Law 3) and the lint skips interrogatives anyway.
    //
    // GRADE-AWARE, and that is the point: the lint is only correct if it knows the
    // PROVENANCE of the prose it is reading, so the findings are no longer linted
    // as one anonymous blob. Each finding is linted with the grade of the leak it
    // was written from — hedging something we measured reads as guesswork and is
    // the thing this phase removes. The two lead-in lines belong to no single leak,
    // so they are linted with no context at all: the strict setting, and a false
    // hit there only costs one regeneration.
    const flatHitsFor = (o: ColdAuditModelOutput): string[] => {
      const lead = [o.intro, o.headlineCost].filter(Boolean).join("\n");
      const hits = lead.trim() ? flatAssertionLint(lead).hits : [];
      for (const f of o.findings ?? []) {
        const prose = [f.problem, f.whyItCosts].filter(Boolean).join("\n");
        if (!prose.trim()) continue;
        hits.push(
          ...flatAssertionLint(prose, { grade: findingGrade(f, ctx.leaks?.inputs) }).hits
        );
      }
      return hits;
    };
    // C6: the scope sweep runs here as well as at the render boundary, and the
    // difference matters. At render, a sentence recommending SEO or a rebuild can
    // only be LIFTED OUT — the renderer cannot write a replacement. Here we can
    // still ask for a better sentence, which is always the better outcome than a
    // gap where a finding used to be.
    const scopeHitsFor = (o: ColdAuditModelOutput): string[] =>
      outOfScopeHits(coldAuditText(o));

    const check = (o: ColdAuditModelOutput) => {
      const text = coldAuditText(o);
      const stat = statGuard(text, ctx.leaks!.allowedNumbers);
      const voice = voiceLint(text);
      const flatHits = flatHitsFor(o);
      const scopeHits = scopeHitsFor(o);
      return {
        ok: stat.ok && voice.ok && flatHits.length === 0 && scopeHits.length === 0,
        violations: [...stat.violations, ...voice.hits, ...flatHits, ...scopeHits],
        flatHits,
        scopeHits,
      };
    };
    const first = check(out);
    if (!first.ok) {
      const flatNote = first.flatHits.length
        ? `\n\nSPECIFICALLY: these lines assert an INVISIBLE internal behavior as flat fact — you cannot see inside their operation. Rewrite each as pattern + visible-absence + conditional (name the visible ABSENCE, cite the industry pattern, then hedge with "likely/if that's how it works today"), or move it into deeperLeakQuestions as a question: ${first.flatHits.map((h) => `"${h}"`).join(" ; ")}.`
        : "";
      const scopeNote = first.scopeHits.length
        ? `\n\nALSO: these lines recommend work we do not sell — ads, SEO, lead generation, more traffic, or rebuilding a website (Law 15). We fix conversion of demand that already exists, and we do not build websites. Rewrite each so it DESCRIBES what is visibly there and what it costs, with no project prescribed: ${first.scopeHits.map((h) => `"${h}"`).join(" ; ")}.`
        : "";
      const corrective = `${prompt}

════════ GOVERNANCE CORRECTION (your previous draft violated the rules) ════════
Your previous draft used disallowed content: ${first.violations.join(", ")}.
Rewrite it WITHOUT any of those. This is pre-intake — invent NO dollar amounts, percentages, or multipliers; anchor pain to what they already pay per lead (only figures supplied above). Remove the banned words entirely.${flatNote}${scopeNote} Return the same JSON shape.`;
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
  // The findings are graded on the way in: the grade is what every renderer reads
  // to decide how flatly a sentence may be written, and this is the only place
  // that still knows which fired leak each finding came from.
  //
  // deeperLeakQuestions is passed through and then REPLACED in there by the six
  // fixed questions in his own words (see PIVOT_QUESTIONS). The model's versions
  // did their job during generation — they are where an invisible leak goes so it
  // never becomes a finding — and the saved document asks his questions instead.
  const report = enforceColdAuditLaws({
    businessName: b.name,
    city: b.city ?? "",
    industry: b.industry ?? b.category ?? "local business",
    websiteUrl: b.website ?? "",
    screenshotUrl: pickTargetScreenshot(ctx),
    headline: out.headline ?? `Where ${b.name} is quietly losing clients`,
    intro: out.intro ?? "",
    headlineCost: out.headlineCost ?? "",
    findings: gradeColdAuditFindings((out.findings ?? []).slice(0, 5), ctx.leaks?.inputs),
    deeperLeakQuestions: (out.deeperLeakQuestions ?? []).slice(0, 3),
    performance,
    closingCta: out.closingCta ?? { tiedToFinding: "", message: "" },
    agencyName: AGENCY_NAME,
    generatedAt: new Date().toISOString(),
    dataConfidence: ctx.intel.dataConfidence,
  });

  // Last gate before this leaves the generator for a prospect's inbox.
  assertNoDisclosedFindings(report, "generation");
  return report;
}
