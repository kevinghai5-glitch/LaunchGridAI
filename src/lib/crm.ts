// CRM configuration — the single source of truth for the full lead lifecycle
// (cold → closed), niche prospecting recommendations, the North-American metro
// rotation the daily generator searches, and the opportunity-scoring used to
// rank prospects. Mirrors the project convention: String DB columns + TS unions
// + a constants module (see src/lib/stages.ts and src/lib/call-queue.ts).
//
// The lead's lifecycle is driven by a SINGLE field — Business.status (the
// LeadStatus vocabulary from call-queue.ts). The CRM board maps each status to a
// column; the deal $ rides on the late columns. There is no parallel pipeline.

import type { LeadStatus, Tone } from "@/lib/call-queue";

// ---------------------------------------------------------------------------
// Lifecycle board — every CRM column + which lead statuses live in it
// ---------------------------------------------------------------------------

export type CrmStageId =
  | "SUGGESTED"
  | "QUEUED"
  | "ATTEMPTING"
  | "CALLBACK"
  | "INTERESTED"
  | "BOOKED"
  | "PROPOSAL"
  | "WON"
  | "LOST";

export interface CrmStageDef {
  id: CrmStageId;
  label: string;
  hint: string;
  tone: Tone;
  /** Lead statuses that map into this column. */
  statuses: LeadStatus[];
  /** When true the column carries deal $ (closing half of the funnel). */
  money?: boolean;
}

// Ordered left → right as a lead travels from cold prospect to closed deal.
export const CRM_STAGES: CrmStageDef[] = [
  { id: "SUGGESTED", label: "New Leads", hint: "Awaiting your approval", tone: "muted", statuses: ["SUGGESTED"] },
  { id: "QUEUED", label: "To Call", hint: "Cold-call list", tone: "neutral", statuses: ["QUEUED"] },
  { id: "ATTEMPTING", label: "Attempted", hint: "Called · no answer yet", tone: "neutral", statuses: ["CALLED", "NO_ANSWER"] },
  { id: "CALLBACK", label: "Callback", hint: "Scheduled to call back", tone: "accent", statuses: ["CALLBACK"] },
  { id: "INTERESTED", label: "Warm", hint: "Said yes · audit sent", tone: "accent", statuses: ["WAITING"] },
  { id: "BOOKED", label: "Zoom Booked", hint: "Call scheduled · rebook no-shows", tone: "success", statuses: ["BOOKED_ZOOM", "ZOOM_NO_SHOW"] },
  { id: "PROPOSAL", label: "Proposal Sent", hint: "Awaiting their yes", tone: "accent", statuses: ["PROPOSAL", "ZOOM_OPEN"], money: true },
  { id: "WON", label: "Client", hint: "Closed · retainer live", tone: "success", statuses: ["WON", "CLOSED"], money: true },
  { id: "LOST", label: "Lost", hint: "Dead / declined", tone: "muted", statuses: ["DEAD", "DECLINED"] },
];

// Statuses at which a lead has entered deliverable production — they've booked a
// Zoom (or moved past it: proposal sent / won). Only these leads (or any lead
// that already has generated work) belong in the Library and Studio; cold
// prospects stay out so those surfaces aren't cluttered with un-converted leads.
export const DELIVERABLE_STATUSES: LeadStatus[] = ["BOOKED_ZOOM", "ZOOM_NO_SHOW", "ZOOM_OPEN", "PROPOSAL", "WON", "CLOSED"];

const STATUS_TO_STAGE: Record<string, CrmStageId> = (() => {
  const map: Record<string, CrmStageId> = {};
  for (const stage of CRM_STAGES) {
    for (const s of stage.statuses) map[s] = stage.id;
  }
  return map;
})();

// Resolve a lead's board column from its status. Unknown statuses fall back to
// the Queued column so a lead is never lost off the board.
export function stageForStatus(status: string): CrmStageId {
  return STATUS_TO_STAGE[status] ?? "QUEUED";
}

// ---------------------------------------------------------------------------
// Opportunity scoring — ranks prospects by how much they NEED the service.
// Weaker online presence = more measurable upside = higher score. Identical
// weighting to the legacy Opportunities cards so scores stay consistent.
// ---------------------------------------------------------------------------

export function opportunityScore(
  rating: number,
  reviews: number,
  hasWebsite: boolean
): number {
  let score = 55;
  if (!hasWebsite) score += 25;
  if (rating > 0 && rating < 4.2) score += 15;
  else if (rating === 0) score += 8; // unknown reputation = unmanaged
  if (reviews === 0) score += 12;
  else if (reviews < 25) score += 15;
  else if (reviews < 75) score += 7;
  return Math.min(98, score);
}

// Observable funnel gaps — derived only from real Places signals, never invented.
export function gapsFor(rating: number, reviews: number, hasWebsite: boolean): string[] {
  const gaps: string[] = [];
  if (!hasWebsite) gaps.push("No website detected");
  if (rating > 0 && rating < 4.2) gaps.push(`${rating.toFixed(1)}★ reputation gap`);
  if (reviews === 0) gaps.push("No reviews yet");
  else if (reviews < 25) gaps.push("Thin review volume");
  else if (reviews < 75) gaps.push("Modest review volume");
  if (gaps.length === 0) gaps.push("Strong presence · upsell candidate");
  return gaps;
}

// ---------------------------------------------------------------------------
// Daily prospecting — recommended niches + the metro rotation
// ---------------------------------------------------------------------------

