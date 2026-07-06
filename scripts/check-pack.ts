/**
 * Validate an existing pack.json against the 10 deliverable laws — offline, no
 * API calls. Useful for checking a saved/exported pack (e.g. a stale pack pulled
 * from the DB will report the v2 structure failures, confirming it needs a
 * regenerate).
 *
 *   npm run check:pack -- _samples/pack.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AssetPack } from "@/types";
import { validatePack, formatValidation } from "@/lib/exporters/validate-pack";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run check:pack -- <path/to/pack.json>");
  process.exit(2);
}

const pack = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")) as AssetPack;
const result = validatePack(pack);
console.log(formatValidation(result));
process.exit(result.passed ? 0 : 1);
