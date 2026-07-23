// Verification harness for the daily-queue finding engine (prospect-finding.ts).
// Exercises the two repro cases + a fresh niche with NO API calls — proves the
// deterministic selection + output gate behave, and shows before/after openers.
import {
  selectFinding,
  gateAngle,
  templateAngle,
  type FindingSignals,
  type Benchmark,
} from "../src/lib/prospect-finding";

let failures = 0;
function assert(cond: boolean, label: string) {
  console.log(`${cond ? "  ✓" : "  ✗ FAIL"} ${label}`);
  if (!cond) failures++;
}
function show(s: FindingSignals, pool: Benchmark[], badLLM: { painPoint: string; outreachAngle: string }) {
  const finding = selectFinding(s, pool);
  const gated = gateAngle(s, finding, badLLM);
  console.log(`\n  ${s.name}  (${s.reviews} reviews, ${s.rating || "?"}★, ${s.hasWebsite ? "has site" : "NO site"})`);
  console.log(`    selected finding: ${finding.type}${finding.competitor ? ` vs ${finding.competitor.name} (${finding.competitor.reviews})` : ""}`);
  console.log(`    BEFORE (old LLM-style): "${badLLM.painPoint}"`);
  console.log(`    AFTER  (gate ${gated.passed ? "passed LLM" : `rejected → template [${gated.reason}]`}): "${gated.angle.painPoint}"`);
  return { finding, gated };
}

console.log("=== Defect A — booking-path false positive (Austin ortho) ===");
// Ke Wang Orthodontics: HAS a website w/ obvious booking CTA. Old system flagged
// "NO BOOKING PATH". The engine can't see booking → must never assert it.
{
  const s: FindingSignals = { name: "Ke Wang Orthodontics", hasWebsite: true, rating: 4.8, reviews: 140 };
  const pool: Benchmark[] = [
    { name: "Ke Wang Orthodontics", reviews: 140 },
    { name: "Austin Braces Co", reviews: 210 },
    { name: "Smile Austin", reviews: 90 },
  ];
  const { finding, gated } = show(s, pool, {
    painPoint: "There's no obvious way to book online — no booking path, so anyone finding you after hours has to call back tomorrow.",
    outreachAngle: "Noticed there's no online booking on your site.",
  });
  assert(finding.type !== "NO_REAL_WEBSITE", "never claims NO_REAL_WEBSITE (site exists)");
  assert(!gated.passed && gated.reason === "unverifiable-booking-claim", "booking-path copy is REJECTED by the gate");
  assert(!/no booking|book online|booking path|way to book|online booking/i.test(gated.angle.painPoint), "final copy asserts no missing-booking claim");
}

console.log("\n=== Defect B — review-gap direction-blindness (Calgary ortho) ===");
// Impressions Orthodontics: 923 reviews / 4.9★ / elite — a review LEADER.
// Old system flagged "REVIEW GAP — only 923 reviews while a competitor has far more".
{
  const s: FindingSignals = { name: "Impressions Orthodontics", hasWebsite: true, rating: 4.9, reviews: 923 };
  const pool: Benchmark[] = [
    { name: "Impressions Orthodontics", reviews: 923 },
    { name: "Calgary Braces", reviews: 180 },
    { name: "Bow Valley Ortho", reviews: 240 },
  ];
  const { finding, gated } = show(s, pool, {
    painPoint: "You show only 923 Google reviews while a competitor down the road has far more.",
    outreachAngle: "A competitor nearby is out-reviewing you.",
  });
  assert(finding.type === "SYSTEMS_ANGLE", "review LEADER routes to SYSTEMS_ANGLE, not REVIEW_GAP");
  assert(!gated.passed, "direction-blind 'only 923 reviews / a competitor' copy is REJECTED");
  assert(!/only\s+923/i.test(gated.angle.painPoint), "final copy never belittles 923 reviews");
  assert(!/competitor/i.test(gated.angle.painPoint), "final copy names no phantom competitor");
}

