// THE TIMEZONE MAP IS LOAD-BEARING — this proves it, entry by entry.
//
//   node_modules/.bin/tsx scripts/verify-metros.ts
//   npm run verify:metros
//
// The whole calling strategy is "dial when it is a good LOCAL hour there". 11:00
// Toronto works because it is 08:00 in Los Angeles and 10:00 in Chicago. One
// wrong zone dials somebody's lunch hour every day for six months and never
// looks wrong on screen — the list is full, the names are real, the numbers
// connect. Nothing surfaces the mistake.
//
// So no entry is eyeballed. Each metro's zone is checked against the offsets its
// state or province is documented to keep, in BOTH January and July, which is
// what catches the DST traps (Arizona, Saskatchewan) — a wrong zone that happens
// to match in winter separates in summer.

import {
  METRO_TIMEZONES,
  timezoneForCity,
  metroCallTier,
  localHourInMetro,
  legalCallHours,
  isCanadianZone,
  callWindowForCity,
} from "../src/lib/call-timing";
import { NA_METROS } from "../src/lib/crm";

let pass = 0;
const failures: string[] = [];
const check = (name: string, cond: boolean, detail = "") => {
  if (cond) pass++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
};

/** Actual UTC offset in hours for a zone on a given instant. Read from the
 *  runtime's own tz database, never from a table we maintain. */
function offsetHours(tz: string, iso: string): number {
  const d = new Date(iso);
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  const local = new Date(d.toLocaleString("en-US", { timeZone: tz }));
  return Math.round((local.getTime() - utc.getTime()) / 3_600_000);
}

const JAN = "2026-01-15T18:00:00Z"; // northern winter — standard time everywhere
const JUL = "2026-07-15T18:00:00Z"; // northern summer — DST where observed

/** [January offset, July offset] each region is documented to keep. */
const RULES: Record<string, [number, number]> = {
  eastern: [-5, -4],
  central: [-6, -5],
  mountain: [-7, -6],
  arizona: [-7, -7], // no DST
  pacific: [-8, -7],
  atlantic: [-4, -3], // Halifax
  saskatchewan: [-6, -6], // no DST
};

/** Which rule each ZONE must satisfy. Keyed by zone, not by metro, so adding a
 *  metro to an already-verified zone needs no new expectation. */
const ZONE_RULE: Record<string, keyof typeof RULES> = {
  "America/New_York": "eastern",
  "America/Indiana/Indianapolis": "eastern",
  "America/Toronto": "eastern",
  "America/Chicago": "central",
  "America/Winnipeg": "central",
  "America/Denver": "mountain",
  "America/Edmonton": "mountain",
  "America/Phoenix": "arizona",
  "America/Los_Angeles": "pacific",
  "America/Vancouver": "pacific",
  "America/Halifax": "atlantic",
  "America/Regina": "saskatchewan",
};

const metros = Object.keys(METRO_TIMEZONES);

// ── A · every zone is real and keeps the offsets its region keeps ────────────
{
  const zones = Array.from(new Set(Object.values(METRO_TIMEZONES)));
  for (const tz of zones) {
    // A zone the runtime does not ship throws here rather than silently
    // falling back to UTC, which would read as "everywhere is callable".
    let valid = true;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    } catch {
      valid = false;
    }
    check(`A1 ${tz} is a real IANA zone`, valid);
    if (!valid) continue;

    const rule = ZONE_RULE[tz];
    check(`A2 ${tz} has a documented expectation`, Boolean(rule),
      "add it to ZONE_RULE with the offsets its region keeps — an unchecked zone is an unchecked metro");
    if (!rule) continue;

    const [wantJan, wantJul] = RULES[rule];
    const gotJan = offsetHours(tz, JAN);
    const gotJul = offsetHours(tz, JUL);
    check(`A3 ${tz} January offset`, gotJan === wantJan, `got UTC${gotJan}, want UTC${wantJan} (${rule})`);
    check(`A4 ${tz} July offset`, gotJul === wantJul, `got UTC${gotJul}, want UTC${wantJul} (${rule})`);
  }
}