// High-ticket, local-service niches whose customer LTV supports a premium
// retainer for the acquisition system we sell. Grouped into categories so the
// picker can filter (e.g. "just trades") — the shuffle control reshuffles which
// niches from the active category are shown.
export interface NicheCategory {
  id: string;
  label: string;
  niches: string[];
}

export const NICHE_CATEGORIES: NicheCategory[] = [
  {
    id: "trades",
    label: "Trades & Home Services",
    niches: [
      "Roofing",
      "HVAC",
      "Solar Installation",
      "Plumbing",
      "Electrical Contractor",
      "Landscaping & Hardscaping",
      "Pest Control",
      "Garage Door Services",
      "Window & Door Replacement",
      "Kitchen & Bath Remodeling",
      "Tree Service",
      "Foundation Repair",
      "Pool & Outdoor Living",
      "Commercial Cleaning",
      "Auto Body & Collision",
    ],
  },
  {
    id: "medical",
    label: "Medical & Dental",
    niches: [
      "Cosmetic Dentistry",
      "Dental Implants",
      "Orthodontics",
      "Chiropractic",
      "Physical Therapy",
      "Veterinary Clinic",
      "Fertility Clinic",
    ],
  },
  {
    id: "aesthetics",
    label: "Aesthetics & Wellness",
    niches: [
      "Med Spa",
      "Med Spa & Aesthetics",
      "Plastic Surgery",
      "Dermatology",
      "Med Weight Loss",
      "IV Therapy & Wellness",
      "Hair Restoration",
      "Fitness & Performance",
    ],
  },
  {
    id: "legal",
    label: "Legal",
    niches: [
      "Law Firm",
      "Personal Injury Lawyer",
      "Bankruptcy Lawyer",
      "Family Law Firm",
      "Estate Planning Attorney",
    ],
  },
  {
    id: "realestate",
    label: "Real Estate & Property",
    niches: [
      "Real Estate Team",
      "Mortgage Broker",
      "Property Management",
      "Custom Home Builder",
    ],
  },
  {
    id: "boutique",
    label: "Boutique & Lifestyle",
    niches: [
      "Salon & Spa",
      "Boutique Fitness Studio",
      "Bridal Boutique",
      "Interior Design Studio",
      "Pet Grooming & Boarding",
      "Photography Studio",
    ],
  },
];

// Flat pool (all categories) — kept for back-compat and the "All" filter.
export const NICHE_RECOMMENDATIONS: string[] = NICHE_CATEGORIES.flatMap((c) => c.niches);

// How many recommended-niche chips to surface in the picker at once.
export const NICHE_VISIBLE_COUNT = 12;

// Return a fresh random subset of the recommendation pool. Powers the picker's
// shuffle control. Pass a categoryId to restrict the pool to one category
// (falls back to the whole pool for "all" / unknown). Falls back to the whole
// pool if it's smaller than `count`.
export function sampleNiches(count = NICHE_VISIBLE_COUNT, categoryId?: string): string[] {
  const source =
    categoryId && categoryId !== "all"
      ? NICHE_CATEGORIES.find((c) => c.id === categoryId)?.niches ?? NICHE_RECOMMENDATIONS
      : NICHE_RECOMMENDATIONS;
  const pool = [...source];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

// Major North-American metros the generator rotates through under the hood.
// Google Places Text Search is local + caps at 60/query, so "best in NA" is
// achieved by aggregating across metros and serving the next unseen batch.
export const NA_METROS: string[] = [
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Toronto, ON",
  "Dallas, TX",
  "Miami, FL",
  "Atlanta, GA",
  "Denver, CO",
  "Seattle, WA",
  "Boston, MA",
  "San Diego, CA",
  "Vancouver, BC",
  "Austin, TX",
  "Calgary, AB",
  "Philadelphia, PA",
  "Charlotte, NC",
  "Nashville, TN",
  "Las Vegas, NV",
];

// Default batch size — the number pre-filled in the Opportunities count box.
// The operator types over it; a run is whatever he asks for, within the bounds
// below.
export const DAILY_BATCH_SIZE = 30;

// Bounds on an operator-chosen batch. The ceiling is not arbitrary: Google
// Places Text Search returns at most 60 results per query (3 pages, hard API
// cap), gatherProspects searches ~2x the target to leave room for scoring, and
// during a tight calling window only ~8 of the 20 metros are open — so ~480 raw
// results is the real ceiling at the worst hour, and that erodes further as the
// dedup set grows. 150 stays inside that even on a bad afternoon; asking for
// more would quietly return short rather than fail, which is worse.
export const MIN_BATCH_SIZE = 1;
export const MAX_BATCH_SIZE = 150;

// Clamp an operator-supplied batch size to the bounds above. Non-numeric,
// missing, or fractional input falls back to the default rather than erroring —
// a typo in the count box should never cost a generation.
export function clampBatchSize(value: unknown): number {
  // ABSENT is not the same as ZERO. Number("") and Number(null) are both 0,
  // which would clamp up to MIN_BATCH_SIZE — so clearing the count box to retype
  // it, then hitting Generate, would have sourced exactly ONE lead. Absent has
  // to mean "use the default" before any coercion happens.
  if (value === null || value === undefined) return DAILY_BATCH_SIZE;
  if (typeof value === "string" && value.trim() === "") return DAILY_BATCH_SIZE;

  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DAILY_BATCH_SIZE;
  const floored = Math.floor(n);
  if (floored < MIN_BATCH_SIZE) return MIN_BATCH_SIZE;
  if (floored > MAX_BATCH_SIZE) return MAX_BATCH_SIZE;
  return floored;
}

// How long a declined lead stays suppressed before it can resurface (days).
export const DECLINE_COOLDOWN_DAYS = 90;
