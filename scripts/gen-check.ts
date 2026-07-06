/**
 * Generate a REAL asset pack with the live model, render the four deliverables to
 * disk, and run the 10-laws validator against the output.
 *
 * This is the offline answer to "we can't validate that live LLM output actually
 * satisfies the laws": run it locally where network + OPENAI_API_KEY are present.
 *
 *   npm run gen:check -- --name "Crangle Law Firm" --industry "personal injury law" \
 *       --city "Toronto" --website https://example.com
 *
 * Flags (all optional except --name):
 *   --name       business name            (required)
 *   --industry   industry / niche
 *   --city       city
 *   --website    homepage URL (fetched for grounding; degrades to empty)
 *   --out        output dir               (default: ./_samples)
 *
 * Only OPENAI_API_KEY is required — the other enrichment sources degrade to empty,
 * so this exercises every generation prompt + renderer with one key. Writes the
 * raw pack to <out>/pack.json and the four deliverables as HTML. Exits non-zero if
 * the validator reports any law failures.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  generateAssetPack,
  type GenerationContext,
  type BusinessProfile,
  type LeakContext,
} from "@/lib/asset-generation";
import { buildAuditIntelligence } from "@/lib/audit-intelligence";
import { fetchWebsitePage } from "@/lib/website-analyzer";
import { DELIVERABLES } from "@/lib/exporters/deliverables";
import { validatePack, formatValidation } from "@/lib/exporters/validate-pack";
import { validateRenderedDeliverables } from "@/lib/exporters";
import { detectLeaks } from "@/lib/leak-detection";
import {
  buildLeakInputs,
  leakInputsToPromptBlock,
  allowedNumbersFor,
} from "@/lib/leak-narrative";

// ── tiny .env loader (no dotenv dependency) ───────────────────────────────────
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  loadEnv();

  const name = arg("name");
  if (!name) {
    console.error('Missing --name. Example:\n  npm run gen:check -- --name "Crangle Law Firm" --industry "personal injury law" --city Toronto --website https://example.com');
    process.exit(2);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not set (looked in env, .env.local, .env).");
    process.exit(2);
  }

  const industry = arg("industry") ?? null;
  const city = arg("city") ?? null;
  const website = arg("website") ?? null;
  // Real prospects always carry a phone (Google Places supplies it), which is what
  // fires the missed-call / after-hours BENCHMARK leaks and their CPL dollar math.
  // The offline harness has no Places call, so accept a phone explicitly.
  const phone = arg("phone") ?? null;
  const outDir = resolve(process.cwd(), arg("out") ?? "_samples");

  console.log(`→ Generating pack for "${name}"${industry ? ` (${industry})` : ""}${city ? ` · ${city}` : ""}`);

  const page = await fetchWebsitePage(website);
  if (website) console.log(`  website fetch: ${page.html ? `${page.html.length} bytes` : "empty/failed (degrading)"}`);

  const business: BusinessProfile = {
    name,
    industry,
    category: industry,
    city,
    rating: null,
    reviewCount: null,
    website,
    description: null,
  };

  const intel = buildAuditIntelligence({
    websiteHtml: page.html,
    hasWebsiteUrl: Boolean(website),
    reviews: [],
    competitors: [],
    self: { rating: null, reviewCount: null },
  });

  // Governance: run the same leak-detection pipeline the production route runs,
  // so the regenerated pack actually exercises the deterministic stamping
  // (leak identity, cited stats, computed math, kickoff lines). Without this the
  // sample would bypass the governance path entirely and misrepresent output.
  const detected = detectLeaks({
    business: {
      name,
      industry,
      category: industry,
      city,
      website,
      phone,
      rating: null,
      reviewCount: null,
    },
    intel,
    scrape: { used: false, homepage: null, subpages: [] },
    fallbackText: page.text,
  });
  const leakInputs = buildLeakInputs(detected.report, detected.data);
  const leaks: LeakContext = {
    report: detected.report,
    coldAudit: detected.coldAudit,
    outOfScope: detected.outOfScope,
    grades: detected.grades,
    promptBlock: leakInputsToPromptBlock(leakInputs),
    allowedNumbers: allowedNumbersFor(detected.report, detected.data),
    inputs: leakInputs,
  };
  console.log(
    `  leaks fired: ${detected.report.length} in-scope (${
      detected.report.filter((f) => f.tier === "BENCHMARK").length
    } BENCHMARK)`
  );

  const ctx: GenerationContext = { business, intel, websiteText: page.text, leaks };

  const pack = await generateAssetPack(ctx, (done, total, label) =>
    console.log(`  [${done}/${total}] ${label}`)
  );

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "pack.json"), JSON.stringify(pack, null, 2));
  // Render + validate the FINAL HTML (Defect 3), then write those exact docs.
  const { html, violations } = validateRenderedDeliverables(pack);
  for (const d of DELIVERABLES) writeFileSync(join(outDir, d.filename), html[d.id]);
  console.log(`\n→ Wrote pack.json + ${DELIVERABLES.length} HTML deliverables to ${outDir}\n`);
  if (violations.length)
    console.warn(`Rendered-HTML violations:\n${violations.join("\n")}\n`);

  const result = validatePack(pack);
  console.log(formatValidation(result));
  process.exit(result.passed && violations.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("gen-check failed:", err);
  process.exit(1);
});
