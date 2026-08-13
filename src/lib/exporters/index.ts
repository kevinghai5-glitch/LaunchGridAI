// Export orchestrator: turns an AssetPack into the five real deliverable files
// and bundles them into a single ZIP.
//
// HTML-primary: all five deliverables ship as premium, standalone HTML — that's
// what the client opens and what makes the pack feel high-end.

import JSZip from "jszip";
import type { AssetPack, PackGovernance } from "@/types";
import {
  DELIVERABLES,
  CLIENT_DELIVERABLES,
  renderDeliverableHtml,
  emptyDeliverableContext,
  type DeliverableContext,
} from "./deliverables";
import {
  assertPackValid,
  checkId,
  evaluateOverride,
  withGovernance,
  type OverrideRejectionCode,
  type ValidationCheck,
} from "./validate-pack";
import { hasInventedOffer } from "../leak-narrative";

// The "…comes off the list" tail of the kickoff-verification line survives minor
// wording drift — same signature the pack validator uses.
const KICKOFF_SIGNATURE = /comes off the list|verify (this|it)(?: together)? at kickoff/i;

// The rendered-HTML violations block just as hard as a pack-validator failure, so
// they are promoted into the same ValidationCheck shape under this law id. One
// fatal set with one id scheme is what makes the override handshake honest: an
// acknowledgement has to cover EVERYTHING that blocked, not only the half that
// happened to arrive as a LawCheck.
const RENDER_LAW = "Render · deliverable HTML";

