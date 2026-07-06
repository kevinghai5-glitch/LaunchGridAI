/**
 * ============================================================================
 * LAUNCHGRID LEAK TAXONOMY — SINGLE SOURCE OF TRUTH
 * ============================================================================
 *
 * PURPOSE
 * This file is the ONLY place leaks are defined. The deliverable generator
 * (Growth Leak Report, Blueprint, Conversion Asset Pack, 90-Day Roadmap)
 * and the cold audit MUST select exclusively from this list. If a leak is
 * not in this file, it cannot appear in any output. This is what prevents
 * the generator from inventing problems LaunchGrid cannot fix in
 * GoHighLevel / LeadGate.
 *
 * CORE RULES (enforced by the generator, see claude-code-deliverable-refactor.md)
 * 1. Only leaks in LEAKS may be surfaced. No free-form leak generation.
 * 2. A leak only fires when its detection conditions match real scraped data.
 * 3. Every fired leak carries an evidence tier that controls how strongly
 *    the deliverable is allowed to phrase it (observed vs evidenced vs
 *    benchmark). This is what keeps the output consultant-grade and honest.
 * 4. Every stat comes from STATS (mirrors statistics_database.md). The
 *    generator may NEVER produce a number that is not in STATS.
 * 5. scope: "out_of_scope" leaks are NEVER presented as things LaunchGrid
 *    fixes. They go only into the "Also worth knowing" section.
 *
 * MAINTENANCE
 * - To add a leak: add an entry to LEAKS. That is the entire process.
 *   New GHL features you decide to deliver = new rows here.
 * - To enrich a leak with better research later (Perplexity pass): fill
 *   in statIds / revenueMechanism. Structure stays the same.
 * - Keep ids stable once shipped — they will be referenced by generated
 *   deliverables and audit versions in the Control Centre.
 * ============================================================================
 */

/* ============================================================================
 * SECTION 1 — INPUT DATA CONTRACT
 * What the LaunchGrid research pipeline already collects per business.
 * Claude Code: map these fields onto the real data model in Phase 0 of the
 * refactor task. Rename fields to match the codebase; do not change semantics.
 * ==========================================================================*/

/**
 * Tri-state for externally-fingerprinted site signals.
 *   PRESENT — a positive match was found (proof-positive; substrate-agnostic).
 *   ABSENT  — no match AND we had a good scan (positive proof of a good scan:
 *             real rawHtml retrieved that passes a non-trivial length/marker
 *             check). Only an ABSENT justifies a factual "no X" OBSERVED leak.
 *   UNKNOWN — no match but the scan was thin/empty/bot-walled/native-only, so
 *             absence is unproven. UNKNOWN routes through the BENCHMARK hedge
 *             pathway ("we couldn't confirm this externally; verified at
 *             kickoff") — never asserted as fact.
 */
export type Tri = "PRESENT" | "ABSENT" | "UNKNOWN";

export interface ScrapeData {
  business: {
    name: string;
    industry: Vertical;
    city: string;
    /** From Google Maps listing pull */
    phone?: string;
    websiteUrl?: string;
  };

  /** Scraped site pages: home / services / about / contact / booking */
  website?: {
    pagesFound: ("home" | "services" | "about" | "contact" | "booking")[];
    /** Raw text per page for signal matching */
    pageText: Record<string, string>;
    /** True iff we had a good scan (rawHtml retrieved + passed the length/marker
     *  check). Content-based OBSERVED claims (CTA/copy) require this to be true. */
    scanConfident: boolean;
    hasContactForm: Tri;
    /** Form asks qualifying questions (job type / budget / timeline / service area)
     *  vs. a bare name/email/message form. Only meaningful when a form is PRESENT. */
    formHasQualifyingFields: boolean;
    hasOnlineBookingLink: Tri; // Calendly, GHL calendar, any scheduler
    hasChatWidget: Tri;        // any live-chat/webchat script detected
    hasClickToCallOnMobile: Tri;
    /** Clear primary CTA above the fold on home page (book / call / quote) */
    hasPrimaryCtaAboveFold: boolean;
    /** Distinct CTA present on each service page */
    servicePagesHaveCtas: boolean;
    mentionsTextingOption: boolean; // "text us" anywhere on site
    linksToFacebook: boolean;
    linksToInstagram: boolean;
  };

  pageSpeed?: {
    mobileScore: number;   // 0–100
    lcpSeconds: number;
  };

  googleReviews?: {
    rating: number;
    count: number;
    /** Reviews in the last 90 days */
    recentCount90d: number;
    /** Share of reviews with an owner reply, 0–1 */
    ownerResponseRate: number;
    /** Raw review texts (or extracted themes) for keyword matching */
    reviewTexts: string[];
  };

  gbp?: {
    hoursListed: boolean;
    /** True if hours show closed on evenings AND weekends */
    limitedHours: boolean;
    hasBookingLink: boolean;
    messagingEnabled: boolean;
  };

  competitors?: Array<{
    name: string;
    rating: number;
    reviewCount: number;
    hasOnlineBooking?: boolean;
    hasChatWidget?: boolean;
  }>;

  /** Post-close only. Cold audit + pre-sale deliverables run without this. */
  intake?: {
    avgJobValueCad?: number;
    monthlyLeadVolume?: number;
    monthlyCallVolume?: number;
    adSpendMonthlyCad?: number;
    hasCrm?: boolean;
    hasFollowUpSequence?: boolean;
    hasReminderSystem?: boolean;
    hasPastCustomerDatabase?: boolean;
  };
}

export type Vertical =
  | "dental"
  | "med_spa"
  | "law"
  | "roofing"
  | "hvac"
  | "plumbing"
  | "electrical"
  | "contractor_general"
  | "home_services_other";

/* ============================================================================
 * SECTION 2 — EVIDENCE TIERS
 * The honesty mechanism. Controls how strongly a leak may be phrased.
 * This is the difference between consultant-grade and fabricated.
 * ==========================================================================*/

export type EvidenceTier =
  /** Directly visible in scraped data. State as fact.
   *  "Your site has no online booking path." */
  | "OBSERVED"
  /** Inferred from real signals (e.g., review complaints). State the signal,
   *  then the inference. "Three recent reviews mention calls that weren't
   *  returned — a strong sign inbound calls are being missed." */
  | "EVIDENCED"
  /** Not visible from outside. Present ONLY as an industry pattern with
   *  hedged language + a note that it's verified at kickoff. "We can't see
   *  your follow-up process from the outside, but most {industry} businesses
   *  stop after one or two touches. If that's true here, this is likely the
   *  largest leak on this list." */
  | "BENCHMARK";

/** Ranking multiplier per tier — observed leaks outrank guessed ones. */
export const TIER_MULTIPLIER: Record<EvidenceTier, number> = {
  OBSERVED: 1.0,
  EVIDENCED: 0.9,
  BENCHMARK: 0.6,
};

