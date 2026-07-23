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
  landingPage: {
    heroHeadline: string;
    heroSubheadline: string;
    ctaBlock: string;
    problemSection: string;
    solutionSection: string;
    offerSection: string;
    threeStepProcess: ProcessStep[];
    benefits: string[];
    trustSection: string;
    testimonials: Testimonial[];
    faq: FaqItem[];
    urgencyBlock: string;
    finalCta: string;
  };
  landingStructure: string[];
  ctaStrategy: string;
  socialProofRecommendations: string[];
  urgencyStrategy: string;
  implementationNotes: string;
  techStack: { tool: string; purpose: string }[];
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

// FILE 3 — email-nurture-system.docx
export interface EmailNurtureFile {
  framing?: DeliverableFraming;
  emails: {
    day: number;
    timing: string;
    subject: string;
    subjectB: string;
    previewText: string;
    body: string;
    cta: string;
    purpose: string;
  }[]; // 7
}

// FILE 4 — sms-follow-up-system.txt
export interface SmsFollowUpFile {
  framing?: DeliverableFraming;
  messages: {
    order: number;
    timing: string;
    message: string;
    charCount: number;
    psychology: string;
    replyStrategy: string;
  }[]; // 6
}

// FILE 5 — booking-appointment-system.html
export interface BookingSystemFile {
  framing?: DeliverableFraming;
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
  stages: CrmStage[]; // New Lead → Lost / Nurture
  leadTiers: LeadTier[]; // 4 tiers
}

// Deliverable 2's strategic architecture layer (composed with file2/3/4/5).
export interface AcquisitionInfrastructure {
  funnel: AcquisitionFunnel;
  crmPipeline: CrmPipeline;
}

// Law 2: the ONLY permitted review touch is a single review-request automation
// fired AFTER a completed job. No review-generation strategy, email set, or staff
// scripts — those are a forbidden "Review Generation" section.
export interface ReviewAssets {
  postJobRequest: string;
}

export interface ThankYouAssets {
  thankYouPageCopy: string;
  nextStepMessaging: string;
  postPurchaseSequence: string[];
}

// Deliverable 3's net-new supporting assets (composed with file1/3/4/5 copy).
export interface SupportingAssets {
  reviewAssets: ReviewAssets;
  thankYouAssets: ThankYouAssets;
}

// One phase of the Implementation & Optimization Timeline. Reframed (Law 3) from
// "your team's plan" to the provider's deployment + the retainer cadence:
//   Phase 1 — Setup (we deploy, scoped to THIS report's leaks, sequenced by $)
//   Phase 2 — Stabilize
//   Phase 3+ — Ongoing Optimization (the monthly retainer cadence)
export interface RoadmapPhase {
  phase: string; // "Setup", "Stabilize", "Ongoing Optimization"
  window: string; // "Week 1–2", "Month 2", "Ongoing"
  objective: string;
  // What WE deploy/run in this phase, pulled from the diagnosis (Setup) or the
  // retainer cadence (later phases). Activities, but owned by us.
  deployActions: string[];
  owner: DeployOwner; // "us"
  // "Done" defined as measurable conversion outcomes, not activities.
  doneDefinition: string[]; // e.g. "Median lead response time under 5 minutes"
  isRetainerPhase: boolean; // true for the ongoing-optimization cadence
}

export interface GrowthRoadmap {
  overview: string;
  phases: RoadmapPhase[]; // setup, stabilize, ongoing optimization
}

// ── Landing Page Module (internal) ────────────────────────────────────────────
// The old "Landing Page Growth Audit" — absorbed into the package as an internal
// module that feeds TWO flagship deliverables rather than existing as its own
// client-facing file:
//   • the DIAGNOSIS half (LandingPageIntelligence) feeds Deliverable 1
//   • the ASSETS half (LandingPageAssets) feeds Deliverable 3
// Optional on AssetPack so packs generated before this module still render (the
// D1/D3 renderers fall back to the underlying file1 landing content).

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
// assets describe the SAME recommended page.
export interface LandingPageModule {
  intelligence: LandingPageIntelligence;
  assets: LandingPageAssets;
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
  // Internal Landing Page module feeding D1 (diagnosis) + D3 (assets).
  landing?: LandingPageModule;
}

export type AssetSection = "file1" | "file2" | "file3" | "file4" | "file5";

// The four client-facing flagship deliverables.
export type DeliverableId = "d1" | "d2" | "d3" | "d4";

// ── Cold-Open Audit ───────────────────────────────────────────────────────────
// The free, 1-page "here's what's quietly costing you customers" mini-report we
// send BEFORE pitching the full 5-file pack. Grounded in real PageSpeed /
// screenshot / scrape / reviews data. Ends in ONE soft, editable, reply-driving
// CTA tied to the single highest-impact finding.

export interface ColdAuditFinding {
  title: string; // short, specific, plain-English ("Your booking link is buried")
  problem: string; // what's actually happening, grounded in observed data
  whyItCosts: string; // the business/revenue consequence in their language
  severity: "high" | "medium" | "low";
}

export interface ColdAuditPerformance {
  available: boolean;
  mobileScore: number | null;
  lcpSeconds: number | null;
  clsValue: number | null;
  // plain-English read of the numbers, never raw Lighthouse jargon
  readout: string;
}

export interface ColdAuditReport {
  businessName: string;
  city: string;
  industry: string;
  websiteUrl: string;
  // signed above-the-fold screenshot of their current site (best-effort)
  screenshotUrl: string | null;
  headline: string; // direct title naming the business (not "a quick note")
  intro: string; // 1 sentence: acknowledge one real strength, then pivot to the bleed
  // the quantified dollar gut-punch shown up top (Law 2)
  headlineCost: string;
  findings: ColdAuditFinding[]; // 3-5, ordered most→least impactful
  // 2-3 pointed questions previewing the unmeasurable leaks (Law 3):
  // response time, follow-up, no-shows, qualification
  deeperLeakQuestions: string[];
  performance?: ColdAuditPerformance;
  // the close. a PIVOT to the paid engagement, never an offer of free help (Law 10).
  // editable so the user tweaks the ask before sending.
  closingCta: {
    tiedToFinding: string; // which finding this references (the #1)
    message: string; // the pivot-to-paid ask
  };
  agencyName: string; // footer attribution
  generatedAt: string;
  dataConfidence: DataConfidence;
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
  included: string[]; // what the engagement covers (conversion)
  excluded: string[]; // explicitly out: ad spend, new traffic, SEO, lead-gen
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
  setupFee: number; // one-time, CAD (default 6500)
  monthlyPrice: number; // retainer, CAD/mo (default 700)
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