// Defect 3: prove the governance rules hold on the FINAL rendered HTML of every
// deliverable — not just on the pack object. Renders each deliverable, then
// asserts (a) every BENCHMARK leak's kickoff line is present in D1's HTML,
// (b) no fabricated offer survived into any deliverable, and (c) the pack itself
// passes assertPackValid.
//
// POLICY REVERSAL (E2). This used to be advisory: it collected violations and the
// ZIP shipped regardless, on the reasoning that "a validation gap must not block a
// paying operator's export". The owner has reversed that — a pack that fails its
// own honesty laws must not reach a prospect. This function still only REPORTS
// (it is pure and never throws, so gen-check.ts can keep listing violations); the
// blocking happens one level up, in buildAssetZipChecked.
export function validateRenderedDeliverables(
  pack: AssetPack,
  ctx: DeliverableContext = emptyDeliverableContext()
): {
  html: Record<string, string>;
  violations: string[];
  /** Fatal pack-validator checks, structured — so a caller can render them
   *  individually instead of parsing the flattened report string. */
  fails: ValidationCheck[];
  /** EVERY fatal finding at this boundary in one uniform, id-carrying list:
   *  `fails` plus the rendered-HTML violations promoted to the same shape. This
   *  is the set an override acknowledgement must match exactly. */
  fatals: ValidationCheck[];
  /** Non-fatal checks. Surfaced to the operator, never a reason to block. */
  warns: ValidationCheck[];
  /** True when nothing fatal was found — the only condition under which a ZIP
   *  may be handed to a client. */
  ok: boolean;
} {
  // ALL THREE are rendered and validated, including the internal Asset Pack:
  // it reaches the client at go-live, so it is held to the same laws. Only the
  // two client documents are BUNDLED — see the ZIP below.
  const html: Record<string, string> = {};
  for (const d of DELIVERABLES) html[d.id] = renderDeliverableHtml(pack, d.id, ctx);

  // Kept separate from `violations` below because only these are RENDER-level
  // findings. The pack-validator summary that also lands in `violations` is a
  // flattened restatement of `fails`, and promoting it would double-count every
  // law failure in the override handshake.
  const renderViolations: string[] = [];

  // ── BENCHMARK-PRICED CLAIMS MAY NOT REACH A CLIENT DOCUMENT ───────────────
  // This used to count kickoff-verification lines in D1: a leak priced from an
  // industry benchmark rather than the client's own numbers had to promise it
  // would be re-checked at kickoff. D1 was assembled from generated leak
  // analysis, so benchmark-priced figures genuinely appeared on it.
  //
  // The Diagnosis is built entirely from the client's OWN two numbers, which they
  // gave on the call and have already agreed. So the law is stronger now and the
  // check with it: a benchmark-priced leak must not reach a client document AT
  // ALL, rather than reaching it with a caveat attached.
  //
  // Asserted by its text, not by trusting that the renderer changed — if anyone
  // wires leakAnalysis back into a client document, this fires.
  const benchmarkLeaks = (pack.intelligence?.leakAnalysis ?? []).filter(
    (l) => l.evidenceTier === "BENCHMARK"
  );
  if (benchmarkLeaks.length) {
    const clientDocs = CLIENT_DELIVERABLES.map((d) => html[d.id] ?? "").join("\n");
    const leaked = benchmarkLeaks.filter((l) => {
      // `evidence` and `explanation` are the long, distinctive strings — an
      // `area` like "speed-to-lead" is a common phrase and would false-positive.
      return [l.evidence, l.explanation, l.businessImpact]
        .map((t) => String(t ?? "").trim())
        .some((t) => t.length > 24 && clientDocs.includes(t));
    });
    if (leaked.length)
      renderViolations.push(
        `${leaked.length} BENCHMARK-priced leak(s) reached a client document. The client documents carry only figures built from the client's own numbers.`
      );
  }

  for (const [id, doc] of Object.entries(html)) {
    if (hasInventedOffer(doc))
      renderViolations.push(`${id} HTML contains a fabricated discount amount.`);
  }

  // THE LAWS JUDGE WHAT SHIPS. The visible words of all three rendered
  // documents, handed to the validator so a text law reads the client-facing
  // copy rather than the whole pack blob — which still carries sections no
  // document renders (the old blueprint, the leak analysis, the retired
  // roadmap) and was blocking exports over prose nobody could ever see.
  const renderedText = Object.values(html)
    .join("\n")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
  const verdict = assertPackValid(pack, undefined, { renderedText });
  const violations = [...renderViolations];
  if (!verdict.ok)
    violations.push(`Pack validator: ${verdict.fails.length} failure(s).\n${verdict.report}`);

  // The rendered-HTML violations above are fatal in their own right: a missing
  // kickoff line or a surviving fabricated offer is exactly what this guard exists
  // to stop, and neither is a matter of degree.
  const fatals: ValidationCheck[] = [
    ...verdict.fails,
    ...renderViolations.map((message) => ({
      id: checkId(RENDER_LAW, message),
      law: RENDER_LAW,
      level: "fail" as const,
      message,
    })),
  ];

  return {
    html,
    violations,
    fails: verdict.fails,
    fatals,
    warns: verdict.warns,
    ok: verdict.ok && violations.length === 0,
  };
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

/** Result of the enforcing ZIP build. Never an exception: the caller is an API
 *  route that has to turn a failure into an operator-facing message, and a thrown
 *  error there collapses into a generic 500 with nothing actionable in it. */
export type AssetZipResult =
  | {
      ok: true;
      zip: Buffer;
      filename: string;
      /** Non-fatal checks worth showing beside a successful download. */
      warns: ValidationCheck[];
      /** The pack actually rendered and bundled. Identical to the input except
       *  for its governance block, which is stamped when the build was forced and
       *  cleared when it was not — so the caller persists the copy that shipped,
       *  not the one it happened to be holding. */
      pack: AssetPack;
      /** Present ONLY when a fatal set was overridden. Its presence is what tells
       *  the route to write the paper trail. */
      governance?: PackGovernance;
    }
  | {
      ok: false;
      /** Human-readable, already formatted — safe to put straight in an error
       *  toast or a 422 body. */
      report: string;
      /** The fatal pack-validator checks, structured for per-line rendering. */
      fails: ValidationCheck[];
      /** Rendered-HTML violations (missing kickoff line, surviving fake offer). */
      violations: string[];
      /** Every fatal finding with its stable id — what the UI renders in full and
       *  what a valid override must acknowledge, exactly. */
      fatals: ValidationCheck[];
      warns: ValidationCheck[];
      /** Why a supplied override was NOT honoured. Absent when none was supplied
       *  (that is just the ordinary block). */
      overrideError?: string;
      overrideErrorCode?: OverrideRejectionCode;
    };

/**
 * Machine-readable override marker for the archive itself.
 *
 * DELIBERATE PLACEMENT: this goes in the ZIP's archive COMMENT, not in an extra
 * file inside it. An "override-record.json" would sit in the folder the client
 * unzips, next to the four deliverables they paid for, announcing that their
 * report shipped with a known defect. That is an INTERNAL record, not a client
 * message. The archive comment is invisible in Finder and Windows Explorer and
 * absent from the extracted folder, but is one command away for us
 * (`unzip -z pack.zip`) — which is exactly the audience it is for. The
 * deliverable HTML is left completely untouched for the same reason.
 */
function overrideArchiveComment(governance: PackGovernance): string {
  const laws = Array.from(new Set(governance.checks.map((c) => c.law)));
  return (
    `INTERNAL — exported over ${governance.checks.length} failing check(s) [${laws.join(", ")}] ` +
    `on ${governance.at}. ${JSON.stringify({ reclaimedhqGovernance: governance })}`
  );
}

/**
 * THE ENFORCING EXPORT PATH — this is what API routes should call.
 *
 * Renders every deliverable, validates the FINAL HTML and the pack, and only
 * builds the ZIP when nothing fatal was found. A fatal violation returns
 * `{ ok: false, report, fails, fatals, violations, warns }` instead of a ZIP:
 *
 *   const built = await buildAssetZipChecked(pack, body.override);
 *   if (!built.ok)
 *     return NextResponse.json({ error: built.report, checks: built.fatals }, { status: 422 });
 *   return new NextResponse(built.zip, { headers: { … built.filename … } });
 *
 * @param pack     the pack to render and bundle
 * @param override raw `override` value off the request body, or nothing. WITHOUT
 *                 it the behaviour is unchanged: a fatal check blocks, full stop.
 *                 WITH it, the ZIP is built only if the caller echoed back every
 *                 currently-failing check id and supplied a written reason — see
 *                 evaluateOverride for why that is the honest test.
 */
export async function buildAssetZipChecked(
  pack: AssetPack,
  override?: unknown,
  ctx: DeliverableContext = emptyDeliverableContext()
): Promise<AssetZipResult> {
  // Render once, validate the FINAL HTML (Defect 3), then bundle those exact
  // documents so the validated artifact is the shipped artifact.
  const { html, violations, fails, fatals, warns, ok } = validateRenderedDeliverables(pack, ctx);

  let governance: PackGovernance | undefined;

  if (!ok) {
    const decision = evaluateOverride(fatals, override, "export");
    if (decision.status !== "granted") {
      const report = [
        `Export blocked — this pack fails ${fails.length} of its own deliverable laws${
          violations.length ? ` and ${violations.length} rendered-HTML check(s)` : ""
        }. Regenerate it before sending.`,
        ...violations,
      ].join("\n");
      return {
        ok: false,
        report,
        fails,
        violations,
        fatals,
        warns,
        ...(decision.status === "rejected"
          ? { overrideError: decision.message, overrideErrorCode: decision.code }
          : {}),
      };
    }
    governance = decision.governance;
  }

  // The governance block is metadata only — no renderer reads it — so the HTML
  // rendered above is byte-identical either way and can be bundled as-is. The
  // stamp (or the clearing of a stale one) rides on the returned pack.
  const shipped = withGovernance(pack, governance);

  // ALL THREE GO IN THE ZIP. The ZIP is the OPERATOR's download, not the
  // client's envelope — he unzips it and decides what to send.
  //
  // This briefly bundled only the two client documents, which got the audience
  // rule backwards: the Asset Pack is meant to go out at go-live, and leaving it
  // out of his download is precisely what makes that impossible. "Internal"
  // describes WHEN it is sent, not whether he receives it.
  //
  // So it ships with an INTERNAL- filename prefix instead. It sorts away from
  // the client files and cannot be forwarded by accident from a folder listing.
  const zip = new JSZip();
  for (const d of DELIVERABLES) {
    const name = d.audience === "internal" ? `INTERNAL-${d.filename}` : d.filename;
    zip.file(name, html[d.id]);
  }
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    ...(governance ? { comment: overrideArchiveComment(governance) } : {}),
  });
  return {
    ok: true,
    zip: buffer,
    filename: zipFilename(shipped),
    warns,
    pack: shipped,
    ...(governance ? { governance } : {}),
  };
}

// `buildAssetZip` / `PackExportBlockedError` used to live here as a throwing
// wrapper, kept alive only for the un-migrated export route. That route now calls
// `buildAssetZipChecked` and renders its structured failure, so both are deleted
// rather than left as a second, quieter way to ship a pack — there is ONE export
// path and it returns its verdict instead of throwing it.