/* ============================================================================
 * SECTION 3 — REVIEW SIGNAL KEYWORDS
 * Phrases in Google reviews that upgrade a leak from BENCHMARK to EVIDENCED.
 * Matching = case-insensitive substring against googleReviews.reviewTexts.
 * A leak needs >= 2 distinct matching reviews to claim EVIDENCED (one review
 * is an anecdote, not a pattern).
 * ==========================================================================*/

export const REVIEW_SIGNALS = {
  missedCalls: [
    "never called back",
    "no one answered",
    "couldn't reach",
    "couldn't get through",
    "left a voicemail",
    "no answer",
    "went to voicemail",
    "hard to get a hold of",
    "phone rang and rang",
  ],
  slowResponse: [
    "never heard back",
    "took days to respond",
    "no response",
    "never responded",
    "waited weeks",
    "slow to respond",
    "still waiting",
  ],
  noFollowUp: [
    "never followed up",
    "no follow up",
    "said they'd call",
    "never got a quote",
    "never sent the estimate",
  ],
  schedulingFriction: [
    "hard to book",
    "couldn't book",
    "no one showed",
    "cancelled on me",
    "rescheduled twice",
    "forgot my appointment",
  ],
} as const;

/* ============================================================================
 * SECTION 4 — APPROVED STATS
 * Verbatim from statistics_database.md (June 2026). Tier A = cite freely.
 * Tier B = soft framing only ("commonly cited") or use the pattern phrasing
 * instead of the number. THE GENERATOR MAY NOT EMIT ANY NUMBER NOT IN THIS MAP.
 * ==========================================================================*/

export interface Stat {
  id: string;
  claim: string;
  source: string;
  url: string;
  reliability: "A" | "B";
  /** For Tier B: the safe pattern phrasing to use INSTEAD of the number */
  softFraming?: string;
}

export const STATS: Record<string, Stat> = {
  speed_5min_21x: {
    id: "speed_5min_21x",
    claim:
      "Leads contacted within 5 minutes are ~21x more likely to qualify than at 30 minutes, and ~100x more likely to be reached at all.",
    source: "MIT / InsideSales (Oldroyd)",
    url: "https://www.digitalapplied.com/blog/speed-to-lead-response-time-benchmarks-2026-data-playbook",
    reliability: "A",
  },
  speed_1hr_7x: {
    id: "speed_1hr_7x",
    claim:
      "Responding within 1 hour makes a company ~7x more likely to qualify the lead than waiting longer.",
    source: "Harvard Business Review, 'The Short Life of Online Sales Leads' (1.25M leads)",
    url: "https://hbr.org/2011/03/the-short-life-of-online-sales",
    reliability: "A",
  },
  speed_avg_response_42h: {
    id: "speed_avg_response_42h",
    claim: "The average business takes ~42–47 hours to respond to a new lead.",
    source: "HBR 2011 / Drift 2018",
    url: "https://greetnow.com/blog/lead-response-time-statistics",
    reliability: "A",
  },
  speed_close_32_vs_12: {
    id: "speed_close_32_vs_12",
    claim:
      "Close rate with a <5 minute response: 32%, vs 12% when response takes 24+ hours (~2.6x).",
    source: "Optifai (939 B2B companies, 2025–2026)",
    url: "https://www.digitalapplied.com/blog/speed-to-lead-response-time-benchmarks-2026-data-playbook",
    reliability: "A",
  },
  consumer_expect_immediate: {
    id: "consumer_expect_immediate",
    claim:
      "82% of consumers expect an 'immediate' response; 60% define immediate as 10 minutes or less.",
    source: "HubSpot State of Inbound 2023",
    url: "https://greetnow.com/blog/lead-response-time-statistics",
    reliability: "A",
  },
  missed_voicemail_85: {
    id: "missed_voicemail_85",
    claim: "85% of callers who reach voicemail never call back.",
    source: "CallRail Benchmark Report (1.1M leads)",
    url: "https://www.callrail.com/blog/callrail-releases-benchmark-report",
    reliability: "A",
  },
  missed_rate_by_industry: {
    id: "missed_rate_by_industry",
    claim:
      "Missed-call rates by industry: Healthcare 32%, Legal 28%, Home Services 14%, Real Estate 9%.",
    source: "CallRail 'From Conversations to Conversions' (1.1M leads, Jan 2025)",
    url: "https://www.callrail.com/blog/callrail-releases-benchmark-report",
    reliability: "A",
  },
  missed_avg_28: {
    id: "missed_avg_28",
    claim: "~28% of inbound calls to businesses go unanswered on average.",
    source: "CallRail platform data",
    url: "https://www.callrail.com/blog/how-to-close-missed-call-customer-gap",
    reliability: "A",
  },
  missed_abandon_competitor: {
    id: "missed_abandon_competitor",
    claim:
      "78% of customers have abandoned a business after an unanswered call; 82% say they'll call a competitor next.",
    source: "CallRail consumer survey (1,000 US consumers, 2025)",
    url: "https://www.callrail.com/blog/missed-calls-cost-businesses-more-than-ever",
    reliability: "A",
  },
  after_hours_28_43: {
    id: "after_hours_28_43",
    claim:
      "28–43% of inbound calls to local service businesses arrive outside business hours.",
    source: "NextPhone / AgentZap / RevSquared (aggregated)",
    url: "https://www.getnextphone.com/blog/after-hours-handling",
    reliability: "A",
  },
  calls_convert_10x_web: {
    id: "calls_convert_10x_web",
    claim: "Phone calls to home-services businesses convert ~10–15x more than web leads.",
    source: "BIA/Kelsey, cited by Invoca",
    url: "https://www.invoca.com/blog/call-tracking-conversation-intelligence-stats",
    reliability: "A",
  },
  home_phone_convert_46: {
    id: "home_phone_convert_46",
    claim: "Home-services phone leads convert at ~46% on the call.",
    source: "Invoca (60M+ calls, Jun 2025)",
    url: "https://www.invoca.com/press-release/invoca-releases-definitive-cross-channel-and-cross-industry-buyer-conversion-benchmark-report",
    reliability: "A",
  },
  cpl_google_ads: {
    id: "cpl_google_ads",
    claim:
      "Google Ads cost-per-lead: HVAC $129, Plumbing $129, Roofing $228, Electrical $94, Dental $84, Legal $132 (USD).",
    source: "LOCALiQ / WordStream 2025 benchmarks",
    url: "https://www.wordstream.com/blog/2025-google-ads-benchmarks",
    reliability: "A",
  },
  law_convert_14: {
    id: "law_convert_14",
    claim:
      "The average law firm converts only ~14% of inquiries to clients; top firms reach 40–50%.",
    source: "Clio Legal Trends / MyCase",
    url: "https://agentzap.ai/blog/law-firm-lead-generation-statistics",
    reliability: "A",
  },
  law_response_8h: {
    id: "law_response_8h",
    claim:
      "Average law firm response time exceeds 8 hours; ~35% of inquiries get no response at all.",
    source: "Martindale-Avvo / Clio 2025",
    url: "https://agentzap.ai/blog/law-firm-lead-generation-statistics",
    reliability: "A",
  },
  dental_case_acceptance: {
    id: "dental_case_acceptance",
    claim:
      "Dental case acceptance averages ~42%; the top 10% of practices reach ~75%.",
    source: "Henry Schein One 2026 Catalyst Index",
    url: "https://www.henryscheinone.com/insights/ebook/2026-catalyst-index/",
    reliability: "A",
  },
  dental_no_show: {
    id: "dental_no_show",
    claim: "Dental no-show rates run ~12–18%; new-patient first appointments 25–30%.",
    source: "DentRecall / ADA",
    url: "https://dentrecall.com/blog/dental-no-show-statistics-2026",
    reliability: "A",
  },
  medspa_show_rate: {
    id: "medspa_show_rate",
    claim: "Med spa lead-to-booked-consult runs 30–60%; show rate 70–85%.",
    source: "ClinicROI / Growth99",
    url: "https://www.clinicroi.com/blog/med-spa-no-show-rate",
    reliability: "A",
  },
  home_services_convert_78: {
    id: "home_services_convert_78",
    claim:
      "Home-services average lead conversion is ~7.8% overall; plumbing 12–16%, HVAC/roofing 3–7%.",
    source: "WebFX / LOCALiQ aggregated",
    url: "https://www.estatehub.io/articles/2026-benchmarks-lead-conversion-rates-home-services",
    reliability: "A",
  },
  texting_switch_40: {
    id: "texting_switch_40",
    claim:
      "40.5% of consumers say they'd switch to a competitor that offers text messaging.",
    source: "Podium 2022 Business Messaging Trends",
    url: "https://www.podium.com/guides/business-messaging-trends",
    reliability: "A",
  },
  followup_stops_early: {
    id: "followup_stops_early",
    claim:
      "(Tier B — do not state the raw percentages as fact.)",
    source: "IRC Sales Solutions / Brevet Group (widely cited, weak origin)",
    url: "https://ircsalessolutions.com/insights/sales-follow-up-statistics/",
    reliability: "B",
    softFraming:
      "Most leads need several touches before they buy, and most businesses stop after one or two.",
  },
};

