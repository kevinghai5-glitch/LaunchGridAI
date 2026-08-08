// Cold-call timing — which metros are in a good LOCAL calling window right now.
//
// The daily generator sources prospects across NA metros. This gates + orders
// those metros by the CURRENT local time in each metro's OWN time zone, so a
// list generated at 9am ET surfaces Eastern/Central businesses (California is
// 6am — asleep), and a list generated at 6pm ET flips to Western businesses
// (still ~3-4pm out there — prime afternoon). "Broad" window: 8am-5pm local,
// minus the 12-1pm lunch hour; peak windows (8-9, 10-11, 4-5) are ordered first.

// Metro → IANA time zone. THE source of the metro rotation: NA_METROS in crm.ts
// is derived from these keys, so a metro cannot exist without a verified zone.
//
// EVERY ENTRY IS MACHINE-CHECKED by scripts/verify-metros.ts, which compares each
// zone's January and July UTC offsets against the offsets its state/province is
// documented to keep, and fails on any mismatch. It is not eyeballed: the whole
// calling strategy depends on knowing the LOCAL hour in each metro, and a single
// wrong zone dials somebody's lunch hour for months without ever looking wrong.
//
// THE TRAPS, named so nobody "tidies" them:
//   · Phoenix/Tucson/Mesa/Scottsdale — Arizona does NOT observe DST. America/Phoenix
//     is Mountain in winter and matches Pacific in summer. Never America/Denver.
//   · Regina/Saskatoon — Saskatchewan does NOT observe DST. America/Regina.
//   · Indianapolis — America/Indiana/Indianapolis, not America/New_York. It keeps
//     Eastern time today but has its own DST history; the alias is not equivalent.
//   · El Paso — Texas, but MOUNTAIN. America/Denver, not America/Chicago.
//   · Pensacola — Florida, but CENTRAL. America/Chicago, not America/New_York.
//   · Nashville/Memphis are Central; Knoxville/Chattanooga are Eastern. Tennessee
//     is split and the split runs between cities we source from.
//   · Louisville/Lexington are Eastern; Kentucky is split the same way.
//   · Halifax is ATLANTIC (-4/-3), the only non-US-mainland offset in the list.
//   · Montreal/Quebec City use America/Toronto. America/Montreal is a deprecated
//     alias that some runtimes no longer ship.
//
// SHORT NAMES MUST BE UNIQUE. timezoneForCity() matches on the part before the
// comma, because gatherProspects strips the state before persisting. That is why
// there is no Portland, ME beside Portland, OR and no Charleston, WV beside
// Charleston, SC — the verifier fails on any collision.
export const METRO_TIMEZONES: Record<string, string> = {
  // ── Eastern ────────────────────────────────────────────────────────────────
  "New York, NY": "America/New_York",
  "Philadelphia, PA": "America/New_York",
  "Boston, MA": "America/New_York",
  "Washington, DC": "America/New_York",
  "Atlanta, GA": "America/New_York",
  "Miami, FL": "America/New_York",
  "Tampa, FL": "America/New_York",
  "Orlando, FL": "America/New_York",
  "Jacksonville, FL": "America/New_York",
  "Sarasota, FL": "America/New_York",
  "Naples, FL": "America/New_York",
  "Charlotte, NC": "America/New_York",
  "Raleigh, NC": "America/New_York",
  "Greensboro, NC": "America/New_York",
  "Pittsburgh, PA": "America/New_York",
  "Allentown, PA": "America/New_York",
  "Baltimore, MD": "America/New_York",
  "Richmond, VA": "America/New_York",
  "Norfolk, VA": "America/New_York",
  "Buffalo, NY": "America/New_York",
  "Rochester, NY": "America/New_York",
  "Syracuse, NY": "America/New_York",
  "Albany, NY": "America/New_York",
  "Hartford, CT": "America/New_York",
  "Providence, RI": "America/New_York",
  "Manchester, NH": "America/New_York",
  "Wilmington, DE": "America/New_York",
  "Columbia, SC": "America/New_York",
  "Charleston, SC": "America/New_York",
  "Greenville, SC": "America/New_York",
  "Cleveland, OH": "America/New_York",
  "Columbus, OH": "America/New_York",
  "Cincinnati, OH": "America/New_York",
  "Akron, OH": "America/New_York",
  "Toledo, OH": "America/New_York",
  "Dayton, OH": "America/New_York",
  "Detroit, MI": "America/New_York",
  "Grand Rapids, MI": "America/New_York",
  "Louisville, KY": "America/New_York",
  "Lexington, KY": "America/New_York",
  "Knoxville, TN": "America/New_York",
  "Chattanooga, TN": "America/New_York",
  "Indianapolis, IN": "America/Indiana/Indianapolis",

  // ── Central ────────────────────────────────────────────────────────────────
  "Chicago, IL": "America/Chicago",
  "Houston, TX": "America/Chicago",
  "Dallas, TX": "America/Chicago",
  "Fort Worth, TX": "America/Chicago",
  "Austin, TX": "America/Chicago",
  "San Antonio, TX": "America/Chicago",
  "Corpus Christi, TX": "America/Chicago",
  "Lubbock, TX": "America/Chicago",
  "McAllen, TX": "America/Chicago",
  "Nashville, TN": "America/Chicago",
  "Memphis, TN": "America/Chicago",
  "New Orleans, LA": "America/Chicago",
  "Baton Rouge, LA": "America/Chicago",
  "Shreveport, LA": "America/Chicago",
  "Kansas City, MO": "America/Chicago",
  "St. Louis, MO": "America/Chicago",
  "Springfield, MO": "America/Chicago",
  "Minneapolis, MN": "America/Chicago",
  "Milwaukee, WI": "America/Chicago",
  "Madison, WI": "America/Chicago",
  "Green Bay, WI": "America/Chicago",
  "Omaha, NE": "America/Chicago",
  "Des Moines, IA": "America/Chicago",
  "Oklahoma City, OK": "America/Chicago",
  "Tulsa, OK": "America/Chicago",
  "Little Rock, AR": "America/Chicago",
  "Birmingham, AL": "America/Chicago",
  "Huntsville, AL": "America/Chicago",
  "Mobile, AL": "America/Chicago",
  "Jackson, MS": "America/Chicago",
  "Wichita, KS": "America/Chicago",
  "Fargo, ND": "America/Chicago",
  "Sioux Falls, SD": "America/Chicago",
  "Pensacola, FL": "America/Chicago",

  // ── Mountain ───────────────────────────────────────────────────────────────
  "Denver, CO": "America/Denver",
  "Colorado Springs, CO": "America/Denver",
  "Fort Collins, CO": "America/Denver",
  "Salt Lake City, UT": "America/Denver",
  "Albuquerque, NM": "America/Denver",
  "Boise, ID": "America/Denver",
  "Billings, MT": "America/Denver",
  "El Paso, TX": "America/Denver",

  // ── Arizona (no DST) ───────────────────────────────────────────────────────
  "Phoenix, AZ": "America/Phoenix",
  "Tucson, AZ": "America/Phoenix",
  "Mesa, AZ": "America/Phoenix",
  "Scottsdale, AZ": "America/Phoenix",

  // ── Pacific ────────────────────────────────────────────────────────────────
  "Los Angeles, CA": "America/Los_Angeles",
  "San Diego, CA": "America/Los_Angeles",
  "San Francisco, CA": "America/Los_Angeles",
  "San Jose, CA": "America/Los_Angeles",
  "Sacramento, CA": "America/Los_Angeles",
  "Fresno, CA": "America/Los_Angeles",
  "Bakersfield, CA": "America/Los_Angeles",
  "Riverside, CA": "America/Los_Angeles",
  "Anaheim, CA": "America/Los_Angeles",
  "Long Beach, CA": "America/Los_Angeles",
  "Oakland, CA": "America/Los_Angeles",
  "Santa Ana, CA": "America/Los_Angeles",
  "Irvine, CA": "America/Los_Angeles",
  "Modesto, CA": "America/Los_Angeles",
  "Stockton, CA": "America/Los_Angeles",
  "Seattle, WA": "America/Los_Angeles",
  "Tacoma, WA": "America/Los_Angeles",
  "Spokane, WA": "America/Los_Angeles",
  "Portland, OR": "America/Los_Angeles",
  "Eugene, OR": "America/Los_Angeles",
  "Salem, OR": "America/Los_Angeles",
  "Las Vegas, NV": "America/Los_Angeles",
  "Reno, NV": "America/Los_Angeles",

  // ── Canada ─────────────────────────────────────────────────────────────────
  "Toronto, ON": "America/Toronto",
  "Ottawa, ON": "America/Toronto",
  "Hamilton, ON": "America/Toronto",
  "London, ON": "America/Toronto",
  "Mississauga, ON": "America/Toronto",
  "Montreal, QC": "America/Toronto",
  "Quebec City, QC": "America/Toronto",
  "Halifax, NS": "America/Halifax",
  "Winnipeg, MB": "America/Winnipeg",
  "Regina, SK": "America/Regina",
  "Saskatoon, SK": "America/Regina",
  "Calgary, AB": "America/Edmonton",
  "Edmonton, AB": "America/Edmonton",
  "Vancouver, BC": "America/Vancouver",
  "Victoria, BC": "America/Vancouver",
  "Kelowna, BC": "America/Vancouver",
};

