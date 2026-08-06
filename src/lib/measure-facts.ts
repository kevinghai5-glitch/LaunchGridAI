/** The manual pre-call measure — the "Fetch measured values" button.
 *
 *  WHY THIS EXISTS. computeObservedFacts derives its four values from
 *  researchSnapshot / psiSnapshot, and those columns are written ONLY by the
 *  paid pack path (/api/generate/assets). So a freshly prospected business shows
 *  four dashes on exactly the screen it was built for — the call queue. This
 *  closes that gap for the handful of businesses that book a Zoom.
 *
 *  DELIBERATELY CHEAP — the whole point. Exactly two external calls:
 *    1. ONE mobile-only PageSpeed run. Not desktop: the row shows mobile, so the
 *       other half of the snapshot pair is pure cost here.
 *    2. ONE plain HTTP GET of the homepage via fetchWebsitePage — the same
 *       unbilled fetch the research path already uses. NOT Firecrawl: its
 *       multi-page markdown extraction exists to feed the paid report's prose,
 *       and the two things needed here are href pattern checks.
 *  No DataForSEO. No competitor search. No Firecrawl. Two calls, per business,
 *  only when the operator clicks.
 *
 *  scripts/verify-facts.ts asserts that constraint at source level, so widening
 *  it fails a test rather than quietly costing money.
 */
import { runOne } from "@/lib/pagespeed";
import { fetchWebsitePage } from "@/lib/website-analyzer";
import { BOOKING_HOSTS } from "@/lib/business-facts";

/** found = we retrieved the page and the pattern is there.
 *  none  = we retrieved the page and it is not there.
 *  unknown = we could not retrieve the page at all.
 *
 *  THE THIRD STATE IS THE POINT. "Could not see" is not "is not there", and
 *  collapsing them would let a bot-walled or unreachable site read as a finding
 *  about the business. Every consumer of this shape must keep them distinct. */
export type MeasuredPresence = "found" | "none" | "unknown";

export interface MeasuredFacts {
  /** null when PageSpeed had no key, timed out, or refused the URL. Never a 0 —
   *  a zero score is a real measurement and this is the absence of one. */
  mobile: { score: number | null; loadSeconds: number | null } | null;
  bookingLink: MeasuredPresence;
  clickToCall: MeasuredPresence;
}

/** A tel: link anywhere in the retrieved HTML. Unquoted and single-quoted hrefs
 *  both count — plenty of real sites emit href=tel:+15551234567. */
const TEL_RE = /href\s*=\s*["']?\s*tel:/i;

function detectBooking(html: string): boolean {
  const lower = html.toLowerCase();
  // Host match only. A page can say the word "book" a dozen times without
  // carrying a scheduler; the link to a booking provider is the checkable fact.
  return BOOKING_HOSTS.some((host) => lower.includes(host));
}

/** Run the two calls and report what was actually observed.
 *
 *  Never throws: a failed half degrades to null/"unknown" so a flaky PageSpeed
 *  call cannot cost the operator the page-fetch result he did get. */
export async function measureFacts(website: string | null | undefined): Promise<MeasuredFacts> {
  const url = (website ?? "").trim();
  if (!url) {
    return { mobile: null, bookingLink: "unknown", clickToCall: "unknown" };
  }

  let normalized: string;
  try {
    normalized = new URL(url).toString();
  } catch {
    return { mobile: null, bookingLink: "unknown", clickToCall: "unknown" };
  }

  // The two calls, in parallel. Settled rather than all-or-nothing: one vendor
  // being down must not discard the other's answer.
  const [psi, page] = await Promise.all([
    runOne(normalized, "mobile").catch(() => null),
    fetchWebsitePage(normalized).catch(() => ({ text: "", html: "" })),
  ]);

  const mobile = psi
    ? { score: psi.performanceScore ?? null, loadSeconds: psi.metrics?.lcpSeconds ?? null }
    : null;

  // An empty body is a fetch that did not really succeed (timeout, bot wall, a
  // JS-only shell). Absence of evidence, so both booleans stay unknown.
  const html = page?.html ?? "";
  if (!html.trim()) {
    return { mobile, bookingLink: "unknown", clickToCall: "unknown" };
  }

  return {
    mobile,
    bookingLink: detectBooking(html) ? "found" : "none",
    clickToCall: TEL_RE.test(html) ? "found" : "none",
  };
}