/* ============================================================================
 * SECTION 5 — SCOPE + FIX MODEL
 * ==========================================================================*/

export type Scope =
  /** Fixed inside the client's GHL sub-account (Kevin's DFY build) */
  | "ghl"
  /** Fixed by deploying LeadGate on their site/funnel */
  | "leadgate"
  /** Real problem, NOT something LaunchGrid fixes. "Also worth knowing"
   *  section ONLY. Never a recommendation, never in the roadmap. */
  | "out_of_scope";

export type DeliverableTarget =
  | "cold_audit"          // pre-call ammo (top 3, most provable)
  | "growth_leak_report"  // deliverable 1 — diagnosis + scorecard + ranked leaks
  | "blueprint"           // deliverable 2 — 11-stage funnel + pipeline + scoring
  | "asset_pack"          // deliverable 3 — ready-to-paste copy assets
  | "roadmap";            // deliverable 4 — 90-day phased execution plan

/** The 9 scorecard areas of the Growth Leak Report. Claude Code: in Phase 0,
 *  reconcile these with the areas currently hard-coded in the generator —
 *  map existing names onto these ids, flag any mismatch, do NOT silently
 *  rename areas in shipped deliverables. */
export type ScorecardArea =
  | "response_speed"
  | "call_capture"
  | "after_hours_coverage"
  | "online_booking"
  | "lead_qualification"
  | "follow_up_nurture"
  | "show_rate_protection"
  | "pipeline_tracking"
  | "reputation_social_proof";

/* ============================================================================
 * SECTION 6 — THE LEAK DEFINITION
 * ==========================================================================*/

export interface Leak {
  id: string;
  name: string;
  scope: Scope;
  scorecardArea: ScorecardArea | null; // null for out_of_scope
  /** What the owner experiences, in plain language. Used as the leak headline. */
  symptom: string;

  /**
   * Detection: when does this leak fire, and at what tier?
   * Expressed as ordered rules — first match wins. If NO rule matches,
   * the leak does not appear at all.
   * Claude Code implements these as pure functions over ScrapeData.
   */
  detection: Array<{
    tier: EvidenceTier;
    /** Human-readable condition. Implement exactly this logic. */
    when: string;
  }>;

  /**
   * Why this costs money — the causal chain, written hedged.
   * The generator uses this as the base narrative and inserts stats
   * from statIds. Never add numbers beyond statIds.
   */
  revenueMechanism: string;

  /** Approved stats this leak may cite. Empty array = cite nothing;
   *  use pattern language only. */
  statIds: string[];

  /** Base impact weight 1–10 (before tier + vertical multipliers).
   *  Reflects revenue leverage, not detectability. */
  impactWeight: number;

  /** Verticals where this leak deserves extra weight (×1.2) and why. */
  verticalBoost?: Partial<Record<Vertical, string>>;

  /**
   * THE FIX — exactly what Kevin builds. Maps 1:1 to the DFY build spec
   * in the LaunchGrid Model. This string flows into the roadmap
   * ("Fix: ...") and the proposal ("[leak] → [asset] → [effect]").
   */
  ghlFix: {
    /** Short name used in roadmap/proposal line items */
    assetName: string;
    /** What actually gets built, concretely */
    build: string;
    /** Which roadmap phase it ships in (1=Foundation, 2=Infrastructure,
     *  3=Launch, 4=Optimization) */
    roadmapPhase: 1 | 2 | 3 | 4;
    /** Which Conversion Asset Pack items it consumes, if any */
    assetPackItems?: string[];
  } | null; // null ONLY for out_of_scope

  /** Where this leak is allowed to appear */
  deliverableTargets: DeliverableTarget[];

  /** Dollar-math template. See MATH RULES at bottom of file.
   *  null = no dollar estimate for this leak (qualitative only). */
  mathTemplate:
    | "missed_call_value"
    | "response_speed_value"
    | "follow_up_value"
    | "no_show_value"
    | "spend_anchored" // pre-intake fallback: anchor to ad-spend/CPL, not revenue
    | null;
}

/* ============================================================================
 * SECTION 7 — THE TAXONOMY
 * In-scope leaks first (GHL / LeadGate), then out-of-scope flags.
 * ==========================================================================*/

