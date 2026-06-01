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

export interface AssetPack {
  meta: AssetPackMeta;
  file1: GrowthAuditFile;
  file2: LeadQualificationFile;
  file3: EmailNurtureFile;
  file4: SmsFollowUpFile;
  file5: BookingSystemFile;
}

export type AssetSection = "file1" | "file2" | "file3" | "file4" | "file5";

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
  headline: string; // personalized hook ("I looked at {biz}'s site — 3 quick things")
  intro: string; // 1-2 warm sentences framing why this was sent, no pitch
  findings: ColdAuditFinding[]; // 3-5, ordered most→least impactful
  performance?: ColdAuditPerformance;
  // the soft close. editable so the user tweaks the ask before sending.
  closingCta: {
    tiedToFinding: string; // which finding this references (the #1)
    message: string; // the soft, low-friction, reply-driving ask
  };
  generatedAt: string;
  dataConfidence: DataConfidence;
}

export interface ProposalData {
  title: string;
  packageOverview: string;
  deliverables: string[];
  monthlyPrice: number;
  benefits: string[];
  nextSteps: string;
  emailMessage: string;
}

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
  packageOverview: string;
  deliverables: string[];
  monthlyPrice: number;
  benefits: string[];
  nextSteps: string | null;
  emailMessage: string | null;
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
