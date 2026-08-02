export interface BusinessResult {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  userRatingsTotal: number;
  mapsUrl: string;
  category: string;
  description: string;
  photoUrl: string;
  location: {
    lat: number;
    lng: number;
  };
}

export interface SavedBusiness {
  id: string;
  userId: string;
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  industry: string | null;
  city: string | null;
  category: string | null;
  description: string | null;
  photoUrl: string | null;
  favorited: boolean;
  painPoint: string | null;
  outreachAngle: string | null;
  suggestedOffer: string | null;
  status: string;
  createdAt: string;
}

export interface LeadSystem {
  headline: string;
  subheadline: string;
  qualificationQuestions: string[];
  bookingCTA: string;
  followUpSequence: {
    day: number;
    channel: "email" | "sms";
    message: string;
  }[];
  offerPositioning: string;
  businessStrategy: string;
}

export interface ContentSystem {
  contentPillars: string[];
  thirtyDayPlan: {
    day: number;
    format: string;
    hook: string;
    caption: string;
    hashtags: string[];
  }[];
  shortFormHooks: string[];
  localAngles: string[];
}

// ── Growth Asset Pack ─────────────────────────────────────────────────────────
// The premium, agency-grade Client Acquisition Infrastructure Pack. Organized
// into exactly 5 client-facing deliverables (file1..file5) plus generation meta.

export type DataConfidence = "high" | "medium" | "low";

export interface RevenueLeak {
  issue: string;
  whyItMatters: string;
  impact: number; // /10
  urgency: number; // /10
  difficulty: number; // /10
  recommendedFix: string;
  expectedImpact: string;
}