// IANA zone for a stored city value. Leads carry the SHORT city ("Toronto"),
// because gatherProspects strips the state off the metro before persisting,
// while the map above is keyed by the full metro ("Toronto, ON") — so match on
// the part before the comma. All 20 short names are unique, so this can't
// collide — scripts/verify-metros.ts fails on any collision.
//
// Returns "" for anything not in the metro rotation (a business added by name
// through Studio can carry any city string). A GUESSED time zone in a
// power-dialer export is worse than a blank one: it would schedule a call into
// the wrong window and look authoritative doing it.
export function timezoneForCity(city: string | null | undefined): string {
  const key = (city ?? "").split(",")[0].trim().toLowerCase();
  if (!key) return "";
  for (const [metro, tz] of Object.entries(METRO_TIMEZONES)) {
    if (metro.split(",")[0].trim().toLowerCase() === key) return tz;
  }
  return "";
}

// Peak cold-call windows (local hour), per the cold-call SOP: 8-9am (golden),
// 10-11am (peak), 4-5pm (strong second window).
const PEAK_HOURS = new Set([8, 10, 16]);
const LUNCH_HOUR = 12; // 12-1pm — excluded
const DAY_START = 8; // 8am
const DAY_END = 17; // 5pm (exclusive)
const CALLABLE_HOURS = [8, 9, 10, 11, 13, 14, 15, 16];