export const LEAKS: Leak[] = [
  /* ------------------------------------------------------------------
   * CLUSTER A — RESPONSE SPEED
   * ----------------------------------------------------------------*/
  {
    id: "slow_speed_to_lead",
    name: "Slow response to web leads",
    scope: "ghl",
    scorecardArea: "response_speed",
    symptom:
      "Someone fills out the website form and waits hours — or days — for a reply. By then they've called someone else.",
    detection: [
      {
        tier: "EVIDENCED",
        when:
          "website.hasContactForm AND >=2 reviews match REVIEW_SIGNALS.slowResponse",
      },
      {
        tier: "BENCHMARK",
        when:
          "website.hasContactForm AND no chat widget AND no visible instant-response mechanism (no 'we reply in X minutes' claim on contact page text)",
      },
    ],
    revenueMechanism:
      "A form fill is a buyer at peak intent. Every hour of silence, the odds of ever reaching them collapse — and most businesses take one to two days to reply. The leads most likely to close are the ones answered in minutes.",
    statIds: [
      "speed_5min_21x",
      "speed_avg_response_42h",
      "speed_close_32_vs_12",
      "consumer_expect_immediate",
    ],
    impactWeight: 9,
    verticalBoost: {
      law: "Law firms average 8+ hour response times and ~35% of inquiries get no response — use law_response_8h instead of the generic average.",
    },
    ghlFix: {
      assetName: "Instant lead response",
      build:
        "GHL workflow: form/webhook submission triggers an SMS + email reply within ~1 minute, from the business's number and sending domain, with a booking link. Wired during the DFY build (step 4 of the build spec).",
      roadmapPhase: 1,
      assetPackItems: ["Booking confirmation email", "First-touch SMS copy"],
    },
    deliverableTargets: [
      "cold_audit",
      "growth_leak_report",
      "blueprint",
      "asset_pack",
      "roadmap",
    ],
    mathTemplate: "response_speed_value",
  },

  {
    id: "missed_calls_no_recovery",
    name: "Missed calls with no recovery",
    scope: "ghl",
    scorecardArea: "call_capture",
    symptom:
      "Calls hit voicemail when the team is on a job, with a patient, or in court — and nothing happens next. The caller dials the next business on the list.",
    detection: [
      {
        tier: "EVIDENCED",
        when: ">=2 reviews match REVIEW_SIGNALS.missedCalls",
      },
      {
        tier: "BENCHMARK",
        when:
          "business.phone exists AND website.mentionsTextingOption is false (no visible recovery path). Use the industry-specific missed-call rate from missed_rate_by_industry.",
      },
    ],
    revenueMechanism:
      "A meaningful share of inbound calls go unanswered in every local business, and callers who hit voicemail overwhelmingly do not call back — they call a competitor. Each missed call is a lead that was already paid for, lost silently.",
    statIds: [
      "missed_rate_by_industry",
      "missed_voicemail_85",
      "missed_abandon_competitor",
      "calls_convert_10x_web",
    ],
    impactWeight: 10,
    verticalBoost: {
      dental: "Healthcare has the highest missed-call rate (~32%).",
      law: "Legal missed-call rate ~28%; matter values make each miss expensive.",
      hvac: "Seasonal surges spike call volume past front-desk capacity.",
    },
    ghlFix: {
      assetName: "Missed-call text-back",
      build:
        "GHL workflow: any unanswered call to the tracked number fires an immediate SMS ('Sorry we missed you — want to book or get a quote? [link]'), creates the contact in the pipeline, and notifies the owner. Dedicated GHL number provisioned per the onboarding SOP.",
      roadmapPhase: 1,
      assetPackItems: ["Missed-call recovery SMS copy"],
    },
    deliverableTargets: [
      "cold_audit",
      "growth_leak_report",
      "blueprint",
      "asset_pack",
      "roadmap",
    ],
    mathTemplate: "missed_call_value",
  },

  {
    id: "no_after_hours_coverage",
    name: "No after-hours capture",
    scope: "ghl",
    scorecardArea: "after_hours_coverage",
    symptom:
      "Demand doesn't stop at 5pm — a big share of calls and inquiries arrive evenings and weekends, and right now they land on a closed door.",
    detection: [
      {
        tier: "OBSERVED",
        when:
          "gbp.limitedHours is true AND website.hasOnlineBookingLink is false AND website.hasChatWidget is false (limited hours are observed facts; the absence of any 24/7 capture path is observed)",
      },
      {
        tier: "BENCHMARK",
        when:
          "gbp.hoursListed is false AND no 24/7 capture path detected on site",
      },
    ],
    revenueMechanism:
      "A large share of local-service calls arrive outside business hours. Without an after-hours capture path, those leads either book with whoever answers or go cold by morning.",
    statIds: ["after_hours_28_43", "missed_voicemail_85"],
    impactWeight: 8,
    verticalBoost: {
      hvac: "Emergency calls (no heat, no AC) are disproportionately after-hours and high-value.",
      plumbing: "Same emergency dynamic as HVAC.",
    },
    ghlFix: {
      assetName: "After-hours coverage",
      build:
        "GHL: after-hours auto-response on calls and messages (acknowledges, qualifies via LeadGate link or quick questions, offers booking), routed so the owner sees qualified emergencies immediately and everything else is booked or queued for morning.",
      roadmapPhase: 2,
    },
    deliverableTargets: [
      "cold_audit",
      "growth_leak_report",
      "blueprint",
      "roadmap",
    ],
    mathTemplate: "missed_call_value",
  },

  /* ------------------------------------------------------------------
   * CLUSTER B — CAPTURE & QUALIFICATION
   * ----------------------------------------------------------------*/
  {
    id: "no_online_booking",
    name: "No online booking path",
    scope: "ghl",
    scorecardArea: "online_booking",
    symptom:
      "The only way to become a customer is to call during business hours. Anyone who prefers to book online — or is browsing at 9pm — can't.",
    detection: [
      {
        tier: "OBSERVED",
        when:
          "website.hasOnlineBookingLink is false AND gbp.hasBookingLink is false",
      },
    ],
    revenueMechanism:
      "Every extra step between interest and a booked slot loses a share of buyers. With no self-serve booking, all demand funnels through the phone — which is exactly where the missed-call and after-hours leaks bite. Competitors with one-click booking capture the convenience-driven segment by default.",
    statIds: ["consumer_expect_immediate"],
    impactWeight: 7,
    verticalBoost: {
      med_spa: "Consumer-style buyers expect Instagram-to-booking in two taps.",
      dental: "New-patient bookings are routinely lost to practices with online scheduling.",
    },
    ghlFix: {
      assetName: "Online booking system",
      build:
        "GHL calendar connected to the client's real calendar, booking page/widget embedded on the site, booking link added to the Google Business Profile. Pipeline stage auto-updates to 'booked'. (Onboarding SOP: if they have no booking tool, we set one up as part of the build.)",
      roadmapPhase: 1,
      assetPackItems: ["Booking confirmation email"],
    },
    deliverableTargets: [
      "cold_audit",
      "growth_leak_report",
      "blueprint",
      "asset_pack",
      "roadmap",
    ],
    mathTemplate: null,
  },

  {
    id: "no_webchat",
    name: "No website chat capture",
    scope: "ghl",
    scorecardArea: "call_capture",
    symptom:
      "Visitors with a quick question have two options: call, or leave. There's no low-friction way to start a conversation from the site.",
    detection: [
      {
        tier: "OBSERVED",
        when: "website exists AND website.hasChatWidget is false",
      },
    ],
    revenueMechanism:
      "A chunk of buyers won't call — they want to text. A chat widget that bridges to SMS captures those conversations and keeps them alive after the visitor leaves the site. Without it, that segment bounces silently.",
    statIds: ["texting_switch_40"],
    impactWeight: 5,
    ghlFix: {
      assetName: "Webchat-to-SMS widget",
      build:
        "GHL webchat widget installed on the site: visitor starts a chat, it converts to an SMS thread with the business's GHL number, contact is created in the pipeline, and the standard follow-up automation takes over if they go quiet.",
      roadmapPhase: 2,
    },
    deliverableTargets: ["growth_leak_report", "blueprint", "roadmap"],
    mathTemplate: null,
  },

  {
    id: "no_lead_qualification",
    name: "No lead qualification at intake",
    scope: "leadgate",
    scorecardArea: "lead_qualification",
    symptom:
      "Every inquiry — tire-kicker or $20k job — lands in the same pile. The owner spends selling time sorting instead of closing.",
    detection: [
      {
        tier: "OBSERVED",
        when:
          "website.hasContactForm is true AND website.formHasQualifyingFields is false",
      },
      {
        tier: "BENCHMARK",
        when:
          "website.hasContactForm is false AND no chat widget (all intake is raw phone — qualification is whoever answers)",
      },
    ],
    revenueMechanism:
      "Unqualified intake wastes the most expensive resource in the business — the owner's selling time — and lets high-value leads sit in the same queue as spam. Qualifying at the front door (job type, budget, timeline, service area) means the best leads get the fastest attention.",
    statIds: [],
    impactWeight: 7,
    ghlFix: {
      assetName: "LeadGate qualification front-end",
      build:
        "Deploy LeadGate on their site/funnel, configured for their vertical (job type, budget, timeline, service-area questions per the DFY build spec). Qualified leads webhook into the GHL sub-account tagged with a score tier; routing and speed of follow-up keyed to the tier.",
      roadmapPhase: 2,
    },
    deliverableTargets: [
      "growth_leak_report",
      "blueprint",
      "roadmap",
    ],
    mathTemplate: null,
  },

  {
    id: "weak_landing_cta",
    name: "Weak landing page conversion path",
    scope: "ghl",
    scorecardArea: "lead_qualification",
    symptom:
      "Traffic arrives, reads, and leaves. The page doesn't tell visitors what to do next — no clear primary action, buried phone number, generic 'contact us'.",
    detection: [
      {
        tier: "OBSERVED",
        when:
          "website.hasPrimaryCtaAboveFold is false OR website.servicePagesHaveCtas is false OR website.hasClickToCallOnMobile is false",
      },
    ],
    revenueMechanism:
      "The site already gets the visit — the page just doesn't convert it. A clear primary action above the fold, click-to-call on mobile, and a distinct CTA per service page turn existing traffic into inquiries without a dollar more ad spend. This is the cheapest conversion gain on the list because the demand is already there.",
    statIds: [],
    impactWeight: 6,
    ghlFix: {
      assetName: "Landing page conversion fixes",
      build:
        "Apply the Conversion Asset Pack landing fixes (build spec step 3): rewritten headline (3 options provided), primary CTA above the fold, click-to-call, service-page CTAs — implemented on their CMS with Editor access per the onboarding access matrix. Copy-level and CTA-level changes only; no site redesign.",
      roadmapPhase: 1,
      assetPackItems: ["Landing page copy — 3 headline options", "CTA blocks"],
    },
    deliverableTargets: [
      "cold_audit",
      "growth_leak_report",
      "asset_pack",
      "roadmap",
    ],
    mathTemplate: null,
  },

  /* ------------------------------------------------------------------
   * CLUSTER C — FOLLOW-THROUGH
   * ----------------------------------------------------------------*/
  {
    id: "no_follow_up_sequence",
    name: "No structured follow-up on unbooked leads",
    scope: "ghl",
    scorecardArea: "follow_up_nurture",
    symptom:
      "A lead says 'let me think about it' — and that's the last touch they ever get. No second call, no email, no text.",
    detection: [
      {
        tier: "EVIDENCED",
        when: ">=2 reviews match REVIEW_SIGNALS.noFollowUp",
      },
      {
        tier: "BENCHMARK",
        when:
          "ALWAYS fires at benchmark tier for any business where intake.hasFollowUpSequence is not true. This process is invisible from outside — the deliverable MUST use the kickoff-verification hedge (see language rules).",
      },
    ],
    revenueMechanism:
      "Most leads need several touches before they buy, and most businesses stop after one or two. The leads that don't book on day one aren't dead — they're undecided. A structured multi-touch sequence recovers a share of them at zero additional acquisition cost. For most businesses this is the single largest recoverable leak.",
    statIds: ["followup_stops_early", "speed_avg_response_42h"],
    impactWeight: 10,
    verticalBoost: {
      law: "Only ~14% of law inquiries convert on average vs 40–50% at top firms — the gap is follow-through (law_convert_14).",
      dental: "Case acceptance averages ~42% vs ~75% for top practices — unfollowed treatment plans are the gap (dental_case_acceptance).",
      roofing: "Multi-quote buying process; the roofer still in the inbox on decision day wins.",
    },
    ghlFix: {
      assetName: "Multi-touch follow-up engine",
      build:
        "GHL workflows from the Conversion Asset Pack: the 7-email nurture + 6 follow-up texts deployed as automated sequences, triggered when a lead doesn't book within a set window. Stops automatically on booking or reply. (Build spec step 4.)",
      roadmapPhase: 2,
      assetPackItems: ["7-email nurture sequence", "6 follow-up texts"],
    },
    deliverableTargets: [
      "cold_audit",
      "growth_leak_report",
      "blueprint",
      "asset_pack",
      "roadmap",
    ],
    mathTemplate: "follow_up_value",
  },

  {
    id: "no_show_exposure",
    name: "No-show exposure on booked appointments",
    scope: "ghl",
    scorecardArea: "show_rate_protection",
    symptom:
      "Appointments get booked, then a chunk of them simply don't show — an empty chair or a wasted drive, with no reminder system working to prevent it.",
    detection: [
      {
        tier: "EVIDENCED",
        when: ">=2 reviews match REVIEW_SIGNALS.schedulingFriction",
      },
      {
        tier: "BENCHMARK",
        when:
          "Vertical is dental, med_spa, or law AND intake.hasReminderSystem is not true. Reminder systems are invisible externally — kickoff-verification hedge required.",
      },
    ],
    revenueMechanism:
      "A booked appointment isn't revenue until they show. No-show rates in appointment-driven businesses are material, and every no-show is fully-paid-for demand wasted at the last step. Confirmation plus timed reminders plus a recovery flow for misses claws a share of this back.",
    statIds: ["dental_no_show", "medspa_show_rate"],
    impactWeight: 8,
    verticalBoost: {
      dental: "No-show ~12–18%; new-patient first visits 25–30% (dental_no_show).",
      med_spa: "Show rate 70–85% — meaning 15–30% booked consults never arrive (medspa_show_rate).",
    },
    ghlFix: {
      assetName: "Show-rate protection",
      build:
        "GHL: booking confirmation immediately, reminder SMS/email at 24h and 2h, and a no-show recovery workflow that automatically offers a rebook link if the appointment status flips to no-show. (Build spec step 4.)",
      roadmapPhase: 2,
      assetPackItems: [
        "Booking confirmation email",
        "Reminder messages",
      ],
    },
    deliverableTargets: [
      "growth_leak_report",
      "blueprint",
      "asset_pack",
      "roadmap",
    ],
    mathTemplate: "no_show_value",
  },

  {
    id: "no_crm_pipeline",
    name: "No pipeline — leads are untracked",
    scope: "ghl",
    scorecardArea: "pipeline_tracking",
    symptom:
      "Leads live in a notebook, an inbox, or nowhere. Nobody can say how many inquiries came in last month or what happened to them.",
    detection: [
      {
        tier: "BENCHMARK",
        when:
          "Fires at benchmark tier unless intake.hasCrm is true. Invisible externally — kickoff-verification hedge required. If intake.hasCrm is true, suppress entirely.",
      },
    ],
    revenueMechanism:
      "What isn't tracked can't be fixed. Without a pipeline there is no missed-call count, no follow-up completion rate, no lead-to-booked number — which means leaks stay invisible and every 'how's marketing going' answer is a guess. The pipeline is also the rail every other fix on this list runs on.",
    statIds: [],
    impactWeight: 6,
    ghlFix: {
      assetName: "CRM pipeline",
      build:
        "GHL pipeline with the standard stages (new → qualified → booked → showed → won) per build spec step 5, every lead source wired in, owner gets a limited dashboard login at go-live per the access SOP.",
      roadmapPhase: 1,
    },
    deliverableTargets: ["growth_leak_report", "blueprint", "roadmap"],
    mathTemplate: null,
  },

  {
    id: "no_database_reactivation",
    name: "Dormant customer database",
    scope: "ghl",
    scorecardArea: "follow_up_nurture",
    symptom:
      "Years of past customers and old quotes sit in a spreadsheet or an inbox — and nobody has contacted them since the job ended.",
    detection: [
      {
        tier: "BENCHMARK",
        when:
          "Fires at benchmark tier for any established business (googleReviews.count >= 20 used as a proxy for operating history) unless intake.hasPastCustomerDatabase is false. Hedge: framed as 'if you have a past-customer list, it is almost certainly your cheapest revenue'.",
      },
    ],
    revenueMechanism:
      "Past customers already trust the business — reactivating them costs a text, not an ad budget. A one-time reactivation campaign to old customers and unclosed quotes typically produces the fastest visible win of the entire engagement, which is why it ships early.",
    statIds: [],
    impactWeight: 7,
    verticalBoost: {
      hvac: "Maintenance/tune-up reactivation is seasonal and near-automatic.",
      dental: "Recall of lapsed patients is a standing revenue pool.",
      med_spa: "Repeat-treatment cadence makes lapsed clients highly winnable.",
    },
    ghlFix: {
      assetName: "Database reactivation campaign",
      build:
        "Import their past-customer/old-quote list into GHL (collected at intake), run a compliant reactivation SMS/email campaign with a booking link, route replies into the pipeline. CASL-compliant sending per the outreach compliance rules.",
      roadmapPhase: 3,
    },
    deliverableTargets: ["growth_leak_report", "blueprint", "roadmap"],
    mathTemplate: null,
  },

  {
    id: "no_long_cycle_nurture",
    name: "No long-cycle nurture for 'not yet' leads",
    scope: "ghl",
    scorecardArea: "follow_up_nurture",
    symptom:
      "Leads who said 'not right now' vanish from the system. When their trigger finally hits — the furnace dies, the case becomes urgent — the business isn't in their inbox.",
    detection: [
      {
        tier: "BENCHMARK",
        when:
          "Fires at benchmark tier alongside no_follow_up_sequence (same invisibility, same hedge). If the generator has already surfaced no_follow_up_sequence, this leak appears in the Blueprint/Roadmap as the long-cycle extension of that fix rather than as a separate report leak — avoid double-counting the same dollar estimate.",
      },
    ],
    revenueMechanism:
      "The immediate follow-up sequence handles the next two weeks; long-cycle nurture handles the next twelve months. One value touch a month keeps the business first-in-mind when the buying trigger hits, at near-zero cost.",
    statIds: ["followup_stops_early"],
    impactWeight: 5,
    ghlFix: {
      assetName: "Long-cycle nurture drip",
      build:
        "GHL: monthly value-touch email drip for leads tagged 'not yet' — useful content, seasonal reminders, one soft CTA. Auto-exits on reply or booking.",
      roadmapPhase: 4,
    },
    deliverableTargets: ["blueprint", "roadmap"],
    mathTemplate: null,
  },

  /* ------------------------------------------------------------------
   * CLUSTER D — REPUTATION & SOCIAL PROOF (conversion side)
   * ----------------------------------------------------------------*/
  {
    id: "low_review_velocity",
    name: "Review generation lagging competitors",
    scope: "ghl",
    scorecardArea: "reputation_social_proof",
    symptom:
      "Happy customers finish the job and leave — nobody asks them for a review. Meanwhile the competitor down the street adds ten a month.",
    detection: [
      {
        tier: "OBSERVED",
        when:
          "googleReviews.recentCount90d is low relative to competitor median (e.g., < 50% of the median competitor's implied velocity) OR googleReviews.count < 50% of median competitor reviewCount. Both sides of the comparison are observed data — state the actual numbers.",
      },
    ],
    revenueMechanism:
      "Buyers comparing two local businesses at the decision moment lean on review count, recency, and rating. When a competitor shows triple the recent reviews, a share of ready-to-buy demand defaults to them. Automating the ask after every completed job closes the gap without the owner lifting a finger.",
    statIds: [],
    impactWeight: 6,
    verticalBoost: {
      roofing: "Highest-distrust trade — social proof carries the most weight at the decision moment.",
    },
    ghlFix: {
      assetName: "Automated review engine",
      build:
        "GHL workflow: job marked complete (pipeline stage → won) triggers a review-request SMS/email with the direct Google review link, one polite reminder if no action, requests logged. Uses the review-request templates from the Conversion Asset Pack. GBP Manager access per onboarding SOP.",
      roadmapPhase: 3,
      assetPackItems: ["Review-request templates"],
    },
    deliverableTargets: [
      "cold_audit",
      "growth_leak_report",
      "asset_pack",
      "roadmap",
    ],
    mathTemplate: null,
  },

  {
    id: "unanswered_reviews",
    name: "Reviews left unanswered",
    scope: "ghl",
    scorecardArea: "reputation_social_proof",
    symptom:
      "Customers — including unhappy ones — leave reviews and hear nothing back. Every prospect reading the page sees the silence.",
    detection: [
      {
        tier: "OBSERVED",
        when:
          "googleReviews.ownerResponseRate < 0.3 AND googleReviews.count >= 10. State the observed rate.",
      },
    ],
    revenueMechanism:
      "Review pages are read by prospects at the exact moment of choosing. An owner who visibly responds — especially to negative reviews — signals reliability; silence reads as indifference. This is a conversion signal at the decision point, and it compounds with review velocity.",
    statIds: [],
    impactWeight: 4,
    ghlFix: {
      assetName: "Review response workflow",
      build:
        "GHL reputation inbox: new reviews surface for response, response templates provided (positive / neutral / negative), handled as part of the monthly retainer's running of the system.",
      roadmapPhase: 4,
    },
    deliverableTargets: ["growth_leak_report", "roadmap"],
    mathTemplate: null,
  },

  /* ------------------------------------------------------------------
   * CLUSTER E — CHANNEL & MEASUREMENT
   * ----------------------------------------------------------------*/
  {
    id: "social_dm_unmanaged",
    name: "Social DMs outside the system",
    scope: "ghl",
    scorecardArea: "call_capture",
    symptom:
      "Facebook and Instagram messages sit in an app nobody checks between jobs. DM inquiries get the slowest response of any channel — or none.",
    detection: [
      {
        tier: "BENCHMARK",
        when:
          "website.linksToFacebook OR website.linksToInstagram (presence of the channel is observed; response behavior is not — hedge accordingly: 'if DMs aren't flowing into one inbox, they're almost certainly the slowest-answered channel you have').",
      },
    ],
    revenueMechanism:
      "DM inquiries are the same buyers as callers, arriving on a channel with no missed-call log and no voicemail — a slow DM just disappears. Routing FB/IG messages into the same inbox and automation as calls and forms gives them the same response speed and the same follow-up.",
    statIds: ["consumer_expect_immediate"],
    impactWeight: 5,
    verticalBoost: {
      med_spa: "Instagram DMs are a primary booking channel for this vertical — boost applies.",
    },
    ghlFix: {
      assetName: "Unified social inbox",
      build:
        "Connect the Facebook page / Instagram account to GHL via Meta Business partner access (per onboarding access matrix): DMs land in the same GHL conversation inbox, auto-acknowledge fires, contacts enter the pipeline and standard follow-up.",
      roadmapPhase: 3,
    },
    deliverableTargets: ["growth_leak_report", "blueprint", "roadmap"],
    mathTemplate: null,
  },

  {
    id: "no_call_tracking",
    name: "No visibility into call performance",
    scope: "ghl",
    scorecardArea: "pipeline_tracking",
    symptom:
      "Nobody knows how many calls came in last month, how many were missed, or what time of day they're lost. The leak can't be seen, so it can't be managed.",
    detection: [
      {
        tier: "BENCHMARK",
        when:
          "Fires at benchmark tier for all pre-intake businesses (call-tracking presence is not externally visible). Position as the measurement layer that makes every other fix provable — not as a standalone revenue leak.",
      },
    ],
    revenueMechanism:
      "Every other leak on this list becomes measurable the day a tracked number goes live: answered vs missed, after-hours share, recovery rate. This is how the engagement proves its own before/after — with the client's real numbers instead of industry benchmarks.",
    statIds: [],
    impactWeight: 4,
    ghlFix: {
      assetName: "Call tracking & reporting",
      build:
        "GHL tracked number as the public-facing line (or forwarded), call outcomes logged to the pipeline, monthly report shows answered/missed/recovered — the baseline metrics from the client-success SOP (missed-call rate, after-hours exposure, lead-to-booked).",
      roadmapPhase: 1,
    },
    deliverableTargets: ["growth_leak_report", "blueprint", "roadmap"],
    mathTemplate: null,
  },

  {
    id: "payment_booking_friction",
    name: "Friction between 'yes' and paid",
    scope: "ghl",
    scorecardArea: "online_booking",
    symptom:
      "A lead agrees to the job — then the deposit means an e-transfer request, a mailed invoice, or 'we'll sort it at the appointment'. Some yeses evaporate in that gap.",
    detection: [
      {
        tier: "BENCHMARK",
        when:
          "Vertical is roofing, contractor_general, hvac, plumbing, or med_spa (deposit-taking verticals) AND no online payment/deposit mechanism visible on site. Hedge: payment process is mostly invisible externally.",
      },
    ],
    revenueMechanism:
      "Commitment decays with every hour between verbal yes and money down. A text-to-pay deposit link sent the moment they agree converts the yes while it's hot and slashes later cancellations — the deposit is the real close.",
    statIds: [],
    impactWeight: 5,
    verticalBoost: {
      roofing: "Large job values make deposit-securing disproportionately valuable.",
    },
    ghlFix: {
      assetName: "Text-to-pay deposits",
      build:
        "GHL invoicing + payment links (Stripe-backed): 'yes' on the call triggers an SMS with a deposit link, payment auto-moves the pipeline stage to won, receipt and booking confirmation fire automatically.",
      roadmapPhase: 3,
    },
    deliverableTargets: ["growth_leak_report", "blueprint", "roadmap"],
    mathTemplate: null,
  },

  /* ------------------------------------------------------------------
   * OUT OF SCOPE — detected, flagged, NEVER sold as a LaunchGrid fix.
   * These appear ONLY in the report's "Also worth knowing" section.
   * They exist because ignoring an obviously slow or dated site would
   * make the report read as blind — but they are not the engagement.
   * ----------------------------------------------------------------*/
  {
    id: "oos_slow_site_speed",
    name: "Slow site performance",
    scope: "out_of_scope",
    scorecardArea: null,
    symptom:
      "The site loads slowly on mobile, which costs some share of visitors before the page even renders.",
    detection: [
      {
        tier: "OBSERVED",
        when: "pageSpeed.mobileScore < 50 OR pageSpeed.lcpSeconds > 4",
      },
    ],
    revenueMechanism:
      "Noted for completeness: site speed affects how much traffic survives to see the page. It sits on the traffic/site side of the line — outside this engagement, worth raising with whoever manages the website.",
    statIds: [],
    impactWeight: 3,
    ghlFix: null,
    deliverableTargets: ["growth_leak_report"],
    mathTemplate: null,
  },
  {
    id: "oos_dated_site_design",
    name: "Site presentation trails competitors",
    scope: "out_of_scope",
    scorecardArea: null,
    symptom:
      "Side-by-side with local competitors, the site's design reads as noticeably older, which can undercut trust before a word is read.",
    detection: [
      {
        tier: "OBSERVED",
        when:
          "Screenshot comparison flags a clear generational design gap vs competitor median. Conservative threshold — when in doubt, do not fire. Subjective calls get hedged phrasing ('may read as dated next to...').",
      },
    ],
    revenueMechanism:
      "Noted for completeness: overall site design is a trust signal we don't rebuild. The landing-page copy and CTA fixes in this engagement improve conversion within the existing design; a full redesign is a separate decision for a web vendor.",
    statIds: [],
    impactWeight: 2,
    ghlFix: null,
    deliverableTargets: ["growth_leak_report"],
    mathTemplate: null,
  },
  {
    id: "oos_gbp_visibility_gaps",
    name: "Google Business Profile visibility gaps",
    scope: "out_of_scope",
    scorecardArea: null,
    symptom:
      "The Google listing is missing elements that affect how often it appears — photos, posts, complete categories.",
    detection: [
      {
        tier: "OBSERVED",
        when:
          "GBP data shows sparse photos/posts/attributes relative to competitors. (Note: the GBP booking link and review response ARE in scope and covered by no_online_booking / unanswered_reviews — this flag covers only the visibility/discovery side.)",
      },
    ],
    revenueMechanism:
      "Noted for completeness: profile completeness influences discovery — how many people find the listing. Discovery is lead generation, which is outside this engagement. The conversion elements of the profile (booking link, review responses) are handled by the fixes above.",
    statIds: [],
    impactWeight: 2,
    ghlFix: null,
    deliverableTargets: ["growth_leak_report"],
    mathTemplate: null,
  },
];