console.log("\n=== A genuine review gap (thin business behind a real named competitor) ===");
{
  const s: FindingSignals = { name: "Northside Dental", hasWebsite: true, rating: 4.3, reviews: 18 };
  const pool: Benchmark[] = [
    { name: "Northside Dental", reviews: 18 },
    { name: "Riverfront Smiles", reviews: 260 },
    { name: "Elm St Dental", reviews: 95 },
  ];
  const finding = selectFinding(s, pool);
  const template = templateAngle(s, finding);
  console.log(`\n  ${s.name}: selected ${finding.type} vs ${finding.competitor?.name} (${finding.competitor?.reviews})`);
  console.log(`    template opener: "${template.painPoint}"`);
  // Good LLM copy that names the competitor + real numbers should PASS.
  const good = gateAngle(s, finding, {
    painPoint: "You're sitting at 18 Google reviews while Riverfront Smiles nearby shows 260 — that gap quietly decides who gets the call.",
    outreachAngle: "Riverfront Smiles at 260 reviews to your 18 is picking off people comparing you.",
  });
  assert(finding.type === "REVIEW_GAP", "thin business behind a real competitor → REVIEW_GAP");
  assert(finding.competitor?.name === "Riverfront Smiles", "competitor is the real top-of-pool name");
  assert(good.passed, "good copy naming the real competitor + real numbers PASSES the gate");
  // Vague competitor copy (no name / no number) must be rejected.
  const vague = gateAngle(s, finding, { painPoint: "A competitor down the road has far more reviews than you.", outreachAngle: "" });
  assert(!vague.passed, "vague 'a competitor has far more' (no name/number) is REJECTED");
}

console.log("\n=== NO_REAL_WEBSITE (verifiable from Places) ===");
{
  const s: FindingSignals = { name: "Bob's HVAC", hasWebsite: false, rating: 4.1, reviews: 12 };
  const finding = selectFinding(s, []);
  const t = templateAngle(s, finding);
  console.log(`\n  ${s.name}: selected ${finding.type}`);
  console.log(`    template opener: "${t.painPoint}"`);
  assert(finding.type === "NO_REAL_WEBSITE", "no website → NO_REAL_WEBSITE");
}

console.log("\n=== Fresh niche batch — HVAC, Phoenix (10 rows, mixed) ===");
{
  const pool: Benchmark[] = [
    { name: "Desert Air Pros", reviews: 640 },
    { name: "Valley Comfort HVAC", reviews: 310 },
    { name: "Phoenix Cooling Co", reviews: 120 },
    { name: "Sun City Heating", reviews: 55 },
  ];
  const rows: FindingSignals[] = [
    { name: "Desert Air Pros", hasWebsite: true, rating: 4.8, reviews: 640 },     // leader → systems
    { name: "Valley Comfort HVAC", hasWebsite: true, rating: 4.6, reviews: 310 }, // strong-ish
    { name: "Phoenix Cooling Co", hasWebsite: true, rating: 4.4, reviews: 120 },  // mid
    { name: "Sun City Heating", hasWebsite: true, rating: 4.2, reviews: 55 },     // behind
    { name: "QuickFix AC", hasWebsite: false, rating: 4.0, reviews: 30 },         // no site
    { name: "Ace Cooling", hasWebsite: true, rating: 4.3, reviews: 15 },          // thin → gap
    { name: "Metro Heat & Air", hasWebsite: true, rating: 0, reviews: 0 },        // unknown rep
    { name: "Blue Sky HVAC", hasWebsite: true, rating: 4.9, reviews: 420 },       // elite-ish
    { name: "Cactus Climate", hasWebsite: false, rating: 0, reviews: 0 },         // no site
    { name: "Grand Canyon Air", hasWebsite: true, rating: 4.5, reviews: 200 },    // solid
  ];
  console.log("");
  for (const s of rows) {
    const f = selectFinding(s, pool);
    const t = templateAngle(s, f);
    const tag =
      f.type === "REVIEW_GAP" ? `REVIEW_GAP vs ${f.competitor?.name}(${f.competitor?.reviews})` : f.type;
    console.log(`  [${tag}] ${s.name} (${s.reviews}rv) → "${t.painPoint.slice(0, 90)}..."`);
    // Global invariant: no template ever belittles a high review count or names a phantom competitor.
    assert(!(/only\s+[\d,]+\s+reviews/i.test(t.painPoint) && s.reviews >= 200), `${s.name}: no "only N" belittling for high counts`);
  }
}

console.log("\n" + (failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`));
process.exit(failures === 0 ? 0 : 1);
