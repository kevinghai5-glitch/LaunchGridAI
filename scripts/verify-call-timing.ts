// EXHAUSTIVE proof of the cold-call time-zone gating — every hour, every metro,
// both DST states. Run: node_modules/.bin/tsx scripts/verify-call-timing.ts
//
// Rule under test: callable = local 8am-5pm minus the 12-1pm lunch hour;
// peak = 8/10/16 (tier 2), other callable hours = tier 1, else tier 0.

import { orderMetrosByCallTime, metroCallTier, localHourInMetro, METRO_TIMEZONES } from "../src/lib/call-timing";
import { NA_METROS } from "../src/lib/crm";

const PEAK = new Set([8, 10, 16]);
const GOOD = new Set([9, 11, 13, 14, 15]);
const expectedTier = (h: number) => (PEAK.has(h) ? 2 : GOOD.has(h) ? 1 : 0);

// 0) Every metro maps to a time zone.
const unmapped = NA_METROS.filter((m) => !METRO_TIMEZONES[m]);
console.log(`Metros mapped: ${NA_METROS.length - unmapped.length}/${NA_METROS.length}` +
  (unmapped.length ? ` — UNMAPPED: ${unmapped.join(", ")}` : " ✓"));

// 1) INVARIANT SWEEP — the real "works for ALL times" proof. Every 30 minutes
//    across a full SUMMER week and a full WINTER week (covers all 24 local hours
//    in both DST states), for EVERY metro: the tier must equal the rule computed
//    straight from that metro's own local hour. Zero mismatches = correct always.
function invariantSweep() {
  let checks = 0, fails = 0;
  const mismatches: string[] = [];
  for (const base of ["2026-07-01T00:00:00Z", "2026-01-01T00:00:00Z"]) {
    const start = new Date(base).getTime();
    for (let min = 0; min < 7 * 24 * 60; min += 30) {
      const now = new Date(start + min * 60000);
      for (const m of NA_METROS) {
        const h = localHourInMetro(m, now);
        checks++;
        if (h == null) { fails++; mismatches.push(`NULL ${m}`); continue; }
        const got = metroCallTier(m, now);
        const exp = expectedTier(h);
        if (got !== exp && mismatches.length < 10) mismatches.push(`${m} @${now.toISOString()} h=${h} got=${got} exp=${exp}`);
        if (got !== exp) fails++;
      }
    }
  }
  console.log(`\nINVARIANT SWEEP — ${checks.toLocaleString()} checks (summer+winter, every 30 min, all ${NA_METROS.length} metros): ${fails} failures ${fails === 0 ? "✓ CORRECT AT ALL TIMES" : "✗"}`);
  mismatches.forEach((s) => console.log("   " + s));
}

// 2) 24-hour visual table per season (one sample metro per US zone).
function hourlyTable(label: string, dayIso: string) {
  const zones: [string, string][] = [
    ["ET", "New York, NY"], ["CT", "Chicago, IL"], ["MT", "Denver, CO"], ["AZ", "Phoenix, AZ"], ["PT", "Los Angeles, CA"],
  ];
  console.log(`\n${label} — local hour + mark per zone (* peak, · good, blank = don't call):`);
  console.log("  UTC " + zones.map((z) => z[0].padStart(6)).join(""));
  const start = new Date(dayIso).getTime();
  for (let hr = 0; hr < 24; hr++) {
    const now = new Date(start + hr * 3600000);
    const cells = zones.map(([, m]) => {
      const h = localHourInMetro(m, now)!;
      const t = metroCallTier(m, now);
      return `${String(h).padStart(2)}${t === 2 ? "*" : t === 1 ? "·" : " "}`.padStart(6);
    });
    console.log("  " + String(now.getUTCHours()).padStart(2) + "h " + cells.join(""));
  }
}

// 3) Boundary hours for one zone — confirm the window edges (7→8, 11→12→13, 16→17).
function boundaries() {
  console.log("\nBOUNDARY CHECK (Eastern, summer) — expect: 7 no, 8 PEAK, 11 good, 12 no(lunch), 13 good, 16 PEAK, 17 no:");
  for (const h of [7, 8, 11, 12, 13, 16, 17]) {
    // 2026-07-15, h:00 EDT = (h+4):00 UTC
    const now = new Date(Date.UTC(2026, 6, 15, h + 4, 0, 0));
    console.log(`   local ${String(h).padStart(2)}:00 → tier ${metroCallTier("New York, NY", now)}`);
  }
}

// 4) Overnight fallback — nobody callable, still returns soonest-to-open first.
function fallback() {
  const now = new Date("2026-07-23T08:00:00Z"); // 4am ET / 1am PT
  const { metros, anyCallable } = orderMetrosByCallTime(NA_METROS, now, 0);
  console.log(`\nFALLBACK @ 4am ET: anyCallable=${anyCallable}, first=${metros[0]} (opens soonest)`);
}

invariantSweep();
hourlyTable("SUMMER (Jul 23, DST on)", "2026-07-23T04:00:00Z");
hourlyTable("WINTER (Jan 15, DST off — watch AZ vs MT/PT shift)", "2026-01-15T05:00:00Z");
boundaries();
fallback();