export interface Testimonial {
  name: string;
  location: string;
  quote: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ProcessStep {
  step: string;
  description: string;
}

export interface ObjectionHandling {
  objection: string;
  response: string;
}

// Real-measured technical UX / performance summary. The narrative is generated
// by the model from the PageSpeed numbers but translated into business impact —
// never raw Lighthouse jargon.
export interface TechnicalUxSection {
  available: boolean;
  mobile: {
    score: number | null;
    lcpSeconds: number | null;
    cls: number | null;
    inpMs: number | null;
  } | null;
  desktop: {
    score: number | null;
    lcpSeconds: number | null;
    cls: number | null;
    inpMs: number | null;
  } | null;
  businessImpactSummary: string; // model-written, plain-English business read
  topFixes: { fix: string; businessImpact: string }[];
}

// Above-the-fold screenshots embedded into the audit deliverable.
export interface VisualIntelligenceShot {
  imageUrl: string;
  label: string;
  viewport: "desktop" | "mobile";
}

export interface VisualIntelligence {
  available: boolean;
  shots: VisualIntelligenceShot[];
  competitiveRead: string; // model-written read on what the visual comparison tells the buyer
}

// Shared 4-section framing wrapper applied to every deliverable so each one
// reads as: Overview → Implementation Guide → (Actual Deliverable) → Expected
// Impact. Optional so packs generated before this upgrade still render cleanly.
export interface DeliverableFraming {
  overview: string; // what this deliverable is + why it matters for THIS business
  implementationGuide: string[]; // ordered, plain-English steps to deploy/use it
  expectedImpact: string; // the realistic business outcome to expect once live
}

// FILE 1 — landing-page-growth-audit.html
export interface GrowthAuditFile {
  framing?: DeliverableFraming;
  executiveSummary: string;
  growthAudit: {
    overview: string;
    findings: { area: string; finding: string; severity: "high" | "medium" | "low" }[];
  };
  technicalUx?: TechnicalUxSection;
  visuals?: VisualIntelligence;
  revenueLeaks: RevenueLeak[]; // top 5
  conversionBottlenecks: { stage: string; problem: string; fix: string }[];
  localMarketIntelligence: {
    customerPsychology: string;
    buyingBehavior: string;
    trustExpectations: string;
    competitiveSaturation: string;
    seasonalDemand: string;
    priceSensitivity: string;
    credibilityMarkers: string;
  };
  competitorPositioning: {
    commonWeakMessaging: string[];
    overusedClaims: string[];
    trustGapsIgnored: string[];
    opportunitiesToStandOut: string[];
    recommendedAngle: string;
  };
  trustGapAnalysis: { gap: string; impact: string; fix: string }[];
  fastestWins: string[];
  positioningStrategy: string;
  // ── NO LONGER GENERATED · the page copy moved to ConversionSurfaces ───────
  // This was a full landing page: hero, problem, solution, offer, benefits,
  // testimonials, FAQ, urgency block, final CTA. We do not build landing pages.
  // Every one of those slots now has a real destination — the GoHighLevel
  // booking page, the lead-capture form, the webchat — and is written by
  // generateConversionSurfaces() addressed to that destination.
  //
  // Two of the old slots were worse than merely homeless. `testimonials` was
  // hinted "believable local name" / "specific, believable outcome": fabricated
  // proof, a fatal validator failure, and the single thing most likely to end an
  // engagement if a client recognised a made-up neighbour. `urgencyBlock`
  // invited invented urgency for the same reason `urgencyStrategy` below did.
  //
  // OPTIONAL, NOT DELETED. Every pack saved before this change carries a
  // populated landingPage, those rows are never deleted, and the D3 renderer
  // still reads this shape for them — so a document generated last month keeps
  // rendering exactly as it did the day it was made.
  landingPage?: {
    heroHeadline: string;
    heroSubheadline: string;
    ctaBlock: string;
    problemSection: string;
    solutionSection: string;
    offerSection: string;
    threeStepProcess: ProcessStep[];
    benefits: string[];
    trustSection: string;
    testimonials?: Testimonial[];
    faq: FaqItem[];
    urgencyBlock?: string;
    finalCta: string;
  };
  // ── DEAD WEBSITE FIELDS · no longer generated (see asset-generation.ts) ────
  // ReclaimedHQ does not build, rebuild, host or deploy websites — site findings
  // are ADVISORY and the one page we build is the booking page inside the
  // client's GoHighLevel sub-account. These five slots all described work
  // outside that boundary (a page structure for a page we do not build, a
  // deployment guide for a page we never deploy, a tool to build it with) or
  // invited banned content (invented urgency). None of them was ever rendered
  // into a client-facing document.
  //
  // They are OPTIONAL rather than deleted for one reason: every pack already
  // saved carries them, and scripts/make-golden-sample.ts still writes them.
  // Deleting the keys outright would break the fixture builder's typecheck in a
  // file this change does not own. The deletion is a one-line follow-up once
  // the fixture is regenerated — see the handoff note.
  landingStructure?: string[];
  ctaStrategy: string;
  socialProofRecommendations?: string[];
  urgencyStrategy?: string;
  /** @deprecated "how to deploy this page" — we deploy no page but the booking
   *  page, which is built inside GoHighLevel, not deployed from a spec. */
  implementationNotes?: string;
  /** @deprecated Naming a site-builder (the hint was literally "e.g. Framer")
   *  implies a website build is in scope. It is not, and it is not something we
   *  advise on either. */
  techStack?: { tool: string; purpose: string }[];
  trackingAnalytics: string[];
  loomTalkingPoints: string[];
  beforeAfterAngles: { before: string; after: string }[];
  salesEnablement: {
    coldOutreachAngle: string;
    personalizedOpener: string;
    loomScriptBullets: string[];
    proposalPositioning: string;
    discoveryCallPoints: string[];
    objectionHandling: ObjectionHandling[];
  };
}

// FILE 2 — lead-qualification-system.pdf
export interface LeadQualificationFile {
  framing?: DeliverableFraming;
  formHeadline: string;
  formSubheadline: string;
  questions: {
    question: string;
    inputType: string;
    options: string[];
    purpose: string;
    scoringImpact: string;
  }[]; // 7
  leadScoring: {
    rubric: string;
    hot: string;
    warm: string;
    cold: string;
  };
  routingLogic: { tier: string; action: string; timing: string }[];
  automationWorkflow: string[];
  thankYouPage: string;
  crmFields: string[];
  followUpTiming: string;
  implementation: string[];
}

// ── The 60-day nurture sequence, as one workflow ─────────────────────────────
// File 3 (the emails) and file 4 (the texts) are NOT two sequences. They are the
// two halves of ONE workflow in the build — "Lead Nurture — No Booking",
// workflow 8 in src/lib/workflow-catalogue.ts: 60 days, 7 emails and 6 texts
// interleaved, ending by moving the deal to Lost so the pipeline shows what is
// real.
//
// WHY THE STEP NUMBER MATTERS MORE THAN IT LOOKS. The operator building this
// inside GoHighLevel is pasting thirteen strings into thirteen boxes on one
// canvas. If the documents say "email 3" and "text 4" with no shared numbering,
// he has to work out which message goes where — and the sequence he builds stops
// matching the one we wrote. `step` is the position in the 13-step workflow;
// `day` is the wait before it fires. Both are STAMPED deterministically from
// NURTURE_SEQUENCE in asset-generation.ts, never authored by the model.
export interface NurtureSequenceMeta {
  /** Stable id of the workflow in workflow-catalogue.ts. */
  workflowId: string;
  workflowName: string;
  /** Where this half of the sequence is installed. Stamped — and load-bearing:
   *  the D3 rule is that no asset may reach the operator without naming the
   *  surface it goes on, and a sequence of thirteen messages with no destination
   *  is the worst version of that. */
  where: string;
  lengthDays: number; // 60
  totalSteps: number; // 13
  emailCount: number; // 7
  textCount: number; // 6
  /** What happens when the 60 days run out, in one sentence. */
  endsBy: string;
}

// FILE 3 — the EMAIL half of the 60-day nurture workflow.
export interface EmailNurtureFile {
  framing?: DeliverableFraming;
  /** Which workflow these emails belong to. Stamped, optional for old packs. */
  sequence?: NurtureSequenceMeta;
  emails: {
    /** Position in the full 13-step workflow (emails + texts). Stamped. */
    step?: number;
    day: number;
    timing: string;
    subject: string;
    subjectB: string;
    previewText: string;
    body: string;
    cta: string;
    purpose: string;
    /** GoHighLevel merge fields used in this email, e.g.
     *  "{{contact.first_name}}". Listed so the operator can confirm each one
     *  resolves before switching the workflow on. */
    mergeFields?: string[];
  }[]; // 7
}

// FILE 4 — the TEXT half of the same 60-day nurture workflow.
export interface SmsFollowUpFile {
  framing?: DeliverableFraming;
  sequence?: NurtureSequenceMeta;
  messages: {
    /** Position in the full 13-step workflow (emails + texts). Stamped. */
    step?: number;
    /** Text number 1–6 within the text half. */
    order: number;
    /** Day the text fires, counted from the lead entering the sequence. */
    day?: number;
    timing: string;
    message: string;
    charCount: number;
    psychology: string;
    replyStrategy: string;
    mergeFields?: string[];
  }[]; // 6
}

// FILE 5 — booking-appointment-system.html
export interface BookingSystemFile {
  framing?: DeliverableFraming;
  /** Where these assets are installed. Stamped. */
  where?: string;
  /** The show-up framing shown on the confirmation and carried through the
   *  reminders — NOT the booking page hero, which lives on
   *  ConversionSurfaces.bookingPage. Two sets of booking-page headlines in one
   *  document is two sets that contradict each other. */
  headline: string;
  subheadline: string;
  whatToExpect: string[];
  threeStepBreakdown: ProcessStep[];
  appointmentPositioning: string;
  microSocialProof: string[];
  confirmationEmail: { subject: string; body: string };
  reminderEmail24h: { subject: string; body: string };
  dayOfReminderSms: string;
  noShowRecoveryEmail: { subject: string; body: string };
  noShowRecoverySms1: string;
  noShowRecoverySms2: string;
  rescheduleFraming: string;
  showUpQualityNotes: string;
  implementation: string[];
}

export interface AssetPackMeta {
  businessName: string;
  city: string;
  industry: string;
  generatedAt: string;
  dataConfidence: DataConfidence;
  assumptions: string[];
  // TRUE when the pack was generated with NO client intake at all (the pure
  // pre-intake TESTING path). Drives an unmissable "INTERNAL TEST — generated
  // without client intake" marker on every document cover. Undefined on packs
  // built before this flag existed → no marker (they render as before). The only
  // way to clear it is to regenerate with intake present, never a toggle.
  internalTest?: boolean;
  // Real-data signal flags so the deliverable can surface "what was measured"
  // honestly to the buyer.
  signals?: {
    websiteScraped: boolean;
    reviewsAnalyzed: boolean;
    competitorsAnalyzed: boolean;
    performanceMeasured: boolean;
    gbpProfilePulled: boolean;
    screenshotsCaptured: boolean;
    verifiedFactsExtracted: boolean;
  };
}

// ── V2 strategic components ───────────────────────────────────────────────────
// The premium repositioning composes the underlying file1..file5 content PLUS
// these strategic components into FOUR client-facing flagship deliverables:
//   1. Growth Leak Intelligence Report   (diagnosis)
//   2. Client Acquisition Infrastructure Blueprint (architecture)
//   3. Conversion Asset Pack             (supporting assets)
//   4. 90-Day Growth Execution Roadmap   (execution guidance)
// All fields are optional so packs generated before V2 still type-check and
// render (the renderers fall back to the underlying file content).

export type Difficulty = "low" | "medium" | "high";
export type Priority = "critical" | "high" | "medium" | "low";

// Who implements a given fix/stage/task. Done-for-you framing (Law 3): the
// provider deploys everything except genuine human-judgment steps.
export type DeployOwner = "us" | "you";

// A conservative, transparent revenue-impact estimate attached to every leak
// (Law 5). The math is always shown; assumptions are stated; when the customer
// value is an industry benchmark rather than the business's real number,
// usesBenchmarkValue is true so the renderer can flag it.
export interface DollarImpact {
  leadVolumeBasis: string; // e.g. "~40 inbound leads/mo (estimated from review velocity)"
  effectSize: string; // e.g. "12–18% of conversions lost to >1hr response time"
  avgValueBasis: string; // e.g. "~$3,500 avg case value (industry benchmark for personal-injury law)"
  monthlyLow: number; // conservative low end, whole dollars
  monthlyHigh: number; // conservative high end, whole dollars
  formula: string; // the visible math, e.g. "40 leads × 15% × $3,500 = $21,000/mo"
  usesBenchmarkValue: boolean; // true when avg value is a benchmark, not their real number
}

// One Conversion Leak Scorecard metric (score out of 100). Every score carries
// its rubric and the specific real evidence behind it (Law 6).
export interface ScorecardMetric {
  name: string;
  score: number; // 0-100
  rubric: string; // what it measures and relative to what — so the number is defensible
  evidence: string; // the specific real data behind the score
  diagnosis: string;
  whyItMatters: string;
  cause: string; // what's causing the score
  expectedBenefit: string; // benefit if improved
}

export interface GrowthLeakScorecard {
  overallReadout: string;
  metrics: ScorecardMetric[]; // the 9 conversion-axis scores (taxonomy scorecard areas)
}

// A single conversion-leak finding in the deep analysis (Deliverable 1). Every
// leak carries a dollar impact (Law 5) and who deploys the fix (Law 3).
export interface LeakAnalysisItem {
  area: string; // conversion-path leaks only: speed-to-lead, qualification, follow-up, booking, no-show, on-page CTA/trust/form/mobile
  evidence: string;
  explanation: string; // strategic explanation
  businessImpact: string;
  // Optional: pre-intake BENCHMARK leaks make no client-revenue claim, so they
  // carry a stamped `mathFrame` + cited stats instead of a structured figure.
  dollarImpact?: DollarImpact; // estimated monthly revenue lost, with visible math
  difficulty: Difficulty;
  priority: Priority;
  recommendedFix: string;
  owner: DeployOwner; // who deploys the fix — almost always "us"
  // Evidence tier of the governed leak (Part C1). Drives the evidence label:
  // OBSERVED → "What we observed", EVIDENCED → "Signal in your reviews",
  // BENCHMARK → "Industry pattern". An industry stat must never sit under an
  // observed/evidence label. Optional for back-compat with pre-C1 packs.
  evidenceTier?: "OBSERVED" | "EVIDENCED" | "BENCHMARK";
  // ── Phase 1 · EVIDENCE GRADE — the honesty gate that drives VOICE ────────────
  // Three grades of knowledge, derived deterministically from the tier and the
  // intake confirmation (see gradeOf in leak-taxonomy.ts). `evidenceTier` above
  // says HOW a detection fired; this says WHAT GRADE OF KNOWLEDGE the claim rests
  // on, which is the thing that decides whether a sentence may be stated flatly:
  //   observed  — we measured it. Declarative, cite the measurement.
  //   disclosed — the client told us. Declarative but ATTRIBUTED ("you told us"),
  //               never dressed up as something we detected.
  //   inferred  — neither measured nor disclosed. Hedged, and labelled a pattern.
  // Optional for back-compat with pre-Phase-1 packs, which are treated as inferred
  // (the safe default: a missing grade must never license a flat assertion).
  evidenceGrade?: EvidenceGrade;

