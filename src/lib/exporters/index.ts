// Export orchestrator: turns an AssetPack into the five real deliverable files
// and bundles them into a single ZIP.
//
// HTML-primary: all five deliverables ship as premium, standalone HTML — that's
// what the client opens and what makes the pack feel high-end.

import JSZip from "jszip";
import type { AssetPack } from "@/types";
import { DELIVERABLES, renderDeliverableHtml } from "./deliverables";
import { validatePack, formatValidation } from "./validate-pack";
import { hasInventedOffer } from "../leak-narrative";

// The "…comes off the list" tail of the kickoff-verification line survives minor
// wording drift — same signature the pack validator uses.
const KICKOFF_SIGNATURE = /comes off the list|verify (this|it)(?: together)? at kickoff/i;

// Defect 3: prove the governance rules hold on the FINAL rendered HTML of every
// deliverable — not just on the pack object. Renders each deliverable, then
// asserts (a) every BENCHMARK leak's kickoff line is present in D1's HTML, and
// (b) no fabricated offer survived into any deliverable. Logs loudly; never
// throws (a validation gap must not block a paying operator's export).
export function validateRenderedDeliverables(pack: AssetPack): {
  html: Record<string, string>;
  violations: string[];
} {
  const html: Record<string, string> = {};
  for (const d of DELIVERABLES) html[d.id] = renderDeliverableHtml(pack, d.id);

  const violations: string[] = [];

  const benchmarkLeaks = (pack.intelligence?.leakAnalysis ?? []).filter(
    (l) => l.evidenceTier === "BENCHMARK"
  );
  if (benchmarkLeaks.length) {
    const kickoffCount = (html.d1.match(new RegExp(KICKOFF_SIGNATURE, "gi")) ?? []).length;
    if (kickoffCount < benchmarkLeaks.length)
      violations.push(
        `D1 HTML renders ${kickoffCount} kickoff-verification line(s) but has ${benchmarkLeaks.length} BENCHMARK leak(s).`
      );
  }

  for (const [id, doc] of Object.entries(html)) {
    if (hasInventedOffer(doc))
      violations.push(`${id} HTML contains a fabricated discount amount.`);
  }

  const packResult = validatePack(pack);
  if (!packResult.passed)
    violations.push(`Pack validator: ${packResult.fails} failure(s).\n${formatValidation(packResult)}`);

  return { html, violations };
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "business"
  );
}

export function zipFilename(pack: AssetPack): string {
  return `${slug(pack.meta.businessName)}-growth-infrastructure.zip`;
}

export async function buildAssetZip(pack: AssetPack): Promise<Buffer> {
  const zip = new JSZip();

  // Render once, validate the FINAL HTML (Defect 3), then bundle those exact
  // documents so the validated artifact is the shipped artifact.
  const { html, violations } = validateRenderedDeliverables(pack);
  if (violations.length)
    console.warn(
      `[deliverables] governance violations on rendered HTML:\n${violations.join("\n")}`
    );

  for (const d of DELIVERABLES) {
    zip.file(d.filename, html[d.id]);
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
