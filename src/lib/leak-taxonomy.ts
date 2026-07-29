/**
 * ============================================================================
 * RECLAIMEDHQ LEAK TAXONOMY — SINGLE SOURCE OF TRUTH
 * ============================================================================
 *
 * PURPOSE
 * This file is the ONLY place leaks are defined. The deliverable generator
 * (Growth Leak Report, Blueprint, Conversion Asset Pack, 90-Day Roadmap)
 * and the cold audit MUST select exclusively from this list. If a leak is
 * not in this file, it cannot appear in any output. This is what prevents
 * the generator from inventing problems ReclaimedHQ cannot fix in
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
 * 5. scope: "out_of_scope" leaks are NEVER presented as things ReclaimedHQ
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

// The grade vocabulary is declared ONCE, in src/types, because a saved pack
// carries it too (LeakAnalysisItem.evidenceGrade / ColdAuditFinding.evidenceGrade).
// It is imported here — never redeclared — and re-exported below so a consumer
// that already imports this file's evidence vocabulary (EvidenceTier,
// EvidenceClass) can get the grade from the same place instead of a second import.
import type { EvidenceGrade } from "@/types";
// TYPE-ONLY, so nothing is imported at runtime and no module cycle exists:
// leak-detection.ts imports the taxonomy's values, the taxonomy borrows only its
// result shape back. inferredGaps() reads fired leaks, so it needs the shape.
import type { FiredLeak } from "./leak-detection";

export type { EvidenceGrade };

/* ============================================================================
 * SECTION 1 — INPUT DATA CONTRACT
 * What the ReclaimedHQ research pipeline already collects per business.
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
    /** Share of reviews with an owner reply, 0–1.
     *  NOT POPULATED TODAY. The DataForSEO reviews response we parse
     *  (DfsReviewItem in dataforseo.ts) carries only rating / review_text /
     *  timestamp — there is no owner-reply field in what we fetch, so the
     *  adapter writes the -1 "unknown" sentinel. The slot is kept so the
     *  contract doesn't churn if the scraping layer starts supplying it; no
     *  leak reads it (see the unanswered_reviews removal note in Cluster D).
     *
     *  THE RESPONSIVENESS FINDING IS BACK AND STILL DOES NOT READ THIS FIELD.
     *  no_review_replies fires off the client's own answer (intake.reviewReplyOwner)
     *  and nothing else, which is why it can only ever be graded "disclosed". If
     *  this number ever becomes real, that leak gains an OBSERVED branch — until
     *  then, reading a -1 sentinel as "nobody replies" is the exact defect that got
     *  the old leak deleted. */
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
  intake?: ClientIntake;
}

/**
 * What the client themselves told us, at intake. Every field is optional because
 * every deliverable must still render without any of it.
 *
 * THE THREE-WAY CONTRACT, used identically by every field here. A detector reads
 * one of these answers and lands in exactly one of three states:
 *   · HANDLED   — they already have it. The leak is SUPPRESSED entirely; we never
 *                 sell a client a fix for something they told us they have.
 *   · CONFIRMED — they told us they don't. The leak fires carrying
 *                 intakeConfirmed, which makes the prose declarative and drops
 *                 the kickoff-verification hedge — they already answered the
 *                 question, so asking it again in the deliverable is an insult.
 *   · UNKNOWN   — not asked, or "not sure". Today's benchmark hedge, unchanged.
 */