/* ============================================================================
 * SECTION 8 — SELECTION, RANKING & MATH RULES
 * The generator implements exactly this. No other selection logic.
 * ==========================================================================*/

export const RULES = {
  selection: [
    "Run every leak's detection rules against ScrapeData. First matching rule sets the tier. No match = leak does not exist for this business.",
    "If intake data explicitly contradicts a BENCHMARK leak (e.g., intake.hasCrm === true), suppress the leak entirely.",
    "no_long_cycle_nurture never appears in the report when no_follow_up_sequence has fired — it folds into that fix in the Blueprint/Roadmap instead (no double-counted dollars).",
  ],

  ranking: [
    "score = impactWeight × TIER_MULTIPLIER[tier] × (verticalBoost applies ? 1.2 : 1.0)",
    "Growth Leak Report: all fired in-scope leaks, ranked by score descending.",
    "Cold audit: top 3 by score, BUT at least 2 of the 3 must be OBSERVED or EVIDENCED — pre-call ammo must be provable, not guessed. If fewer than 2 qualify, take the highest-scoring observable leaks even if lower-scored.",
    "Out-of-scope flags are never ranked against in-scope leaks and never counted in leak totals.",
  ],

  math: [
    "PRE-INTAKE (cold audit, pre-close deliverables): NO revenue-dollar claims about their business. Use spend-anchored framing only: industry CPL (cpl_google_ads) × the leak's benchmark rate, labeled 'industry benchmark — we'll run this with your real numbers'. Example shape: 'At the roofing benchmark of $228 per lead, a 14% missed-call rate on 50 monthly calls is roughly $1,600/month in paid-for demand going unanswered — benchmark figures, not your books.'",
    "POST-INTAKE: dollar math may use intake.avgJobValueCad and real volumes. Formula per template:",
    "  missed_call_value: monthlyCallVolume × industryMissedRate × 0.85 (never-call-back) × conservativeCloseRate × avgJobValueCad — every factor cited or client-provided, result labeled 'estimated'.",
    "  response_speed_value: qualitative delta framing using speed_close_32_vs_12; do NOT build a fabricated multiplier chain.",
    "  follow_up_value: pattern framing (followup_stops_early softFraming) + the vertical's conversion-gap stat (law_convert_14 / dental_case_acceptance) where applicable. No invented percentages.",
    "  no_show_value: bookedAppointments × verticalNoShowRate × avgJobValueCad, labeled estimated.",
    "ALWAYS use the conservative end of any range. ALWAYS label estimates as estimates. NEVER present a projection as a guarantee.",
  ],

  language: [
    "OBSERVED: state as fact, cite the observed data point ('Your site has no online booking path; two of three nearby competitors offer one.').",
    "EVIDENCED: state the signal first, then the inference ('Three reviews from the last six months mention calls that weren't returned — a strong sign inbound calls are being missed.'). Quote at most a short fragment of any review.",
    "BENCHMARK: mandatory shape — acknowledge invisibility, state the industry pattern with its stat or softFraming, add the kickoff-verification line ('We verify this together at kickoff — if you already have this covered, it comes off the list.').",
    "Hedged verbs throughout for anything not OBSERVED: 'likely', 'may', 'typically', 'if that's true here'.",
    "Banned words and structures per words_to_avoid.md apply to ALL generated deliverable text. No hype verbs, no binary reframes, no invented results, no fabricated testimonials.",
    "Tier B stats: use softFraming string, never the raw percentage.",
  ],
} as const;

