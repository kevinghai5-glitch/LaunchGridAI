export const DEAL_STAGES = [
  { key: "SAVED", label: "Saved", color: "bg-slate-500" },
  { key: "SYSTEMS_GENERATED", label: "Systems Generated", color: "bg-blue-500" },
  { key: "PROPOSAL_SENT", label: "Proposal Sent", color: "bg-yellow-500" },
  { key: "FOLLOW_UP", label: "Follow-Up", color: "bg-orange-500" },
  { key: "WON", label: "Won", color: "bg-green-500" },
  { key: "LOST", label: "Lost", color: "bg-red-500" },
] as const;

export type DealStage = (typeof DEAL_STAGES)[number]["key"];

export const PROPOSAL_STATUSES = [
  { key: "DRAFT", label: "Draft", color: "bg-slate-500" },
  { key: "SENT", label: "Sent", color: "bg-blue-500" },
  { key: "VIEWED", label: "Viewed", color: "bg-yellow-500" },
  { key: "ACCEPTED", label: "Accepted", color: "bg-green-500" },
  { key: "REJECTED", label: "Rejected", color: "bg-red-500" },
] as const;

// ── WHERE THIS APP LIVES ────────────────────────────────────────────────────
// Two different questions, deliberately two different constants.
//
//   APP_URL          where the app is running RIGHT NOW. Falls back to
//                    localhost so a fresh clone boots without configuration.
//   PUBLIC_BASE_URL  where a link we hand to a CLIENT should point. `undefined`
//                    until NEXT_PUBLIC_APP_URL names a real host.
//
// They were one constant, and that is the bug. A share link built on
// http://localhost:3000 looks perfectly correct in the operator's browser and is
// dead the moment it reaches the client's inbox — the failure lands on the
// client, days later, with no error anywhere. So the dev fallback is no longer
// allowed to masquerade as a shareable address: every surface that copies a URL
// for someone else reads PUBLIC_BASE_URL, and when that is undefined it says so
// loudly instead of handing over a link that cannot work.
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") || "http://localhost:3000";

/** APP_URL is still the local dev fallback (or points at this machine). */
export const APP_URL_IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(
  APP_URL
);

/** The base for any URL that leaves this machine. Undefined until configured. */
export const PUBLIC_BASE_URL: string | undefined = APP_URL_IS_LOCAL ? undefined : APP_URL;

/** What to set, quoted verbatim wherever we have to explain the absence. */
export const PUBLIC_URL_ENV_VAR = "NEXT_PUBLIC_APP_URL";

// APP_URL without the scheme — for anywhere we DISPLAY a link as a chrome-style
// address rather than linking to it (browser-frame previews). Derived so the
// shown string and the copied string can never drift apart.
export const APP_HOST = APP_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "");

// The name we identify ourselves under to anyone outside the company. Every
// audit we run lands in the prospect's server logs, so the crawler has to say
// who is actually knocking — the internal repo name never leaves the repo.
export const BRAND_NAME = "ReclaimedHQ";

// User-Agent for the public-site scraper. The "+" URL points at our own app so
// an admin reading their access log can look us up. Built from the single
// configured APP_URL so there is never a second copy of the domain to drift.
export const CRAWLER_USER_AGENT = `Mozilla/5.0 (compatible; ${BRAND_NAME}Bot/1.0; +${APP_URL})`;

// Where the free teaser's single CTA sends a prospect to book the call.
// Undefined until it is configured: the teaser then renders the close as plain
// text (today's behaviour) rather than shipping a dead or wrong link.
export const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL?.trim() || undefined;

// ── THE OFFER — one source of truth for the two prices ──────────────────────
// Both figures are CAD. They are ONE deal in TWO parts, and the split is the
// single most expensive thing to get wrong on a call:
//
//   SETUP_FEE_CAD        ONE-TIME. The four deliverables (D1–D4) plus the build
//                        we do for them — the GoHighLevel workflows, the CRM
//                        pipeline, the booking calendar and page, the
//                        lead-capture form, the dedicated phone number.
//   MONTHLY_RETAINER_CAD RETAINER. LeadGate qualifying every new lead, us
//                        running and tuning the live system, and the monthly
//                        report. LeadGate is NEVER part of the one-time build —
//                        it is the thing the monthly pays for.
//
// They live here rather than in the proposal builder so the operator's Workspace
// screen and the proposal it generates read from the same numbers and can never
// quote a client two different prices.
export const SETUP_FEE_CAD = 6500;
export const MONTHLY_RETAINER_CAD = 1000;

// What one signed client is worth across a first year. DERIVED, never typed by
// hand, so the headline on the Workspace screen cannot drift from the two
// figures above when a price changes.
export const FIRST_YEAR_VALUE_CAD = SETUP_FEE_CAD + MONTHLY_RETAINER_CAD * 12;

// ── THE TWO CLOSING LINKS ───────────────────────────────────────────────────
// The bottom of the client-facing offer page is two buttons: sign, then pay.
// Both are external — the agreement lives with the e-sign provider, the payment
// with Stripe — so this app stores no contract and touches no card.
//
// Undefined until configured. The offer page renders an unset link as a LOUD
// PLACEHOLDER naming the variable to set, never as a blank or dead button: a
// button a client can click that goes nowhere costs a signature.
export const AGREEMENT_URL = process.env.NEXT_PUBLIC_AGREEMENT_URL?.trim() || undefined;
export const PAYMENT_URL = process.env.NEXT_PUBLIC_PAYMENT_URL?.trim() || undefined;

export const AGREEMENT_URL_ENV_VAR = "NEXT_PUBLIC_AGREEMENT_URL";
export const PAYMENT_URL_ENV_VAR = "NEXT_PUBLIC_PAYMENT_URL";