// ── B · the DST traps, asserted by name ──────────────────────────────────────
// These are the four that a plausible-looking "tidy-up" would break.
{
  const az = offsetHours("America/Phoenix", JAN) === offsetHours("America/Phoenix", JUL);
  check("B1 Arizona does not shift for DST", az, "Phoenix must be America/Phoenix, never America/Denver");
  const sk = offsetHours("America/Regina", JAN) === offsetHours("America/Regina", JUL);
  check("B2 Saskatchewan does not shift for DST", sk, "Regina/Saskatoon must be America/Regina");

  // In JULY, Arizona reads the same hour as Pacific — the exact coincidence that
  // makes a wrong Denver mapping look right for half the year.
  check("B3 Phoenix matches Pacific in summer (why the trap is a trap)",
    offsetHours("America/Phoenix", JUL) === offsetHours("America/Los_Angeles", JUL));
  check("B4 …and matches Mountain in winter",
    offsetHours("America/Phoenix", JAN) === offsetHours("America/Denver", JAN));

  check("B5 El Paso is Mountain, not Central", METRO_TIMEZONES["El Paso, TX"] === "America/Denver");
  check("B6 Pensacola is Central, not Eastern", METRO_TIMEZONES["Pensacola, FL"] === "America/Chicago");
  check("B7 Indianapolis uses its own zone", METRO_TIMEZONES["Indianapolis, IN"] === "America/Indiana/Indianapolis");
  check("B8 Nashville is Central", METRO_TIMEZONES["Nashville, TN"] === "America/Chicago");
  check("B9 Knoxville is Eastern (Tennessee is split)", METRO_TIMEZONES["Knoxville, TN"] === "America/New_York");
  check("B10 Halifax is Atlantic", METRO_TIMEZONES["Halifax, NS"] === "America/Halifax");
}

// ── C · short names are unique, because that is what gets stored ─────────────
// gatherProspects strips the state before persisting, so the row carries
// "Portland". Two Portlands and every lead in one of them gets the other's zone.
{
  const shorts = metros.map((m) => m.split(",")[0].trim().toLowerCase());
  const dupes = Array.from(new Set(shorts.filter((s, i) => shorts.indexOf(s) !== i)));
  check("C1 no two metros share a short name", dupes.length === 0, dupes.join(", "));

  // And every metro round-trips through the lookup the exporter actually calls.
  const broken = metros.filter((m) => timezoneForCity(m.split(",")[0]) !== METRO_TIMEZONES[m]);
  check("C2 every metro resolves through timezoneForCity", broken.length === 0, broken.join(", "));

  // An unknown city must return "" — a GUESSED zone in a dialer CSV is worse
  // than a blank one.
  check("C3 an unknown city resolves to blank, never a guess", timezoneForCity("Atlantis") === "");
}

// ── D · the rotation and the map are the same set ────────────────────────────
{
  check("D1 NA_METROS is derived from the map", NA_METROS.length === metros.length,
    `rotation ${NA_METROS.length} vs map ${metros.length}`);
  const missing = NA_METROS.filter((m) => !METRO_TIMEZONES[m]);
  check("D2 every metro in the rotation has a zone", missing.length === 0, missing.join(", "));
}

// ── E · the gate still behaves at the hours he actually dials ────────────────
// Not a restatement of the map: this runs the real tier function and asserts the
// windows he plans around are what the software will serve.
{
  const at = (etHour: number) => new Date(Date.UTC(2026, 6, 15, etHour + 4)); // July, EDT
  const callable = (d: Date) => metros.filter((m) => metroCallTier(m, d) > 0);

  const at11 = at(11);
  check("E1 at 11:00 ET, Los Angeles is 08:00 local", localHourInMetro("Los Angeles, CA", at11) === 8);
  check("E2 at 11:00 ET, Chicago is 10:00 local", localHourInMetro("Chicago, IL", at11) === 10);
  check("E3 at 11:00 ET, Toronto is 11:00 local", localHourInMetro("Toronto, ON", at11) === 11);
  // 11:00 ET holds back exactly THREE metros, all for the same reason: BC is at
  // 08:00, which is legal in the US and an hour inside the CRTC floor in Canada.
  //
  // Halifax used to be a fourth. It is Atlantic, so it is at noon — and noon was
  // an EXCLUDED lunch hour until the SOP was revised on gatekeeper grounds. It is
  // now a PEAK hour, so Halifax is not merely callable at 11:00 ET, it is the
  // best-ranked metro in the batch.
  //
  // Asserted precisely rather than as a count: a loosened check is how the gate
  // stops being checked at all.
  const out11 = metros.filter((m) => metroCallTier(m, at11) === 0);
  const expectOut11 = ["Vancouver, BC", "Victoria, BC", "Kelowna, BC"];
  check("E4 at 11:00 ET exactly the three BC metros are held back, by the CRTC floor",
    out11.length === expectOut11.length && expectOut11.every((m) => out11.includes(m)),
    `held back: ${out11.join(", ") || "(none)"}`);
  check("E4b …and Halifax, at local noon, is callable but NOT ranked peak",
    localHourInMetro("Halifax, NS", at11) === 12 && metroCallTier("Halifax, NS", at11) === 1);
  check("E4c …and Vancouver because it is 08:00, legal in the US but not in Canada",
    localHourInMetro("Vancouver, BC", at11) === 8 && metroCallTier("Los Angeles, CA", at11) === 2,
    "Vancouver must be barred at the same local hour Los Angeles is peak");

  // Nobody is dialled at 3am local, whatever the ET clock says.
  const at3am = at(3);
  const asleep = metros.filter((m) => metroCallTier(m, at3am) > 0);
  check("E5 at 03:00 ET nothing is callable", asleep.length === 0, asleep.slice(0, 4).join(", "));

  // Peak is judged on each metro's OWN clock, not Toronto's. At 19:00 ET it is
  // 16:00 in Los Angeles — the late peak there — while New York is at 19:00 and
  // past the SOP day entirely. Same instant, opposite ends of the rule.
  const lateWestern = at(19); // 19:00 ET = 16:00 PT
  check("E6 the peak window is local, not Eastern",
    metroCallTier("Los Angeles, CA", lateWestern) === 2 && metroCallTier("New York, NY", lateWestern) === 0,
    "LA is in its late peak while New York's day is over");
}