/* ============================================================================
 * SECTION 9 — DELIVERABLE ROUTING SUMMARY
 * How fired leaks flow into each artifact. Claude Code wires this in Phase 5.
 * ==========================================================================*/

export const DELIVERABLE_ROUTING = {
  cold_audit:
    "Top 3 leaks per ranking rules (provability constraint). Each: symptom + evidence line + one stat + spend-anchored cost frame. Purpose: pre-call ammo. No fix details beyond one sentence — the fix is the call.",
  growth_leak_report:
    "All fired in-scope leaks ranked by score, grouped under their scorecardArea (this drives the 9-area scorecard grades). Landing Page Conversion Intelligence section consumes weak_landing_cta detail. 'Also worth knowing' section = fired out_of_scope flags, clearly framed as outside the engagement.",
  blueprint:
    "Each fired leak maps to its position in the 11-stage funnel; ghlFix.assetName populates the infrastructure at that stage. Lead-scoring tiers reference no_lead_qualification's LeadGate config. Pipeline section always reflects no_crm_pipeline's stage set.",
  asset_pack:
    "Only assetPackItems from FIRED leaks are generated/customized. A leak that didn't fire contributes no assets — this is what stops the pack from padding.",
  roadmap:
    "Fired leaks' ghlFix entries slot into their roadmapPhase within the 4 phases (Foundation → Infrastructure → Launch → Optimization), ordered by score within each phase. Each task line: assetName → the leak it plugs → success marker.",
} as const;