export interface ClientIntake {
  avgJobValueCad?: number;
  /** INBOUND ENQUIRIES PER MONTH — every way a new potential customer reaches
   *  them. Consumed by missed_call_value, whose frame renders it verbatim as
   *  "N enquiries/mo". */
  monthlyEnquiries?: number;
  /** APPOINTMENTS ACTUALLY BOOKED PER MONTH. Consumed by no_show_value, whose
   *  frame renders it verbatim as "N booked/mo". NOT the same quantity as
   *  monthlyEnquiries and not derivable from it — we do not know this business's
   *  enquiry→booking ratio, so leaving this empty (which is the normal case: we
   *  never ask for a booking count) correctly drops no_show_value onto its
   *  benchmark path rather than printing an enquiry count back to a client as
   *  their booking count. These two slots used to be named the other way round,
   *  which is exactly how that bug shipped. */
  monthlyBookedAppointments?: number;
  adSpendMonthlyCad?: number;
  hasCrm?: boolean;
  hasFollowUpSequence?: boolean;
  hasReminderSystem?: boolean;
  hasPastCustomerDatabase?: boolean;
  /** "Do you track calls (answered vs missed) today?" — suppresses
   *  no_call_tracking when true, the same way hasCrm suppresses
   *  no_crm_pipeline. Undefined = not asked → the leak still fires hedged. */
  hasCallTracking?: boolean;
  /** "Can a customer pay or leave a deposit online today?" — suppresses
   *  payment_booking_friction when true. We never scan for a payment
   *  mechanism, so intake is the ONLY thing that can contradict this leak.
   *
   *  IT HAS EXACTLY ONE JOB, and `takesDeposits` below has the other one. This
   *  field must never reach the Text-to-Pay on/off rule — see the DO NOT MERGE
   *  note there for why running the two through one column inverts the answer. */
  hasOnlinePayment?: boolean;
  /** "What happens when someone calls or messages after hours?" — gates
   *  no_after_hours_coverage. AUTO_RESPONSE handles it; NEXT_MORNING and NOTHING
   *  confirm the gap; UNKNOWN hedges. */
  afterHoursHandling?: "AUTO_RESPONSE" | "NEXT_MORNING" | "NOTHING" | "UNKNOWN";
  /** "What happens when you miss a call?" — gates missed_calls_no_recovery.
   *  INSTANT_TEXT_BACK handles it; CALL_BACK_WHEN_FREE and VOICEMAIL_ONLY confirm
   *  the gap; UNKNOWN hedges. */
  missedCallHandling?:
    | "INSTANT_TEXT_BACK"
    | "CALL_BACK_WHEN_FREE"
    | "VOICEMAIL_ONLY"
    | "UNKNOWN";
  /** "How fast does a new enquiry usually get a reply?" — gates
   *  slow_speed_to_lead. UNDER_5_MIN handles it; FEW_HOURS and DAY_OR_TWO confirm
   *  the gap; NOT_TRACKED hedges. */
  responseSpeed?: "UNDER_5_MIN" | "FEW_HOURS" | "DAY_OR_TWO" | "NOT_TRACKED";
  /** "How do people book right now?" — gates no_online_booking. */
  bookingMethod?: "PHONE_EMAIL_ONLY" | "BOOKING_TOOL" | "OTHER";
  /** The named scheduler when bookingMethod = BOOKING_TOOL (e.g. "Calendly"). */
  bookingToolName?: string;
  /**
   * "Do enquiries come in through Instagram or Facebook messages?" — gates
   * social_dm_unmanaged, which before this field could never leave "inferred".
   *
   * THIS FIELD HAS TWO CONSUMERS AND THEY READ IT DIFFERENTLY. Anyone wiring the
   * second one needs the distinction spelled out, so it is spelled out here:
   *
   *   1. THE LEAK. YES confirms it — enquiries really do arrive as DMs and
   *      nothing catches them, so the fire is declarative and attributed. NO and
   *      NO_ACCOUNTS BOTH suppress it entirely: there is no leak in a channel
   *      that brings no enquiries. Undefined keeps today's benchmark hedge.
   *
   *   2. THE BUILD. NO_ACCOUNTS — and ONLY NO_ACCOUNTS — is the applicability
   *      fact that switches the Social DM Capture workflow OFF: there is no
   *      account to connect. "NO" does NOT switch it off. They HAVE the accounts,
   *      so the capture workflow still installs and simply sits quiet until a DM
   *      arrives; removing it would leave that channel uncovered the first time
   *      one does.
   */
  socialEnquiries?: "YES" | "NO" | "NO_ACCOUNTS";
  /**
   * "When did you last contact past customers or old quotes?" — gates
   * no_database_reactivation.
   *
   * IT EXISTS BECAUSE hasPastCustomerDatabase COULD NOT DO THIS JOB. That question
   * has inverse polarity: "no list" suppresses the leak and "yes, a list" is what
   * makes it FIRE — so it could only ever take the leak off the report, never
   * confirm the claim the leak actually makes, which is that the list is going
   * COLD. The two now split cleanly and BOTH are kept:
   *   · hasPastCustomerDatabase answers "is there a list?" — the applicability
   *     fact for the Database Reactivation workflow;
   *   · this answers "is it dormant?" — the leak. SYSTEMATIC means it is already
   *     being worked (suppress); OCCASIONAL, OVER_A_YEAR and NEVER confirm it.
   */
  pastCustomerContact?: "SYSTEMATIC" | "OCCASIONAL" | "OVER_A_YEAR" | "NEVER";
  /**
   * "Do you take a deposit or payment before the work is done?" — the
   * applicability fact for the Text-to-Pay workflow, and ONLY that. No leak reads
   * it: it says nothing about whether a gap exists, only whether the workflow has
   * a moment in their day to sit in.
   *
   *   ALWAYS / SOMETIMES → Text-to-Pay is INSTALLED.
   *   NEVER              → the ONLY answer that switches it off. They are paid in
   *                        person once the work is done, so there is no "yes" to
   *                        convert while it is still hot.
   *   unanswered         → installed. An unasked question never removes a
   *                        workflow the client is paying for.
   *
   * DO NOT MERGE THIS WITH hasOnlinePayment. This is the trap in this pair, so it
   * is written out rather than left to be rediscovered: the two questions look
   * identical and run in OPPOSITE directions.
   *
   *   · takesDeposits ALWAYS/SOMETIMES + hasOnlinePayment false → install, and it
   *     is the HIGHEST-priority install of the fourteen. They take deposits with
   *     no online way to collect them, which means they are chasing e-transfers
   *     and cheques by hand today. That is the BEST Text-to-Pay candidate there
   *     is, not the worst.
   *   · takesDeposits ALWAYS/SOMETIMES + hasOnlinePayment true → install.
   *   · takesDeposits NEVER → off, whatever hasOnlinePayment says.
   *
   * So hasOnlinePayment can only ever change the PRIORITY of the install, never
   * the install itself, and priority is a separate signal carried separately (see
   * `priorityRule` in workflow-catalogue.ts). Wire hasOnlinePayment into the on/off
   * rule and every hand-chasing client loses the workflow that helps him most.
   */
  takesDeposits?: "ALWAYS" | "SOMETIMES" | "NEVER";
  /**
   * "Who replies to your Google reviews right now?" — gates no_review_replies,
   * and separately raises a hint (never a rule) on the Review Response workflow.
   *
   * A PROCESS QUESTION, NOT A PREFERENCE ONE, on purpose. "Do you write your own
   * replies?" invites a scope answer — the owner hears "do you want to keep
   * this?", says yes, and we drop a workflow he would have been glad of. "Who
   * replies right now?" is a fact about how the business runs today, which is the
   * same shape as every other question on this form.
   *
   * TWO CONSUMERS, and only one of them changes anything automatically:
   *   1. THE FINDING (no_review_replies). NOBODY fires it, and it can ONLY ever be
   *      disclosed — nothing we fetch carries an owner-reply field, so the client
   *      telling us is the only evidence that will ever exist. OWNER and
   *      STAFF_OR_AGENCY both suppress it: somebody is replying. Unanswered does
   *      NOT fire it — see the leak for why a benchmark hedge would be dishonest
   *      here specifically.
   *   2. THE BUILD. OWNER is the only answer that makes switching Review Response
   *      off reasonable, and it DOES NOT switch it off. An owner who writes his own
   *      replies still benefits from having a draft waiting the same day; the
   *      workflow installs and the operator removes it by hand if the client
   *      insists. It is carried as a SUGGESTION on the toggles panel, which is a
   *      different thing from a rule that flips the state.
   */
  reviewReplyOwner?: "NOBODY" | "OWNER" | "STAFF_OR_AGENCY";
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

/**
 * EVIDENCE CLASS — is the LEAK ITSELF externally observable from a cold scan, or
 * does it live inside the operation? This is a PER-LEAK property, distinct from
 * the per-fire `tier` (which says how provable a specific detection was). A leak
 * can be INVISIBLE by nature yet still fire at EVIDENCED tier off review proxies.
 *
 * It exists to fix a specific defect: the audit stating invisible-system leaks
 * (missed-call recovery, follow-up) as flat operational FACT — "they receive no
 * follow-up" — while its own "leaks I can't see from out here" section lists the
 * same thing. A cold scan cannot see inside their operation, so:
 *
 *   OBSERVED  — the gap is directly visible in the scrape: a missing booking
 *               link, a weak/absent CTA, low review counts, limited GBP hours
 *               with no public 24/7 capture path. May be stated as fact.
 *   INVISIBLE — the mechanism is internal: response speed, missed-call recovery,
 *               follow-up, appointment reminders, pipeline/CRM, database
 *               reactivation, call tracking, social-DM response behavior,
 *               deposit/payment friction. It may ONLY be written as
 *               pattern + visible-absence + conditional (never a flat operational
 *               assertion), even when a review proxy lifts its fire to EVIDENCED.
 */
export type EvidenceClass = "OBSERVED" | "INVISIBLE";

/**
 * EVIDENCE GRADE — the honesty gate that drives VOICE.
 *
 * `tier` says HOW a detection fired. `grade` says WHAT GRADE OF KNOWLEDGE the
 * claim rests on — and that, not the tier, is what decides how flatly a sentence
 * about this leak is allowed to read:
 *
 *   observed   we measured it with our own tooling (PageSpeed, review counts, a
 *              booking path that isn't there, GBP hours). Write it declaratively
 *              and say what we measured.
 *   disclosed  the client told us — intake form, kickoff call, Zoom calculator.
 *              Declarative but ATTRIBUTED: "you told us…". NEVER dressed up as
 *              something we detected, and never hedged. They answered the
 *              question; hedging their own answer back at them is the exact
 *              failure this grade exists to remove.
 *   inferred   neither measured nor disclosed — an industry pattern. Hedged, and
 *              labelled as a pattern ("…we haven't measured yours").
 *
 * IT IS DERIVED, NEVER HAND-SET. One function, one precedence, so a leak's voice
 * can never drift away from what we actually know about it:
 *
 *     measured  >  told  >  guessed
 *
 * The precedence is deliberate. When we measured something AND the client also
 * confirmed it, the measurement is the more defensible of the two, so it wins.
 *
 * WHY "EVIDENCED" IS NOT ITS OWN GRADE — the question a future reader will ask.
 * EVIDENCED means we inferred from a real signal: two reviews mentioning calls
 * that were never returned. The SIGNAL is observed; the CONCLUSION ("they miss
 * calls") is not — nobody measured their phone system. So EVIDENCED grades to
 * "inferred" ON PURPOSE, which is exactly what its own phrasing rule already
 * demands (state the signal, then hedge the inference). The finer-grained `tier`
 * survives untouched to drive that phrasing; `grade` is the coarse honesty gate
 * sitting above it.
 *
 * A MISSING GRADE IS "inferred". Packs saved before this existed carry no grade
 * at all, and a missing grade must never license a flat assertion — so every
 * optional input below falls to the safe end.
 *
 * It takes the minimum it needs, so a FiredLeak and a LeakInput can each be
 * passed whole, without a cast.
 */
export function gradeOf(input: {
  tier?: EvidenceTier | null;
  intakeConfirmed?: boolean | null;
}): EvidenceGrade {
  if (input.tier === "OBSERVED") return "observed"; // we measured it ourselves
  if (input.intakeConfirmed === true) return "disclosed"; // they told us
  return "inferred"; // EVIDENCED or BENCHMARK, unconfirmed — a pattern, not a fact
}

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
      // Worded "paid-search" rather than naming the ad platform: if any leak ever
      // adds this statId, allowedStatPhrase stamps this claim verbatim into a
      // client-facing pack, and a leadgen term in it would hard-fail Law 2.
      "Paid-search cost-per-lead: HVAC $129, Plumbing $129, Roofing $228, Electrical $94, Dental $84, Legal $132 (USD).",
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
 * SECTION 4b — WORKING ASSUMPTIONS (structurally NOT stats)
 * ==========================================================================
 * These are the numbers the math templates need that NO source in STATS
 * supplies. They are deliberately kept in their own map, with their own type,
 * so they can never be mistaken for — or rendered like — a cited statistic.
 *
 * THE RULE: a math frame that consumes an ASSUMPTION must say so in the SAME
 * SENTENCE as the number, in the owner's language ("our assumption, not a
 * number we measured"). leak-narrative.ts owns that wording via
 * `assumptionCaveat()`; nothing here is allowed to reach a client unlabelled.
 *
 * If a STATS entry ever covers one of these, delete the assumption and use the
 * stat's CONSERVATIVE end instead (RULES.math) — that is exactly what happened
 * to the old hard-coded 15% no-show rate for dental (dental_no_show's low end
 * is 12%) and med spa (medspa_show_rate's 85% show rate ⇒ 15% no-show).
 * ==========================================================================*/

export interface Assumption {
  /** The raw number the templates multiply by. */
  value: number;
  /** Reader-facing phrase for the number, in plain owner language. */
  label: string;
  /** Why it exists and, explicitly, that it is NOT measured or cited. */
  rationale: string;
}

export const ASSUMPTIONS: Record<string, Assumption> = {
  benchmark_monthly_inquiries: {
    value: 20,
    label: "~20 enquiries a month",
    rationale:
      "WORKING ASSUMPTION — not measured, not cited, and not this business's number. Pre-intake we have no inbound volume at all, so a benchmark dollar frame needs some volume to stand on. Held to ONE value across a whole document so the arithmetic stays internally consistent, and replaced by the client's real volume the moment intake lands.",
  },
  conservative_close_rate: {
    value: 0.3,
    label: "a 30% close rate on recovered enquiries",
    rationale:
      "WORKING ASSUMPTION — not measured, not cited. No source in STATS gives a close rate for a RECOVERED missed call specifically, so we assume a deliberately unremarkable 30%. Replaced by the client's own closed/inquiry ratio when they can give us one.",
  },
  range_low_haircut: {
    value: 0.5,
    label: "a low end set at half the high end",
    rationale:
      "WORKING ASSUMPTION — not measured, not cited. It is how we build the bottom of an estimate range: half the high figure, so the range reads pessimistic rather than flattering. It is a presentation choice, not a finding.",
  },
  default_no_show_rate: {
    value: 0.15,
    label: "a 15% no-show rate",
    rationale:
      "WORKING ASSUMPTION — not measured, not cited. Used ONLY for verticals with no no-show range in STATS. Dental and med spa do not use it: they use the conservative end of dental_no_show (12%) and medspa_show_rate (15% no-show implied by an 85% show rate).",
  },
  usd_to_cad: {
    value: 1.35,
    label: "a USD→CAD rate we hold at 1.35",
    rationale:
      "WORKING ASSUMPTION — not measured, not cited, and not a live rate. Set 2026-07-26 from the Bank of Canada daily exchange rates (https://www.bankofcanada.ca/rates/exchange/daily-exchange-rates/), which is the source to re-check it against, and deliberately parked at the LOW end of the recent range. It touches exactly ONE number anywhere in the system: the USD cost-per-lead benchmark in cpl_google_ads. It is applied with Math.floor at the point of use, so the CAD figure it produces is always at or below the true converted value — this assumption can only ever UNDERSTATE a leak, never inflate one. FX drifts: revisit the rate and this date whenever the CPL benchmarks themselves are refreshed.",
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
  /** Real problem, NOT something ReclaimedHQ fixes. "Also worth knowing"
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

/**
 * THE ONE QUESTION that would move this leak from a guess to something the client
 * told us — i.e. from grade "inferred" to grade "disclosed".
 *
 * This is what turns "you failed to collect something" into a list the operator
 * can act on. inferredGaps() reports, per still-inferred fired leak, exactly which
 * question was never answered; intakeFieldsForZeroInferred() rolls the whole
 * taxonomy up into the set of questions a client would have to answer.
 *
 * ABSENT IS A REAL ANSWER, and it means one of two honest things:
 *   · the leak fires OBSERVED — we measure it ourselves, so there is nothing to
 *     ask (site speed, review counts, a missing booking link, a weak CTA);
 *   · no question we ask could resolve it — no ClientIntake field carries the
 *     answer (webchat, how they qualify an enquiry at the front door). Those gaps
 *     are structural, not collectible, and inventing a question here that wouldn't
 *     actually resolve one would just move the dishonesty from the report into
 *     this file.
 *
 * A STRUCTURAL GAP IS NOT PERMANENT — it is a product decision nobody has taken
 * yet. Two of them (social DMs, the dormant past-customer list) were closed by
 * adding the two questions that could actually settle them, and both now carry an
 * ask below. The remaining ones close the same way: add the field to ClientIntake
 * and the question to the form, then point an intakeAsk at it.
 *
 * `question` is quoted VERBATIM from the shipped intake form
 * (src/components/businesses/IntakeForm.tsx), which mirrors the ReclaimedHQ
 * client intake form. Never write a second phrasing of a question we already ask
 * — the operator has to be able to read this list and ask it word for word.
 */
export interface IntakeAsk {
  /** The ClientIntake key that carries the answer. Typed as a key, not a string,
   *  so a renamed field breaks the build instead of rotting silently. */
  field: keyof ClientIntake;
  /** Operator-facing wording, verbatim from the intake form. For the four
   *  yes/no system questions, the form asks them as a checklist, so the wording
   *  is the group title plus the checklist label — both verbatim. */
  question: string;
  /** Always "disclosed". An answer can only ever turn a guess into something they
   *  told us; it can never turn one into something we measured. Written out so a
   *  reader of a single entry doesn't have to know that rule by heart. */
  upgradesTo: "disclosed";
}

export interface Leak {
  id: string;
  name: string;
  scope: Scope;
  scorecardArea: ScorecardArea | null; // null for out_of_scope
  /** Is the gap externally observable from a cold scan, or internal to the
   *  operation? Drives the narrative honesty rule for INVISIBLE leaks
   *  (pattern + visible-absence + conditional only). See EvidenceClass. */
  evidenceClass: EvidenceClass;
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

  /** The one intake question that would upgrade this leak from inferred to
   *  disclosed. Absent = nothing to ask (we measure it) or nothing we ask could
   *  resolve it — see IntakeAsk for why absence is deliberate, not an oversight. */
  intakeAsk?: IntakeAsk;

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
   * in the ReclaimedHQ Model. This string flows into the roadmap
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
    /** The AFTER-HOURS SLICE of missed_call_value — a subset of it, never a
     *  second figure to add on top. Its MathEstimate carries overlapsWith +
     *  overlapNote so the renderer and reconcileLeakTotal can exclude it from
     *  any sum. */
    | "after_hours_value"
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
    evidenceClass: "INVISIBLE", // response latency is internal; reviews only proxy it
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
          "intake.responseSpeed is FEW_HOURS or DAY_OR_TWO — the client told us how long a new enquiry waits, so the fire is CONFIRMED rather than benchmarked, and it applies whether or not we could fingerprint a form. If intake.responseSpeed is UNDER_5_MIN, suppress entirely — they already answer inside the window this leak exists to close. NOT_TRACKED / not asked keeps the hedge below.",
      },
      {
        tier: "BENCHMARK",
        when:
          "website.hasContactForm AND no chat widget AND no visible instant-response mechanism (no 'we reply in X minutes' claim on contact page text)",
      },
    ],
    intakeAsk: {
      field: "responseSpeed",
      question: "How fast does a new enquiry usually get a reply?",
      upgradesTo: "disclosed",
    },
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
    evidenceClass: "INVISIBLE", // whether calls are missed/recovered is internal; reviews only proxy it
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
          "intake.missedCallHandling is CALL_BACK_WHEN_FREE or VOICEMAIL_ONLY — the client told us what happens to a missed call, so the fire is CONFIRMED rather than benchmarked, and it applies even when the site shows a 'text us' link (a texting option on a website is not a missed-call recovery workflow). If intake.missedCallHandling is INSTANT_TEXT_BACK, suppress entirely — the recovery path this leak sells already exists. UNKNOWN / not asked keeps the hedge below.",
      },
      {
        tier: "BENCHMARK",
        when:
          "business.phone exists AND website.mentionsTextingOption is false (no visible recovery path). Use the industry-specific missed-call rate from missed_rate_by_industry.",
      },
    ],
    intakeAsk: {
      field: "missedCallHandling",
      question: "What happens when you miss a call?",
      upgradesTo: "disclosed",
    },
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
    // SPLIT LEAK: the ABSENCE of a public 24/7 capture path (limited hours + no
    // booking link + no chat) IS observable, so the class is OBSERVED. But what
    // happens to an after-hours caller (do they get a response?) is INVISIBLE and
    // must stay hedged in the narrative — never assert their after-hours handling.
    evidenceClass: "OBSERVED",
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
          "intake.afterHoursHandling is NEXT_MORNING or NOTHING — the client told us what an after-hours caller actually gets, so the fire is CONFIRMED rather than benchmarked. If intake.afterHoursHandling is AUTO_RESPONSE, suppress entirely — an after-hours auto-response IS the fix this leak sells. UNKNOWN / not asked keeps the hedge below.",
      },
      {
        tier: "BENCHMARK",
        when:
          "gbp.hoursListed is false AND no 24/7 capture path detected on site",
      },
    ],
    // Only reachable when the leak fired BENCHMARK. Its OBSERVED branch is a real
    // measurement (limited Google hours + no public capture path), and a measured
    // gap is never listed as something we failed to ask about.
    intakeAsk: {
      field: "afterHoursHandling",
      // The intake form asks "…someone calls after hours"; the ClientIntake doc
      // comment above says "calls or messages". The form's wording is the one the
      // operator actually reads out, so it is the one quoted here.
      question: "What happens when someone calls after hours?",
      upgradesTo: "disclosed",
    },
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
    // SUBSET, NOT A SECOND FIGURE. This used to carry "missed_call_value", so it
    // computed the IDENTICAL number as missed_calls_no_recovery and the report
    // summed both — double-counting the same lost calls. After-hours calls ARE
    // missed calls, so it now runs its own template that takes the after-hours
    // slice (conservative 28% end of after_hours_28_43) and declares the overlap.
    mathTemplate: "after_hours_value",
  },

  /* ------------------------------------------------------------------
   * CLUSTER B — CAPTURE & QUALIFICATION
   * ----------------------------------------------------------------*/
  {
    id: "no_online_booking",
    name: "No online booking path",
    scope: "ghl",
    scorecardArea: "online_booking",
    evidenceClass: "OBSERVED", // absence of a booking link/scheduler is directly visible
    symptom:
      "The only way to become a customer is to call during business hours. Anyone who prefers to book online — or is browsing at 9pm — can't.",
    detection: [
      {
        tier: "OBSERVED",
        when:
          "website.hasOnlineBookingLink is false AND gbp.hasBookingLink is false",
      },
    ],
    // Only reachable when the scan could NOT confirm the absence of a scheduler
    // (a thin/bot-walled site), which is the one path this leak has to a hedge.
    // When the scan did confirm it, the leak is measured and needs no question.
    intakeAsk: {
      field: "bookingMethod",
      question: "How do they book right now?",
      upgradesTo: "disclosed",
    },
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
    evidenceClass: "OBSERVED", // presence/absence of a chat widget is directly visible
    symptom:
      "Visitors with a quick question have two options: call, or leave. There's no low-friction way to start a conversation from the site.",
    detection: [
      {
        tier: "OBSERVED",
        when: "website exists AND website.hasChatWidget is false",
      },
    ],
    // NO intakeAsk, deliberately. This leak only hedges when OUR SCAN was thin —
    // chat widgets are script-injected and a bot-walled page hides them. The fix
    // for that is a better scan, not a question, and we ask the client nothing
    // about webchat. A "do you have a chat widget?" field invented here would
    // read like coverage we don't have.
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
    // OBSERVED when a form exists without qualifying fields (directly visible). The
    // BENCHMARK branch (all-phone intake) is closer to invisible, but the primary
    // detection is the observable form, so the leak's class is OBSERVED.
    evidenceClass: "OBSERVED",
    symptom:
      "Every inquiry — tire-kicker or CAD $20k job — lands in the same pile. The owner spends selling time sorting instead of closing.",
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
    // NO intakeAsk. Nothing in ClientIntake asks what an enquiry is asked before
    // it reaches the owner — the form covers speed, missed calls, after-hours,
    // booking, payments and the four systems, and none of those answers tells us
    // whether a lead is qualified at the front door. A structural gap: closing it
    // needs a new intake question, which is a product decision, not a taxonomy edit.
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
    evidenceClass: "OBSERVED", // CTA/click-to-call presence on the page is directly visible
    symptom:
      "Traffic arrives, reads, and leaves. The page doesn't tell visitors what to do next — no clear primary action, buried phone number, generic 'contact us'.",
    detection: [
      {
        tier: "OBSERVED",
        when:
          "website.hasPrimaryCtaAboveFold is false OR website.servicePagesHaveCtas is false OR website.hasClickToCallOnMobile is false",
      },
    ],
    // NO intakeAsk — and none is needed. This leak has exactly one detection rule
    // and it is OBSERVED: we read their page. It can never sit at "inferred", so
    // it can never appear in the operator's list of things he failed to collect.
    revenueMechanism:
      // NOTE: this string is emitted to the model as the "why it costs money" line
      // and the prompt permits rephrasing it, so any leadgen term here can echo into
      // a pack and hard-fail Law 2. It must stay clean of ad/traffic-buying vocabulary.
      "The site already gets the visit — the page just doesn't convert it. A clear primary action above the fold, click-to-call on mobile, and a distinct CTA per service page turn existing visits into inquiries without buying a single additional one. This is the cheapest conversion gain on the list because the demand is already there.",
    statIds: [],
    impactWeight: 6,
    ghlFix: {
      assetName: "Booking page + site CTA advisory",
      // We do not touch the client's website. What we BUILD is the GoHighLevel
      // booking page; what we say about their own site is advisory copy they hand
      // to whoever runs it. The old wording promised CMS Editor access and an
      // implementation on their site — that is the previous business model.
      build:
        "Build and brand the GoHighLevel booking page: headline (3 options provided), primary action above the fold, click-to-call, reassurance line. For the client's own website we supply the same fixes as written recommendations — headline options, above-the-fold CTA, click-to-call, a distinct CTA per service page — for their own web person to apply. The site itself is untouched by us.",
      roadmapPhase: 1,
      assetPackItems: [
        "Booking page copy — 3 headline options",
        "CTA blocks",
        "Site CTA recommendations (advisory)",
      ],
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
    evidenceClass: "INVISIBLE", // what they do after a lead goes quiet is internal
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
    intakeAsk: {
      field: "hasFollowUpSequence",
      question: "Systems they already have — Automated follow-up",
      upgradesTo: "disclosed",
    },
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
    evidenceClass: "INVISIBLE", // reminder systems + real no-show rate are internal
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
    intakeAsk: {
      field: "hasReminderSystem",
      question: "Systems they already have — Appointment reminders",
      upgradesTo: "disclosed",
    },
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
    evidenceClass: "INVISIBLE", // whether they track leads is entirely internal
    symptom:
      "Leads live in a notebook, an inbox, or nowhere. Nobody can say how many inquiries came in last month or what happened to them.",
    detection: [
      {
        tier: "BENCHMARK",
        when:
          "Fires at benchmark tier unless intake.hasCrm is true. Invisible externally — kickoff-verification hedge required. If intake.hasCrm is true, suppress entirely.",
      },
    ],
    intakeAsk: {
      field: "hasCrm",
      question: "Systems they already have — CRM / lead pipeline",
      upgradesTo: "disclosed",
    },
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
    evidenceClass: "INVISIBLE", // existence/use of a past-customer list is internal
    symptom:
      "Years of past customers and old quotes sit in a spreadsheet or an inbox — and nobody has contacted them since the job ended.",
    detection: [
      {
        tier: "BENCHMARK",
        when:
          "intake.hasPastCustomerDatabase is false — suppress entirely. No list, nothing to reactivate; this is the applicability question, and it is the only thing it can settle.",
      },
      {
        tier: "BENCHMARK",
        when:
          "intake.pastCustomerContact is SYSTEMATIC — suppress entirely. A list contacted within the last month, systematically, IS the campaign this leak sells.",
      },
      {
        tier: "BENCHMARK",
        when:
          "intake.pastCustomerContact is OCCASIONAL, OVER_A_YEAR or NEVER — the client told us the list is going cold, so the fire is CONFIRMED rather than benchmarked and needs no review-count proxy behind it.",
      },
      {
        tier: "BENCHMARK",
        when:
          "Fires at benchmark tier for any established business (googleReviews.count >= 20 used as a proxy for operating history) unless intake.hasPastCustomerDatabase is false. Hedge: framed as 'if you have a past-customer list, it is almost certainly your cheapest revenue'.",
      },
    ],
    // THE QUESTION IS THE DORMANCY ONE, NOT THE LIST ONE — worth reading twice,
    // because the obvious answer here is wrong. We also ask about the past-customer
    // LIST, but that answer has inverse polarity: "no list" suppresses the leak
    // entirely (nothing to reactivate) and "yes, we have one" is what makes it fire.
    // It could only ever take this leak OFF the report; it could never confirm the
    // actual claim, which is that the list is sitting DORMANT. pastCustomerContact
    // is the question that can, which is why this leak stopped being a structural
    // gap and became a collectible one.
    intakeAsk: {
      field: "pastCustomerContact",
      question: "When did you last contact past customers or old quotes?",
      upgradesTo: "disclosed",
    },
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
    evidenceClass: "INVISIBLE", // long-cycle nurture behavior is internal
    symptom:
      "Leads who said 'not right now' vanish from the system. When their trigger finally hits — the furnace dies, the case becomes urgent — the business isn't in their inbox.",
    detection: [
      {
        tier: "BENCHMARK",
        when:
          "Fires at benchmark tier alongside no_follow_up_sequence (same invisibility, same hedge). If the generator has already surfaced no_follow_up_sequence, this leak appears in the Blueprint/Roadmap as the long-cycle extension of that fix rather than as a separate report leak — avoid double-counting the same dollar estimate.",
      },
    ],
    // The SAME question as no_follow_up_sequence, on purpose: the detector reads
    // that one answer for both leaks. It is a slight over-read — "no automated
    // follow-up" is strictly about the next two weeks, not the next twelve months
    // — but it is what the shipped detector does, and the catalogue must describe
    // the code rather than an idealised version of it. A dedicated long-cycle
    // question would need a new intake field.
    intakeAsk: {
      field: "hasFollowUpSequence",
      question: "Systems they already have — Automated follow-up",
      upgradesTo: "disclosed",
    },
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
    // NAME IS LOAD-BEARING: it is stamped verbatim into the asset pack, and the
    // pack validator hard-fails any text matching the banned review-generation
    // section phrase (it bans SELLING review-generation as a service). The old
    // name carried that exact phrase, so every pack surfacing this leak failed
    // its own validator. Keep this name — and every string below — clear of it.
    name: "Review volume behind local competitors",
    scope: "ghl",
    scorecardArea: "reputation_social_proof",
    evidenceClass: "OBSERVED", // review counts/recency vs competitors are directly visible
    symptom:
      "Happy customers finish the job and leave — nobody asks them for a review. Meanwhile the competitor down the street adds ten a month.",
    detection: [
      {
        tier: "OBSERVED",
        when:
          "googleReviews.recentCount90d is low relative to competitor median (e.g., < 50% of the median competitor's implied velocity) OR googleReviews.count < 50% of median competitor reviewCount. Both sides of the comparison are observed data — state the actual numbers.",
      },
    ],
    // NO intakeAsk — one OBSERVED rule, both sides of it measured (their review
    // count against the competitor median). Nothing to ask.
    revenueMechanism:
      "Buyers comparing two local businesses at the decision moment lean on review count, recency, rating — and whether the owner is visibly present on the page. When a competitor shows triple the recent reviews, a share of ready-to-buy demand defaults to them. Asking after every completed job, and replying to what comes back, closes the gap without the owner lifting a finger.",
    statIds: [],
    impactWeight: 6,
    verticalBoost: {
      roofing: "Highest-distrust trade — social proof carries the most weight at the decision moment.",
    },
    // ABSORBED THE OLD unanswered_reviews LEAK. That leak could never fire: the
    // adapter has no owner-reply data to give it (DataForSEO's reviews response
    // we parse carries rating / text / timestamp and nothing else), so it sat at
    // the -1 unknown sentinel forever while being the ONLY justification for the
    // Review Response workflow we sell. The workflow is now justified off review
    // VOLUME, which is real observed evidence: the same "we run your reviews"
    // system does the asking and the replying, and it ships on evidence we have.
    //
    // RESPONSIVENESS IS BACK, AS ITS OWN LEAK — no_review_replies, directly below.
    // It is NOT this leak and must not be folded into it: this one is about review
    // VOLUME (an observed count against the local median), that one is about
    // whether anybody REPLIES (which we still cannot see, and now simply ask).
    ghlFix: {
      assetName: "Review engine — requests + responses",
      build:
        "GHL workflow: job marked complete (pipeline stage → won) triggers a review-request SMS/email with the direct Google review link, one polite reminder if no action, requests logged. New reviews land in the GHL reputation inbox with reply templates (positive / neutral / negative), and replying is part of the monthly retainer's running of the system. Uses the review-request and reply templates from the Conversion Asset Pack. GBP Manager access per onboarding SOP.",
      roadmapPhase: 3,
      assetPackItems: ["Review-request templates", "Review reply templates"],
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
    /**
     * REINSTATED, DELIBERATELY, AND UNDER A NEW ID.
     *
     * Phase 0.5 DELETED a leak called `unanswered_reviews` and was right to: it
     * claimed an OBSERVED detection off `googleReviews.ownerResponseRate`, and
     * nothing in the pipeline has ever supplied that number. DataForSEO's reviews
     * response and Google Places both give us rating, text and timestamp and no
     * owner-reply field at all, so the adapter writes the -1 "unknown" sentinel and
     * the leak sat permanently unfireable — coverage on paper, nothing underneath.
     *
     * THAT REASON IS GONE, for one case and one case only: the client can TELL us.
     * So this leak exists, and it is shaped so that it can ONLY ever be disclosed
     * or inferred — never observed. That is a coherent shape in the grade model
     * (grade = measured > told > guessed) and it is the honest one here: we are not
     * measuring anything, we are recording an answer.
     *
     * WHY THE ID IS DIFFERENT. `unanswered_reviews` is asserted absent by the leak
     * detection suite, and reusing a deleted id would make a saved pack from before
     * the deletion look like it carried this finding. New finding, new id.
     *
     * NOT low_review_velocity. That leak is about review VOLUME — how many they
     * have against the local median, measured on both sides. This one is about
     * RESPONSIVENESS — whether anybody answers what comes in. A business can be
     * miles ahead on volume and still have three years of silent five-star reviews,
     * which is what the next person choosing between two companies actually reads.
     */
    id: "no_review_replies",
    name: "Google reviews going unanswered",
    scope: "ghl",
    scorecardArea: "reputation_social_proof",
    // INVISIBLE by our own admission: replies are public on Google, but nothing we
    // fetch carries them, so from where this software stands the fact is inside the
    // operation. Naming it OBSERVED would licence a flat "we saw that nobody
    // replies" — which we never did see.
    evidenceClass: "INVISIBLE",
    symptom:
      "Reviews come in and nothing comes back. The next person deciding whether to call reads a page where nobody from the business has said a word.",
    detection: [
      {
        tier: "BENCHMARK",
        when:
          "intake.reviewReplyOwner is OWNER or STAFF_OR_AGENCY — suppress entirely. Somebody is replying; there is no gap to report.",
      },
      {
        tier: "BENCHMARK",
        when:
          "intake.reviewReplyOwner is NOBODY — the client told us nobody replies, so the fire is CONFIRMED (grade 'disclosed'), declarative and attributed to them.",
      },
      {
        tier: "BENCHMARK",
        when:
          "UNANSWERED / not asked — DOES NOT FIRE. This is the one leak with no benchmark hedge, and the omission is the point: an unanswered question here leaves us with NOTHING, because no outside signal for owner replies exists anywhere in what we fetch. Firing hedged would be inventing a finding out of a blank, which is exactly why the old unanswered_reviews leak was deleted. It fires only when the client has told us.",
      },
    ],
    // The one question that can settle it — and, unusually, the only thing that can
    // make it fire at all. Everywhere else an ask upgrades a guess to a disclosure;
    // here there is no guess to upgrade.
    intakeAsk: {
      field: "reviewReplyOwner",
      question: "Who replies to your Google reviews right now?",
      upgradesTo: "disclosed",
    },
    revenueMechanism:
      "A reply is read by everybody who comes after it, not by the person who wrote the review. A page of unanswered reviews — good ones included — reads as nobody being home, and a complaint with no response is the last thing a buyer sees before they call somewhere else. Answering every review, quickly and in the owner's voice, is the cheapest trust signal on the list because the reviews are already there.",
    statIds: [],
    impactWeight: 4,
    verticalBoost: {
      roofing: "Highest-distrust trade — an unanswered complaint carries further here than anywhere else.",
    },
    ghlFix: {
      assetName: "Review replies",
      build:
        "GHL: every new Google review lands in the reputation inbox with a drafted reply (positive / neutral / negative), posted in the business's name — usually the same day, with anything awkward run past the owner first. Replying is part of the monthly running of the system, using the reply templates from the Conversion Asset Pack. GBP Manager access per onboarding SOP.",
      roadmapPhase: 3,
      assetPackItems: ["Review reply templates"],
    },
    // NOT in cold_audit, and that is structural rather than a preference: the cold
    // audit runs pre-sale, where there is no intake at all, so this leak cannot
    // fire there by construction. Listing it would advertise a finding the free
    // audit can never produce.
    deliverableTargets: ["growth_leak_report", "blueprint", "asset_pack", "roadmap"],
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
    // The CHANNEL (FB/IG link) is observed, but DM response behavior is INVISIBLE —
    // never assert how fast they answer DMs; hedge it as the detection note says.
    evidenceClass: "INVISIBLE",
    symptom:
      "Facebook and Instagram messages sit in an app nobody checks between jobs. DM inquiries get the slowest response of any channel — or none.",
    detection: [
      {
        tier: "BENCHMARK",
        when:
          "intake.socialEnquiries is NO or NO_ACCOUNTS — suppress entirely. There is no leak in a channel that brings no enquiries: nothing is being lost in an inbox nobody checks if nothing arrives there.",
      },
      {
        tier: "BENCHMARK",
        when:
          "intake.socialEnquiries is YES — the client told us enquiries DO arrive as Instagram/Facebook messages, so the fire is CONFIRMED rather than benchmarked, and it applies whether or not the site links to either profile (a business can take DMs without linking its accounts anywhere).",
      },
      {
        tier: "BENCHMARK",
        when:
          "website.linksToFacebook OR website.linksToInstagram (presence of the channel is observed; response behavior is not — hedge accordingly: 'if DMs aren't flowing into one inbox, they're almost certainly the slowest-answered channel you have').",
      },
    ],
    // THE QUESTION THAT CLOSED THIS GAP. Until socialEnquiries existed, nothing in
    // ClientIntake asked whether Facebook/Instagram messages actually bring
    // enquiries, so this leak could never leave "inferred" however thorough the
    // intake call was — a structural gap, reported to the operator as a blank
    // rather than as a to-do he could clear.
    //
    // SECOND CONSUMER, and it is NOT this one: NO_ACCOUNTS is also the fact that
    // switches the Social DM Capture workflow OFF in the build. "NO" does not —
    // they have the accounts, so the capture workflow still installs and sits
    // quiet. See the socialEnquiries doc comment on ClientIntake.
    intakeAsk: {
      field: "socialEnquiries",
      question: "Do enquiries come in through Instagram or Facebook messages?",
      upgradesTo: "disclosed",
    },
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
    evidenceClass: "INVISIBLE", // call-tracking presence is not externally visible
    symptom:
      "Nobody knows how many calls came in last month, how many were missed, or what time of day they're lost. The leak can't be seen, so it can't be managed.",
    // NOT ONE OF THE 14 SOLD WORKFLOWS. This is a measurement FINDING — the
    // reporting layer that comes with the monthly management, not a workflow we
    // pitch on its own. Any copy that presents it as a headline revenue leak is
    // wrong; it exists so every other leak on the list becomes provable.
    detection: [
      {
        tier: "BENCHMARK",
        when:
          "Fires at benchmark tier unless intake.hasCallTracking is true (call-tracking presence is not externally visible, so only the client can contradict it — same suppression shape as intake.hasCrm on no_crm_pipeline). If intake.hasCallTracking is true, suppress entirely; if the client answered 'no', it is CONFIRMED rather than benchmarked.",
      },
    ],
    intakeAsk: {
      field: "hasCallTracking",
      question: "Do you track calls, answered vs missed, today?",
      upgradesTo: "disclosed",
    },
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
    evidenceClass: "INVISIBLE", // deposit/payment process is mostly invisible externally
    symptom:
      "A lead agrees to the job — then the deposit means an e-transfer request, a mailed invoice, or 'we'll sort it at the appointment'. Some yeses evaporate in that gap.",
    // DEMOTED TO A PURE INDUSTRY INFERENCE. The old rule claimed "no online
    // payment/deposit mechanism visible on site" — we have never scanned for
    // one, so the code fired on vertical membership alone while the taxonomy
    // advertised evidence it did not have. The rule below now says exactly what
    // the detector does: vertical pattern only, nothing observed, suppressible
    // only by intake.
    detection: [
      {
        tier: "BENCHMARK",
        when:
          "Vertical is roofing, contractor_general, hvac, plumbing, or med_spa (deposit-taking verticals) AND intake.hasOnlinePayment is not true. NOTHING about the payment path is scanned — this is an industry inference about deposit-taking trades, never an observation about this business. If intake.hasOnlinePayment is true, suppress entirely.",
      },
    ],
    intakeAsk: {
      field: "hasOnlinePayment",
      question: "Can a customer pay or leave a deposit online today?",
      upgradesTo: "disclosed",
    },
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
   * OUT OF SCOPE — detected, flagged, NEVER sold as a ReclaimedHQ fix.
   * These appear ONLY in the report's "Also worth knowing" section.
   * They exist because ignoring an obviously slow or dated site would
   * make the report read as blind — but they are not the engagement.
   * ----------------------------------------------------------------*/
  {
    id: "oos_slow_site_speed",
    name: "Slow site performance",
    scope: "out_of_scope",
    scorecardArea: null,
    evidenceClass: "OBSERVED", // measured PageSpeed is directly observed
    symptom:
      "The site loads slowly on mobile, which costs some share of visitors before the page even renders.",
    detection: [
      {
        tier: "OBSERVED",
        when: "pageSpeed.mobileScore < 50 OR pageSpeed.lcpSeconds > 4",
      },
    ],
    // NO intakeAsk — PageSpeed is a measurement we take ourselves. Nothing to ask.
    revenueMechanism:
      "Noted for completeness: site speed affects how much traffic survives to see the page. It sits on the traffic/site side of the line — outside this engagement, worth raising with whoever manages the website.",
    statIds: [],
    impactWeight: 3,
    ghlFix: null,
    deliverableTargets: ["growth_leak_report"],
    mathTemplate: null,
  },
  // REMOVED (dead code presenting as coverage): oos_dated_site_design and
  // oos_gbp_visibility_gaps. Both advertised an OBSERVED detection rule, and
  // both detectors returned null unconditionally — we never analyze screenshots
  // programmatically and never pull GBP photo/post counts. A leak that cannot
  // fire is not coverage; it is a promise the file can't keep. If either signal
  // becomes real, re-add the entry alongside the scanner that feeds it.
];

/* ============================================================================
 * SECTION 7b — THE INTAKE-ASK CATALOGUE, QUERIED
 * ==========================================================================
 * Two answers the owner asked for, both computed FROM the taxonomy above rather
 * than kept as a second hand-maintained list beside it. A list like that rots the
 * first time a leak is added and nobody remembers it exists; a query cannot.
 * ==========================================================================*/

/** One still-guessed fired leak, and the question that would fix that — or null
 *  when no question we ask could. */
export interface InferredGap {
  leakId: string;
  leakName: string;
  /** null = structural: nothing in ClientIntake carries the answer, so no amount
   *  of asking on the call would move this leak off a guess. See the per-leak
   *  comments in LEAKS for why each one is unanswerable. */
  ask: IntakeAsk | null;
}

/**
 * WHAT WE STILL DON'T KNOW — the operator-facing list.
 *
 * Every fired leak still sitting at grade "inferred" after intake, with the one
 * question that would have upgraded it. This is the difference between a report
 * that quietly hedges and an operator who can see, before the call, exactly which
 * answers he never collected.
 *
 * Reads the grade the fire already CARRIES (stamped once in getFiredLeaks) rather
 * than recomputing it — one derivation, so this list can never disagree with the
 * voice the deliverable actually used.
 */
export function inferredGaps(fired: FiredLeak[]): InferredGap[] {
  return fired
    .filter((f) => f.grade === "inferred")
    .map((f) => ({
      leakId: f.leak.id,
      leakName: f.leak.name,
      ask: f.leak.intakeAsk ?? null,
    }));
}

/** An intake field, its question, and every leak the one answer would upgrade. */
export interface IntakeFieldAsk {
  field: keyof ClientIntake;
  question: string;
  /** Leak ids this single answer moves from inferred to disclosed. More than one
   *  where a question does double duty (follow-up and long-cycle nurture share
   *  hasFollowUpSequence). */
  upgrades: string[];
}

/**
 * THE COMPLETE QUESTION SET — every intake field a client would have to answer
 * for no leak to be left guessing, de-duplicated, in taxonomy order.
 *
 * HONEST CAVEAT, and it matters: answering all of these clears every leak that CAN
 * be cleared, not every leak. The ones with no intakeAsk (webchat, lead
 * qualification at the front door) stay inferred no matter how complete the intake
 * is — those gaps are structural and need a new question on the form, not a better
 * call. inferredGaps() is what shows which of the two kinds a given report is
 * carrying. Social DMs and the dormant-database claim used to be on that list and
 * are no longer: each got the one question that could actually settle it
 * (socialEnquiries, pastCustomerContact), which is exactly how a structural gap is
 * meant to be retired.
 */
export function intakeFieldsForZeroInferred(): IntakeFieldAsk[] {
  const byField = new Map<keyof ClientIntake, IntakeFieldAsk>();
  for (const leak of LEAKS) {
    const ask = leak.intakeAsk;
    if (!ask) continue;
    const existing = byField.get(ask.field);
    if (existing) {
      existing.upgrades.push(leak.id);
      continue;
    }
    byField.set(ask.field, {
      field: ask.field,
      question: ask.question,
      upgrades: [leak.id],
    });
  }
  return Array.from(byField.values());
}

/* ============================================================================
 * SECTION 8 — SELECTION, RANKING & MATH RULES
 * The generator implements exactly this. No other selection logic.
 * ==========================================================================*/

export const RULES = {
  selection: [
    "Run every leak's detection rules against ScrapeData. First matching rule sets the tier. No match = leak does not exist for this business.",
    "If intake data explicitly contradicts a BENCHMARK leak (e.g., intake.hasCrm === true), suppress the leak entirely.",
    "no_long_cycle_nurture never appears in the report when no_follow_up_sequence has fired — it folds into that fix in the Blueprint/Roadmap instead (no double-counted dollars).",
    "Leaks whose dollar frame declares overlapsWith are SUBSETS of the named leak. They still appear and still show their figure, but they are excluded from every total — use reconcileLeakTotal() in leak-narrative.ts, never a raw sum of the frames.",
  ],

  ranking: [
    "score = impactWeight × TIER_MULTIPLIER[tier] × (verticalBoost applies ? 1.2 : 1.0)",
    "Growth Leak Report: all fired in-scope leaks, ranked by score descending.",
    "Cold audit: top 3 by score, BUT at least 2 of the 3 must be OBSERVED or EVIDENCED — pre-call ammo must be provable, not guessed. If fewer than 2 qualify, take the highest-scoring observable leaks even if lower-scored.",
    "Out-of-scope flags are never ranked against in-scope leaks and never counted in leak totals.",
  ],

  math: [
    "CURRENCY: every client-facing figure is CAD, marked 'CAD $…'. STATS figures published in USD (cpl_google_ads) are converted at USD_TO_CAD and rounded DOWN at the point of use — never rendered with a bare '$'.",
    "PRE-INTAKE (cold audit, pre-close deliverables): NO revenue-dollar claims about their business. Use spend-anchored framing only: industry CPL (cpl_google_ads, converted to CAD) × the leak's benchmark rate, labeled 'industry benchmark — we'll run this with your real numbers'. Example shape: 'At the roofing benchmark of CAD $307 per lead, a 14% missed-call rate on an assumed 20 enquiries a month (our assumption, not a number we measured) is roughly CAD $860/month in paid-for demand going unanswered — benchmark figures, not your books.'",
    "POST-INTAKE: dollar math may use intake.avgJobValueCad and real volumes. Formula per template:",
    "  missed_call_value: monthlyEnquiries × industryMissedRate × 0.85 (never-call-back) × conservativeCloseRate × avgJobValueCad — every factor cited or client-provided, result labeled 'estimated'.",
    "  after_hours_value: missed_call_value × the CONSERVATIVE 28% end of after_hours_28_43. A SUBSET of missed_call_value, never additional to it — the estimate carries overlapsWith + overlapNote and is excluded from totals.",
    "  response_speed_value: qualitative delta framing using speed_close_32_vs_12; do NOT build a fabricated multiplier chain.",
    "  follow_up_value: pattern framing (followup_stops_early softFraming) + the vertical's conversion-gap stat (law_convert_14 / dental_case_acceptance) where applicable. No invented percentages.",
    "  no_show_value: monthlyBookedAppointments × verticalNoShowRate × avgJobValueCad, labeled estimated. The rate comes from the CONSERVATIVE end of the vertical's STATS range (dental 12% via dental_no_show, med spa 15% implied by medspa_show_rate's 85% show rate); only verticals with no such range fall back to ASSUMPTIONS.default_no_show_rate.",
    "ANY factor drawn from ASSUMPTIONS (not STATS) must be labelled as an assumption in the SAME SENTENCE as the number — 'our assumption, not a number we measured'. A frame that hides an assumption behind a citation-shaped phrase is a defect.",
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