// ── L · THE LAW ──────────────────────────────────────────────────────────────
// Canada (CRTC UTR): weekdays 09:00-21:30, weekends 10:00-18:00, recipient's
// local time. US (federal TCPA/TSR): 08:00-21:00 daily, recipient's local time.
//
// These sweep every metro at every hour of both a weekday and a weekend rather
// than sampling clock times, because the failure this catches is one wrong zone
// or one missing province quietly re-opening an illegal hour.
{
  const CA_SUFFIX = /, (ON|BC|AB|SK|MB|QC|NS|NB|NL|PE|YT|NT|NU)$/;
  const canadian = metros.filter((m) => CA_SUFFIX.test(m));
  const american = metros.filter((m) => !CA_SUFFIX.test(m));

  check("L0 both countries are actually represented in the rotation",
    canadian.length > 0 && american.length > 0,
    `${canadian.length} CA / ${american.length} US`);

  // The zone set that drives the gate must agree with the province suffixes in
  // the metro map, in BOTH directions — otherwise adding a Canadian metro
  // without adding its zone ships an illegal window silently.
  const caMislabelled = canadian.filter((m) => !isCanadianZone(METRO_TIMEZONES[m]));
  check("L1 every Canadian metro's zone is known to the gate as Canadian",
    caMislabelled.length === 0, caMislabelled.join(", "));
  const usMislabelled = american.filter((m) => isCanadianZone(METRO_TIMEZONES[m]));
  check("L2 no US metro is treated as Canadian",
    usMislabelled.length === 0, usMislabelled.join(", "));

  // Sweep 48 hours of UTC in 30-minute steps across a known weekday and a known
  // weekend, and assert no metro is ever callable outside its own legal window.
  const sweep = (startUtc: Date, hours: number) => {
    const out: Date[] = [];
    for (let i = 0; i < hours * 2; i++) out.push(new Date(startUtc.getTime() + i * 30 * 60_000));
    return out;
  };
  // Mon 2026-07-13 and Sat 2026-07-18, both 00:00 UTC.
  const weekdaySweep = sweep(new Date(Date.UTC(2026, 6, 13)), 24);
  const weekendSweep = sweep(new Date(Date.UTC(2026, 6, 18)), 24);

  const violations: string[] = [];
  for (const now of [...weekdaySweep, ...weekendSweep]) {
    for (const m of metros) {
      if (metroCallTier(m, now) === 0) continue; // not callable — nothing to check
      const tz = METRO_TIMEZONES[m];
      const legal = legalCallHours(tz, now);
      const h = localHourInMetro(m, now);
      if (!legal || h == null || h < legal.first || h > legal.last) {
        violations.push(`${m} callable at ${h}:00 local (legal ${legal?.first}-${legal?.last})`);
      }
    }
  }
  check("L3 across a full weekday AND weekend, no metro is ever callable outside its legal window",
    violations.length === 0,
    `${violations.length} violation(s), first: ${violations[0] ?? "-"}`);

  // The two floors, asserted as the distinct values they are. Kevin's morning
  // block is exactly the hour where they diverge.
  const caFloorBreak = canadian.filter((m) => {
    for (const now of weekdaySweep) {
      if (localHourInMetro(m, now) === 8 && metroCallTier(m, now) > 0) return true;
    }
    return false;
  });
  check("L4 no Canadian metro is callable at 08:00 on a weekday (CRTC floor is 09:00)",
    caFloorBreak.length === 0, caFloorBreak.join(", "));

  const usFloorLost = american.filter((m) => {
    for (const now of weekdaySweep) {
      if (localHourInMetro(m, now) === 8) return metroCallTier(m, now) === 0;
    }
    return false;
  });
  check("L5 every US metro IS still callable at 08:00 — legal there, and the golden hour",
    usFloorLost.length === 0, usFloorLost.join(", "));

  const caWeekendBreak = canadian.filter((m) => {
    for (const now of weekendSweep) {
      const h = localHourInMetro(m, now);
      if ((h === 8 || h === 9) && metroCallTier(m, now) > 0) return true;
    }
    return false;
  });
  check("L6 no Canadian metro is callable before 10:00 on a weekend (CRTC weekend floor)",
    caWeekendBreak.length === 0, caWeekendBreak.join(", "));

  // NO CLOSING-TIME CHECK LIVES HERE, deliberately. One was written and then
  // deleted: it asserted the SOP's 17:00 stays inside every legal close, and it
  // could not be made to fail. Setting DAY_END to 22 still barred every late
  // hour, because zoneCallTier tests the law BEFORE the SOP — so there is no
  // reachable state where a closing time produces an illegal call. L3's sweep
  // already covers the closing side for real. A check that cannot fail is worse
  // than no check: it reads as coverage.
  //
  // The exact case from the morning block, stated as a fact rather than a sweep.
  const mon11et = new Date(Date.UTC(2026, 6, 13, 15)); // 11:00 EDT Monday
  const mon19et = new Date(Date.UTC(2026, 6, 13, 23)); // 19:00 EDT Monday — legal, past the SOP day
  check("L8 at 11:00 ET Calgary and Edmonton are open (09:00 local) while BC is barred (08:00)",
    metroCallTier("Calgary, AB", mon11et) > 0 &&
      metroCallTier("Edmonton, AB", mon11et) > 0 &&
      metroCallTier("Vancouver, BC", mon11et) === 0 &&
      callWindowForCity("Vancouver", mon11et).window === "barred",
    "this is the morning-block case the gate exists for");

  // The afternoon block has no legal exposure in either country — asserted so a
  // future floor change cannot quietly cost the second block.
  const mon16et = new Date(Date.UTC(2026, 6, 13, 20)); // 16:00 EDT Monday
  const blockedAt4 = metros.filter((m) => callWindowForCity(m.split(",")[0], mon16et).window === "barred");
  check("L9 at 16:00 ET no metro in either country is legally barred",
    blockedAt4.length === 0, blockedAt4.join(", "));

  // Every state the local-time chip branches on must be REACHABLE, or the chip
  // carries a dead branch and one of these words never appears in the product.
  // "barred" and "closed" being distinct is the load-bearing pair: collapsed,
  // the operator sees one word for two different kinds of no and eventually
  // overrides the legal one.
  const states = {
    barred: callWindowForCity("Vancouver", mon11et).window, // 08:00 local, CRTC floor
    closed: callWindowForCity("Toronto", mon19et).window, // 19:00 local, past the SOP day
    peak: callWindowForCity("Toronto", mon16et).window, // 16:00 local — the late window
    open: callWindowForCity("Winnipeg", mon11et).window, // 10:00 local
    unknown: callWindowForCity("Atlantis", mon11et).window, // not in the rotation
  };
  const wrong = Object.entries(states).filter(([want, got]) => want !== got);
  check("L10 all five window states are reachable and distinct",
    wrong.length === 0,
    wrong.map(([want, got]) => `expected ${want}, got ${got}`).join("; "));
}

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n✗ verify-metros: ${failures.length} FAILED, ${pass} passed\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error("");
  process.exit(1);
}
const byZone = new Map<string, number>();
for (const tz of Object.values(METRO_TIMEZONES)) byZone.set(tz, (byZone.get(tz) ?? 0) + 1);
console.log(`✓ verify-metros: ${pass} assertions passed`);
console.log(`  ${metros.length} metros across ${byZone.size} verified zones`);
for (const [tz, n] of Array.from(byZone).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(3)}  ${tz}  (UTC${offsetHours(tz, JAN)} Jan / UTC${offsetHours(tz, JUL)} Jul)`);
}
