// Cold-call timing — which metros are in a good LOCAL calling window right now.
//
// The daily generator sources prospects across NA metros. This gates + orders
// those metros by the CURRENT local time in each metro's OWN time zone, so a
// list generated at 9am ET surfaces Eastern/Central businesses (California is
// 6am — asleep), and a list generated at 6pm ET flips to Western businesses
// (still ~3-4pm out there — prime afternoon). "Broad" window: 8am-5pm local,
// minus the 12-1pm lunch hour; peak windows (8-9, 10-11, 4-5) are ordered first.

// Metro → IANA time zone. Intl handles daylight saving automatically.
export const METRO_TIMEZONES: Record<string, string> = {
  "New York, NY": "America/New_York",
  "Los Angeles, CA": "America/Los_Angeles",
  "Chicago, IL": "America/Chicago",
  "Houston, TX": "America/Chicago",
  "Phoenix, AZ": "America/Phoenix",
  "Toronto, ON": "America/Toronto",
  "Dallas, TX": "America/Chicago",
  "Miami, FL": "America/New_York",
  "Atlanta, GA": "America/New_York",
  "Denver, CO": "America/Denver",
  "Seattle, WA": "America/Los_Angeles",
  "Boston, MA": "America/New_York",
  "San Diego, CA": "America/Los_Angeles",
  "Vancouver, BC": "America/Vancouver",
  "Austin, TX": "America/Chicago",
  "Calgary, AB": "America/Edmonton",
  "Philadelphia, PA": "America/New_York",
  "Charlotte, NC": "America/New_York",
  "Nashville, TN": "America/Chicago",
  "Las Vegas, NV": "America/Los_Angeles",
};

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