  // ── Part I · deterministic leak stamping ────────────────────────────────────
  // Stamped at generation time from the FIRED taxonomy leak (never trusted from
  // the model), so the renderer emits leak identity, whitelisted stats, computed
  // math, and the kickoff line deterministically. All optional for back-compat.
  leakName?: string; // the taxonomy leak name — the section TITLE (Defect 2)
  scorecardArea?: string; // client-facing axis label this leak belongs to (Defect 2)
  allowedStats?: string[]; // whitelisted stat phrases WITH inline citations (Defect 1)
  mathFrame?: string; // pre-computed, labeled benchmark/real dollar math (Defect 1)
  industryPattern?: string; // BENCHMARK-slot body: the pattern via stat/softFraming (Defect 4)
  kickoffLine?: string; // BENCHMARK kickoff-verification line, verbatim (Defect 3)
  // The client confirmed at intake they lack this system → render as fact
  // ("Confirmed at intake" label, no kickoff line). Absent = benchmark hedge.
  intakeConfirmed?: boolean;
  // Whether the taxonomy offered this leak a quantification path (whitelisted
  // stats and/or a math template). Some leaks (e.g. CRM pipeline, call-tracking)
  // are qualitative BY DESIGN — no statIds, no mathTemplate — so Law 5 must not
  // demand a dollar figure from them. Stamped from the fired taxonomy leak.
  quantifiable?: boolean;
  // ── Overlap (A2) · this leak's figure is a SLICE of another leak's, not a
  // second loss on top of it. After-hours is the worked example: it is a share of
  // the missed-call chain. Present ⇒ reconcileLeakTotal EXCLUDES this leak from
  // every total, and the note is rendered beside its own figure so the reader is
  // told why the itemized figures don't add up to the headline.
  overlapsWith?: string; // taxonomy leak id whose figure this one is a slice of
  overlapNote?: string; // the plain-English sentence rendered beside the figure
}

export interface RankedWin {
  opportunity: string;
  impact: string;
  difficulty: Difficulty;
  speed: string; // how fast it can be done
}

export interface ExecutiveSummary {
  narrative: string;
  biggestOpportunities: string[];
  biggestThreats: string[];
  mostUrgentFixes: string[];
  quickWins: string[];
  /** WHAT IS ALREADY FINE — one plain line per scorecard axis where no leak
   *  fired. A report that lists only problems reads as a sales document, and an
   *  owner who knows his booking flow is solid stops believing the parts he
   *  cannot check. Saying "this one holds up" out loud is what makes the rest
   *  credible. Optional for packs generated before this existed; when the model
   *  leaves it empty, asset-generation stamps one line per clean axis. */
  whatHoldsUp?: string[];
}

// Deliverable 1's strategic intelligence layer (composed with file1 content).
export interface GrowthIntelligence {
  executiveSummary: ExecutiveSummary;
  scorecard: GrowthLeakScorecard;
  leakAnalysis: LeakAnalysisItem[];
  fastestWins: RankedWin[];
  strategicRecommendations: string[];
}

// One stage of the conversion-path funnel. Conversion-only scope (Law 2):
// Capture → Qualify (LeadGate) → Speed-to-Lead → Nurture → Book → Show-Up &
// No-Show Recovery. The Qualify stage is the continuously-running retainer.
export interface FunnelStage {
  stage: string;
  role: string;
  currentWeakness: string;
  whatWeDeploy: string; // done-for-you framing — what gets built/installed
  owner: DeployOwner; // "us" for everything built; "you" only for human steps
  isRetainer: boolean; // true for the LeadGate qualification stage (ongoing)
  kpi: string;
}

export interface AcquisitionFunnel {
  overview: string;
  stages: FunnelStage[]; // 6 conversion-path stages
}

// One stage of the CRM / pipeline blueprint.
export interface CrmStage {
  stage: string;
  entryCriteria: string;
  exitCriteria: string;
  ownership: string;
  reviewProcess: string;
}

export interface LeadTier {
  tier: string; // "Priority Lead", "Qualified Lead", "Nurture Lead", "Low Fit Lead"
  range: string; // "90–100"
  meaning: string;
  action: string;
  responseTime: string;
  owner: string;
  followUpMethod: string;
}

export interface CrmPipeline {
  overview: string;
  /** The SIX canonical stages — New Lead → Qualified → Booked → Showed → Won →
   *  Lost — stamped from PIPELINE in src/lib/workflow-catalogue.ts, which is the
   *  single definition of the pipeline we actually configure. */
  stages: CrmStage[];
  /** @deprecated Moved to `AcquisitionInfrastructure.ongoing.leadTiers`. Lead
   *  scoring is LeadGate, and LeadGate is the monthly retainer — printing the
   *  tiers inside the pipeline section made them read as part of the one-time
   *  build, which misprices the offer. Kept optional so saved packs still render. */
  leadTiers?: LeadTier[];
}

// ── What the one-time build actually is ──────────────────────────────────────
// Fourteen GoHighLevel workflows and one six-stage pipeline. Every field below
// except `whyForThisBusiness` is STAMPED from src/lib/workflow-catalogue.ts, so
// a document can never describe a workflow that is not in the build, and a
// workflow added to the build cannot go undescribed.
export interface BuiltWorkflow {
  /** Stable catalogue id — the join between this document and the real build. */
  workflowId: string;
  name: string; // stamped
  whatItDoes: string; // stamped
  trigger: string; // stamped
  whatTheClientSees: string; // stamped
  /** The ONLY model-written field: why this one matters for THIS business,
   *  grounded in its fired leaks. Empty when the model had nothing specific —
   *  better a blank than an invented reason. */
  whyForThisBusiness: string;
  /** True when this workflow is left out of this client's build, with the
   *  catalogue's own reason. A left-out workflow is still listed, because
   *  "why am I not getting that one?" is a question the document should answer. */
  excluded?: boolean;
  exclusionReason?: string;
}

/** The CAD $6,500 one-time build: what gets built, once. */
export interface OneTimeBuild {
  overview: string;
  /** Stamped price string, marker before the figure ("CAD $6,500"). */
  investment: string;
  workflows: BuiltWorkflow[];
  /** Everything in the build that is not a workflow — the booking page, the
   *  calendar, the tracked number, the pipeline itself. Stamped. */
  alsoIncluded: string[];
  /** Said out loud, because an unstated boundary becomes an expectation.
   *  Stamped. */
  notIncluded: string[];
}

/** The CAD $1,000/month service. Lead scoring and qualification live HERE, not
 *  in the build: LeadGate runs continuously and is tuned every month, so
 *  presenting it as a one-time deliverable both misprices the offer and
 *  promises something a one-time build cannot deliver. */
export interface OngoingService {
  overview: string;
  /** Stamped price string ("CAD $1,000 per month"). */
  investment: string;
  whatRunsEveryMonth: string[];
  /** The four qualification tiers — moved here from crmPipeline. */
  leadTiers: LeadTier[];
  /** One sentence saying plainly that qualification is the monthly service and
   *  not part of the one-time build. */
  whyItIsNotInTheBuild: string;
}

// Deliverable 2's strategic architecture layer (composed with file2/3/4/5).
export interface AcquisitionInfrastructure {
  funnel: AcquisitionFunnel;
  crmPipeline: CrmPipeline;
  /** The one-time build. Optional so pre-Phase-2 packs still typecheck. */
  build?: OneTimeBuild;
  /** The monthly service. Optional for the same reason. */
  ongoing?: OngoingService;
}

// Law 2: the ONLY permitted review touch is a single review-request automation
// fired AFTER a completed job. No review-generation strategy, email set, or staff
// scripts — those are a forbidden "Review Generation" section.
export interface ReviewAssets {
  /** Where it is installed. Stamped, optional for packs written before it. */
  where?: string;
  postJobRequest: string;
}

export interface ThankYouAssets {
  where?: string;
  thankYouPageCopy: string;
  nextStepMessaging: string;
  postPurchaseSequence: string[];
}

// Deliverable 3's net-new supporting assets (composed with file1/3/4/5 copy).
export interface SupportingAssets {
  reviewAssets: ReviewAssets;
  thankYouAssets: ThankYouAssets;
}

// ── GO-LIVE, defined precisely ───────────────────────────────────────────────
// The middle phase of the timeline is not a stretch of work — it is a single
// moment, and "when does this actually start working?" is the question every
// owner asks. Vagueness here is what turns a delivered build into a support
// thread three weeks later, so the moment is written down in three parts: what
// we switch on, what only the client can do, and what "live" means when it is
// done.
export interface GoLiveDefinition {
  /** What we switch on, in the order it happens. */
  whatSwitchesOn: string[];
  /** The handful of things only the owner can do — the honest short list. Every
   *  one of these is a genuine human step (Law 3), not work handed back. */
  whatWeNeedFromYou: string[];
  /** The test that settles it: what a real enquiry does on go-live day. */
  whatLiveMeans: string;
}

// One phase of the Implementation & Optimization Timeline. THREE phases, and the
// shape of the offer is the shape of the timeline (Law 3 — we do all of it):
//   Phase 1 — Build      · Days 1–14   · the CAD $6,500 one-time
//   Phase 2 — Go-Live    · the moment  · defined by GoLiveDefinition above
//   Phase 3 — Ongoing    · Days 15–90  · the CAD $1,000/month
export interface RoadmapPhase {
  phase: string; // "Build", "Go-Live", "Ongoing"
  window: string; // "Days 1–14", "Day 14 — go-live", "Days 15–90"
  objective: string;
  // What WE deploy/run in this phase, pulled from the diagnosis (Build) or the
  // retainer cadence (Ongoing). Activities, but owned by us.
  deployActions: string[];
  owner: DeployOwner; // "us"
  // "Done" defined as measurable conversion outcomes, not activities.
  doneDefinition: string[]; // e.g. "Median lead response time under 5 minutes"
  isRetainerPhase: boolean; // true for the ongoing phase only
  /** What this window costs, marker before the figure ("CAD $6,500, one-time").
   *  Stamped, never model-written — a price the model invents is a price we then
   *  have to honour. */
  investment?: string;
  /** Which of the fourteen catalogue workflows land in this window, by name.
   *  Stamped from the catalogue so the timeline and the build cannot disagree. */
  workflowsInThisWindow?: string[];
  /** Present on the GO-LIVE phase only. */
  goLive?: GoLiveDefinition;
}

export interface GrowthRoadmap {
  overview: string;
  phases: RoadmapPhase[]; // setup, stabilize, ongoing optimization
}

// ══════════════════════════════════════════════════════════════════════════════
// D3 · CONVERSION SURFACES — the copy, and the box each string goes in
// ══════════════════════════════════════════════════════════════════════════════
//
// WHAT REPLACED THE LANDING-PAGE MODULE, AND WHY.
// The pack used to produce a whole landing-page specification: page sections,
// hero options, a page order, deployment notes, a tech stack. We do not build,
// host, redesign or deploy websites — the ONE page ReclaimedHQ builds is the
// booking page inside the client's GoHighLevel sub-account — so that module was
// writing copy for a surface that does not exist in the offer.
//
// The words were mostly right; the destination was wrong. So the copy is
// REPOINTED, not deleted, onto the surfaces that do exist:
//
//   bookingPage     → the GoHighLevel booking page we build and brand
//   leadCaptureForm → the lead-capture form and what it says after a submit
//   leadGate        → the words wrapped around the qualifying questions
//   webchat         → the chat launcher, greeting and away-message
//   siteAdvisory    → written recommendations the client hands to whoever
//                     looks after their own website. ADVISORY. Not our work.
//
// EVERY SURFACE CARRIES ITS OWN `where`. An operator with this document open and
// GoHighLevel open in the next tab must never have to guess which box a string
// belongs in — that guess is how a reassurance line ends up as a headline. The
// `where` strings are STAMPED from constants in asset-generation.ts, never
// written by the model, so they are identical in every pack and a renderer
// cannot mislabel them.

/** One section of the booking page, in the order it appears, WITH the words that
 *  go in it. This is the page WE build inside GoHighLevel — not a spec for
 *  anybody's website, which is why each section carries finished copy rather than
 *  a brief. The old landing module's problem / value / trust paragraphs land
 *  here: they were always page copy, they just had no page to go on. */
export interface BookingPageSection {
  name: string;
  purpose: string;
  /** Paste-ready. Empty only when a section genuinely needs no words (a calendar
   *  embed). */
  copy: string;
}

export interface BookingPageCopy {
  /** Stamped destination, e.g. "GoHighLevel → Sites → Booking page". */
  where: string;
  headlineOptions: string[]; // 3 — the owner picks one at build time
  subheadlineOptions: string[]; // 3
  primaryButton: string;
  secondaryButton: string;
  /** The short reassurance line that sits directly under the button. */
  reassuranceLine: string;
  /** One credible above-the-fold proof line. Never invented — an unproven claim
   *  ships as a labelled "[Insert verified …]" placeholder. */
  proofLine: string;
  sectionOrder: BookingPageSection[];
  faq: FaqItem[];
  /** Stamped standing rule: any response time promised on the page has to match
   *  what the automation actually does. */
  honestyNote: string;
}

export interface LeadCaptureFormCopy {
  where: string;
  formHeadline: string;
  formIntro: string;
  submitButton: string;
  postSubmitHeadline: string;
  /** What happens next and by when — the timeline expectation. */
  postSubmitCopy: string;
  /** The emergency route out of the automation. Losing this line is a real
   *  regression: somebody with a burst pipe must not be left waiting on a
   *  nurture sequence. */
  emergencyRoute: string;
}

export interface LeadGateFrontEndCopy {
  where: string;
  /** The line above the qualifying questions that says why they are being asked. */
  openingLine: string;
  /** Short framing lines that sit beside individual questions. The questions
   *  themselves live in the Lead Qualification file — they are NOT restated here,
   *  because two copies of a question set is two question sets that can disagree. */
  questionIntros: string[];
  /** What a lead that scores hot is told on screen. */
  priorityAcknowledgement: string;
  /** What everyone else is told — same warmth, honest timeline. */
  standardAcknowledgement: string;
}

export interface WebchatCopy {
  where: string;
  /** The text on the chat bubble itself. */
  launcherLabel: string;
  greeting: string;
  /** How the chat asks for a name and number so the thread can continue by text. */
  detailsAsk: string;
  /** What an out-of-hours visitor sees. */
  awayMessage: string;
}

/** One advisory note about the client's OWN website. Advice, handed over — never
 *  a promise to do the work. */
export interface SiteAdvisoryNote {
  area: string; // "Hero", "Buttons", "Proof placement", "Mobile"
  whatWeSaw: string;
  recommendation: string;
  priority: Priority;
}

export interface SiteAdvisory {
  where: string;
  /** Stamped, verbatim: these are advisory notes for whoever maintains the
   *  website; the page we build and host is the GoHighLevel booking page. */
  scopeNote: string;
  summary: string;
  notes: SiteAdvisoryNote[];
  /** Stamped standing rules that survive every regeneration verbatim. */
  standingRules: string[];
}

/** The D3 surface pack. Replaces `landing` on new packs. */
export interface ConversionSurfaces {
  bookingPage: BookingPageCopy;
  leadCaptureForm: LeadCaptureFormCopy;
  leadGate: LeadGateFrontEndCopy;
  webchat: WebchatCopy;
  siteAdvisory: SiteAdvisory;
}

// ══════════════════════════════════════════════════════════════════════════════
// D3 · WORKFLOW COPY — a message for every workflow in the build
// ══════════════════════════════════════════════════════════════════════════════
//
// THE GAP THIS CLOSES. The build is fourteen workflows. The pack used to ship
// copy for about half of them, so on day one the operator was writing the owner
// notification, the review replies and the reactivation campaign himself, inside
// the client's account, at the moment the client was watching. A workflow in the
// build with no copy in the pack is not a documentation gap — it is unbilled
// work and an inconsistent voice.
//
// The asset list is DERIVED FROM THE CATALOGUE (WORKFLOW_COPY_SOURCE in
// asset-generation.ts), not typed out by hand, so the two cannot drift: add a
// workflow to the build and it appears here automatically.

export interface WorkflowMessage {
  /** Which step of the workflow this string is — "Step 1 · text, within a
   *  minute", or a variant name like "Four or five stars". */
  step: string;
  /** "Text", "Email", "Owner notification", "Public review reply", "Direct message". */
  channel: string;
  timing: string;
  /** Emails only. */
  subject?: string;
  body: string;
  mergeFields?: string[];
}

export interface WorkflowCopyAsset {
  /** Stable catalogue id. */
  workflowId: string;
  workflowName: string; // stamped
  trigger: string; // stamped
  /** Stamped destination inside GoHighLevel. */
  where: string;
  messages: WorkflowMessage[];
}

/** Where EVERY workflow in the build gets its copy — including the ones whose
 *  copy lives in another part of the pack. This is the anti-drift record: read
 *  it and you can see, workflow by workflow, that nothing was left without
 *  words. Fully stamped; no model input. */
export interface WorkflowCopyCoverage {
  workflowId: string;
  workflowName: string;
  /** False when this client's answers took the workflow out of the build. */
  inThisBuild: boolean;
  /** Plain-English pointer: "Workflow copy — Owner Hot-Lead Notification",
   *  "Booking & reminder assets", "The 60-day nurture sequence". */
  copyLivesIn: string;
}

export interface WorkflowCopyPack {
  assets: WorkflowCopyAsset[];
  coverage: WorkflowCopyCoverage[];
}

// ── Landing Page Module (LEGACY — no longer generated) ────────────────────────
// The old "Landing Page Growth Audit". It was the pack's 10th model call and it
// wrote a landing-page specification: page sections, hero options, a page order,
// CTA inventory, deployment notes. THE CALL IS GONE (see the header of
// src/lib/asset-generation.ts); its surviving copy now lives on
// `ConversionSurfaces` above, addressed to the surfaces that actually exist.
//
// THE TYPES STAY, DELIBERATELY. Every pack generated before this change carries
// a populated `landing` object inside GeneratedSystem.content, and those rows are
// never deleted. Removing the types would mean those documents re-render through
// a thinner fallback — a saved deliverable quietly changing after the fact, which
// is the one thing a saved deliverable must never do. Nothing below is produced
// for a new pack.
//   • the DIAGNOSIS half (LandingPageIntelligence) fed Deliverable 1
//   • the ASSETS half (LandingPageAssets) fed Deliverable 3

// A structured diagnostic finding used for the hero / CTA / trust diagnoses.
export interface LandingDiagnosisPoint {
  problem: string;
  evidence: string;
  whyItMatters: string;
  recommendedFix: string;
  expectedImprovement: string;
}

// One conversion bottleneck in the landing-page funnel.
export interface LandingConversionBottleneck {
  stage: string; // e.g. "Homepage → Inquiry", "Mobile visitor → CTA"
  currentFriction: string;
  likelyVisitorBehavior: string;
  businessImpact: string;
  recommendedFix: string;
  priority: Priority;
}

// One ranked landing-page fix (rendered as a table row in D1).
export interface LandingFastWin {
  fix: string;
  whyItMatters: string;
  priority: Priority;
  difficulty: Difficulty;
  expectedOutcome: string;
}

// Deliverable 1 — "Landing Page Conversion Intelligence" (diagnosis only).
export interface LandingPageIntelligence {
  executiveDiagnosis: string; // doing well / friction / likely cost / fix first / why it matters here
  heroDiagnosis: LandingDiagnosisPoint;
  ctaDiagnosis: LandingDiagnosisPoint;
  trustDiagnosis: LandingDiagnosisPoint;
  conversionBottlenecks: LandingConversionBottleneck[];
  technicalUxDiagnosis: string; // conversion-tied read of performance (not an SEO report)
  fastestWins: LandingFastWin[];
  trackingRecommendations: string[]; // tool-agnostic
}

// One section of the recommended landing-page structure.
export interface LandingStructureSection {
  name: string; // "Hero section", "Problem section", ...
  purpose: string;
  whatToCommunicate: string;
  implementationNote: string;
}

// One CTA option in the asset pack.
export interface LandingCtaOption {
  label: string; // the actual button/link copy
  type: string; // "Primary" | "Secondary" | "Phone" | "Booking" | "Low-friction" | "Final"
  whereToUse: string;
  whyItExists: string;
  expectedRole: string;
}

export interface LandingHeroCopy {
  headlineOptions: string[]; // 3
  subheadlineOptions: string[]; // 3
  primaryCta: string;
  secondaryCta: string;
  trustMicrocopy: string;
  aboveFoldProofLine: string;
}

// Deliverable 3 — "Landing Page Conversion Assets" (actual copy/assets only).
export interface LandingPageAssets {
  recommendedStructure: LandingStructureSection[]; // ~9 sections
  heroCopy: LandingHeroCopy;
  problemCopy: string;
  solutionCopy: string;
  trustCopy: string; // proof framing; may contain "[Insert ...]" placeholders, never fake proof
  ctaOptions: LandingCtaOption[];
  faq: FaqItem[]; // 5-8, each handling a real buying objection
  thankYouPageCopy: string;
  implementationNotes: string[];
}

// The internal module — generated as one coherent unit so the diagnosis and the
// assets described the SAME recommended page. LEGACY: read off saved packs only,
// never produced by a new generation run.
export interface LandingPageModule {
  intelligence: LandingPageIntelligence;
  assets: LandingPageAssets;
}

// ── Governance override paper trail ───────────────────────────────────────────
// A fatal validator check blocks both save and export. The override exists so a
// rule that false-positives at 11pm with a client waiting cannot make delivery
// physically impossible — because the real-world alternative is that the gate
// gets commented out, and then enforcement is off permanently and silently.
//
// The price of the escape hatch is a paper trail, and this is the part of it
// that travels WITH the pack: any copy of the JSON says, on its own, that it
// shipped over known violations, who said so and why.

/** Severity of one validator check. The canonical copy of this union — the
 *  validator's own `CheckLevel` is an alias of it, so the persisted record and
 *  the live check can never drift apart. */
export type PackCheckLevel = "pass" | "warn" | "fail";

/** One validator finding, in the shape that gets persisted. `LawCheck` /
 *  `ValidationCheck` in src/lib/exporters/validate-pack.ts ARE this type. */
export interface PackValidationCheck {
  /** Stable, content-derived identifier (see `checkId` in validate-pack.ts).
   *  This is the token an override acknowledgement echoes back, which is how the
   *  server knows the operator was actually shown the failure they are waiving. */
  id: string;
  /** Short law id, e.g. "Law 5 · dollar math". */
  law: string;
  level: PackCheckLevel;
  message: string;
}

/** Which gate was forced. A pack can be saved over a violation and exported over
 *  one, and "which door was it let through" is the first question afterwards. */
export type GovernanceBoundary = "save" | "export";

/** The override record. Present ONLY on a pack that broke a rule and shipped
 *  anyway — its mere presence is the signal, so nothing ever writes a
 *  `overridden: false` variant. */
export interface PackGovernance {
  overridden: true;
  /** The operator's own words. Never generated, never defaulted, never blank. */
  reason: string;
  /** Exactly the checks that were fatal at the moment of the override. */
  checks: PackValidationCheck[];
  /** ISO timestamp of the override. */
  at: string;
  boundary: GovernanceBoundary;
}

export interface AssetPack {
  meta: AssetPackMeta;
  file1: GrowthAuditFile;
  file2: LeadQualificationFile;
  file3: EmailNurtureFile;
  file4: SmsFollowUpFile;
  file5: BookingSystemFile;
  // V2 strategic components (optional — old packs render via file fallbacks).
  intelligence?: GrowthIntelligence;
  infrastructure?: AcquisitionInfrastructure;
  supportingAssets?: SupportingAssets;
  roadmap?: GrowthRoadmap;
  // D3 copy, addressed to the surfaces that exist: the GoHighLevel booking page,
  // the lead-capture form, the LeadGate front-end, the webchat — plus advisory
  // notes for the client's own website. Replaces `landing` on every new pack.
  surfaces?: ConversionSurfaces;
  // One message for every workflow in the build, derived from the catalogue.
  workflowCopy?: WorkflowCopyPack;
  // LEGACY — the removed landing-page module. Present on packs saved before the
  // 10th call was deleted; never written by a new run. Kept so those documents
  // still render exactly as they did the day they were made.
  landing?: LandingPageModule;
  // Set only when this pack was saved or exported over a failing check. Absent
  // on every clean pack. NOT client-facing: no renderer reads it, and the pack
  // validator strips it before scanning copy (the operator's free-text reason is
  // ours, not the client's — see validatePack).
  governance?: PackGovernance;
}

export type AssetSection = "file1" | "file2" | "file3" | "file4" | "file5";

// The four client-facing flagship deliverables.
export type DeliverableId = "d1" | "d2" | "d3" | "d4";

// ── Evidence grades ───────────────────────────────────────────────────────────
// PAID-PACK ENFORCEMENT — this vocabulary long outlived the cold audit it was
// first written next to. The pack validator, the tier-aware softener and the
// fabrication lint all key on it.

/** Three grades of knowledge about a client, in descending order of how strongly
 *  a claim may be phrased. Measured beats told beats guessed.
 *
 *  This is the single vocabulary the whole system reasons about voice in. It is
 *  DERIVED, never hand-set — see gradeOf() in leak-taxonomy.ts — so a leak's
 *  voice cannot drift from what we actually know about it. */
export type EvidenceGrade = "observed" | "disclosed" | "inferred";

// ── Cold-Open Audit — LEGACY ROWS ONLY ────────────────────────────────────────
// The free pre-sale cold audit was DELETED by owner ruling (2026-08-01): the
// generator, renderer, validator, routes and public teaser are all gone, and no
// new COLD_AUDIT row can ever be written (every row was soft-deleted; the rows
// and their content stay in the database forever, per the no-hard-delete law).
// Its replacement is the observed-facts row (src/lib/observed-facts.ts) — four
// measured numbers, no prose, nothing generated.
//
// This minimal shape survives for exactly one live reader:
// /api/generate/proposal still READS the newest stored COLD_AUDIT row (it
// resolves to null forever after the soft-delete — approved consequence) and
// hands it to buildProposalDefaults, whose `audit` parameter needs a type.
// Only the fields that read path touches are declared. Do not widen it, and do
// not build anything new against it.

export interface ColdAuditFinding {
  title: string;
  problem: string;
  whyItCosts: string;
}

export interface ColdAuditReport {
  headlineCost?: string;
  findings?: ColdAuditFinding[];
}

// ── Proposal (client conversion offer) ────────────────────────────────────────
// The proposal sells ONE bespoke, two-part engagement: a one-time done-for-you
// setup plus a monthly retainer that runs LeadGate continuously. It is framed
// entirely around CONVERSION — turning the leads the business already pays for
// into booked, paying customers — never lead generation, ads, SEO, or traffic.
// Content is grounded in the business's stored audit (diagnosed leaks + dollar
// cost) when one exists, else a clearly-labelled conservative assumption.

// One diagnosed conversion leak restated for the buyer, with its dollar cost.
export interface ProposalLeak {
  title: string; // plain-English leak name ("Slow response to new leads")
  monthlyCost: string; // dollarized, e.g. "$2,400–$3,800 / mo" (Law 5)
  detail: string; // what's leaking and why it costs them, tied to the diagnosis
}

export interface ProposalProblem {
  summary: string; // restates the diagnosed situation in the owner's language
  basis: string; // "From your audit" or a labelled conservative assumption
  leaks: ProposalLeak[];
}

// One component we deploy, tied to the specific leak it closes (done-for-you).
export interface ProposalComponent {
  name: string; // "LeadGate qualification engine"
  addresses: string; // the leak this component closes
  detail: string; // what we build / deploy / manage (DFY framing, Law 3)
  isRetainer: boolean; // true for LeadGate — the continuously-running engine
}

export interface ProposalRoi {
  summary: string; // cost vs. dollar value of recovered conversions (conservative)
  recovered: string; // dollarized recovered-conversion estimate, e.g. "$3,000–$5,000 / mo"
  points: string[]; // supporting, conservative ROI bullets
}

export interface ProposalScope {
  included: string[]; // what the engagement covers (conversion + the GHL build)
  // Absolute exclusions, never carve-outs: no ads or media, no lead generation,
  // traffic, or SEO, and no website work — site findings stay advisory.
  excluded: string[];
}

export interface ProposalPhase {
  label: string; // "Week 1–2 — Build & deploy"
  detail: string;
}

export interface ProposalTestimonial {
  quote: string;
  attribution: string;
}

export interface ProposalProof {
  note: string; // honest framing; never fabricated proof
  testimonials: ProposalTestimonial[]; // operator fills these in — empty by default
}

export interface ProposalFaq {
  q: string;
  a: string;
}

// The full editable/renderable proposal content (shared by builder + public view).
export interface ProposalContent {
  title: string;
  agencyName: string; // "Prepared by {{agency_name}}"
  setupFee: number; // one-time, CAD (6500) — four deliverables + the GHL build
  monthlyPrice: number; // LeadGate retainer, CAD/mo (1000) — management + monthly report
  packageOverview: string; // the solution thesis — what we deploy and why
  problem: ProposalProblem;
  deliverables: ProposalComponent[]; // what we deploy, each tied to a leak
  roi: ProposalRoi;
  scope: ProposalScope;
  timeline: ProposalPhase[];
  proof: ProposalProof;
  nextSteps: string; // the CTA / how to move forward
  faq: ProposalFaq[];
  emailMessage: string; // accompanying send-to-client message
}

export type ProposalData = ProposalContent;

export interface BusinessSuggestions {
  painPoint: string;
  outreachAngle: string;
  suggestedOffer: string;
}

export interface FullProposal {
  id: string;
  userId: string;
  businessId: string;
  title: string;
  agencyName: string | null;
  setupFee: number;
  monthlyPrice: number;
  packageOverview: string;
  problem: ProposalProblem | null;
  deliverables: ProposalComponent[];
  roi: ProposalRoi | null;
  scope: ProposalScope | null;
  timeline: ProposalPhase[] | null;
  proof: ProposalProof | null;
  faq: ProposalFaq[] | null;
  nextSteps: string | null;
  emailMessage: string | null;
  // Legacy / unused-but-persisted columns kept for back-compat.
  benefits: string[];
  publicId: string;
  status: string;
  systemsIncluded: string[];
  createdAt: string;
  updatedAt: string;
  business: SavedBusiness;
}

export interface Deal {
  id: string;
  userId: string;
  businessId: string;
  proposalId: string | null;
  stage: string;
  monthlyValue: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  business: SavedBusiness;
  proposal: FullProposal | null;
}