// Current local hour (0-23) in a metro, DST-aware. null if metro isn't mapped.
export function localHourInMetro(metro: string, now: Date): number | null {
  const tz = METRO_TIMEZONES[metro];
  if (!tz) return null;
  const hh = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  }).format(now);
  const h = parseInt(hh, 10);
  if (Number.isNaN(h)) return null;
  return h === 24 ? 0 : h; // some engines emit "24" for midnight
}

// Call tier at `now`: 2 = peak window, 1 = good business hour, 0 = don't call
// (before 8am, the 12-1pm lunch hour, or 5pm and later).
export function metroCallTier(metro: string, now: Date): number {
  const h = localHourInMetro(metro, now);
  if (h == null) return 0;
  if (h < DAY_START || h >= DAY_END || h === LUNCH_HOUR) return 0;
  return PEAK_HOURS.has(h) ? 2 : 1;
}

// Hours until a metro's next callable window — used only to order the off-hours
// fallback (soonest-to-open first) when nothing is callable anywhere.
function hoursToCallable(metro: string, now: Date): number {
  const h = localHourInMetro(metro, now);
  if (h == null) return 99;
  let best = 99;
  for (const c of CALLABLE_HOURS) {
    let d = c - h;
    if (d < 0) d += 24;
    best = Math.min(best, d);
  }
  return best;
}

// Is ANY of these metros callable right now?
export function anyMetroCallableNow(metros: string[], now: Date): boolean {
  return metros.some((m) => metroCallTier(m, now) > 0);
}

// Order metros for sourcing at `now`. When any are callable, returns ONLY the
// callable ones (peak before good), rotated by `offset` within each tier for
// day-to-day freshness. When none are callable (late night), returns all metros
// ordered soonest-to-open, with anyCallable=false so the caller can flag it.
export function orderMetrosByCallTime(
  metros: string[],
  now: Date,
  offset = 0
): { metros: string[]; anyCallable: boolean } {
  const rot = (arr: string[]): string[] => {
    if (arr.length === 0) return arr;
    const k = ((offset % arr.length) + arr.length) % arr.length;
    return arr.slice(k).concat(arr.slice(0, k));
  };
  const tiered = metros.map((m) => ({ m, tier: metroCallTier(m, now) }));
  const callable = tiered.filter((x) => x.tier > 0);
  if (callable.length > 0) {
    const peak = rot(callable.filter((x) => x.tier === 2).map((x) => x.m));
    const good = rot(callable.filter((x) => x.tier === 1).map((x) => x.m));
    return { metros: [...peak, ...good], anyCallable: true };
  }
  const byDistance = [...metros].sort(
    (a, b) => hoursToCallable(a, now) - hoursToCallable(b, now)
  );
  return { metros: byDistance, anyCallable: false };
}

// ── SURFACING THE WINDOW ON A SAVED LEAD ─────────────────────────────────────
// Everything above takes a full metro ("Toronto, ON") because that is what the
// GENERATOR rotates over. A saved lead carries the SHORT city ("Toronto"), since
// gatherProspects strips the state before persisting — so the call queue could
// not use any of it, and showed no timing at all.
//
// This is the same gate, keyed off what a lead actually stores. It is a READ, not
// a scheduler: it answers "what time is it there, right now" for whatever moment
// you pass it, and the operator decides what to do with that. No block is
// enforced, nothing is hidden, no hour is hardcoded — sit down at 2pm and the
// queue tells you who is in a good window at 2pm.

export type CallWindow = "peak" | "open" | "closed" | "unknown";

export interface CityCallWindow {
  /** Local hour 0–23 in the lead's city, or null when the city is not in the
   *  rotation (a hand-added business can carry any string). */
  localHour: number | null;
  window: CallWindow;
}

export function callWindowForCity(city: string | null | undefined, now: Date): CityCallWindow {
  const tz = timezoneForCity(city);
  // Unknown city → "unknown", never a guess. A lead shown as callable on a
  // guessed zone is worse than one shown as unknown: it looks authoritative.
  if (!tz) return { localHour: null, window: "unknown" };

  const localHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(now)
  );
  if (localHour < DAY_START || localHour >= DAY_END || localHour === LUNCH_HOUR) {
    return { localHour, window: "closed" };
  }
  return { localHour, window: PEAK_HOURS.has(localHour) ? "peak" : "open" };
}
