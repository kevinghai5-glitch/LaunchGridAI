/** Re-render the four deliverable HTML files from a pack.json — no API key, no
 *  network.
 *
 *    npm run samples:render                        # the committed golden sample
 *    npm run samples:render -- _samples/pack.json  # a local, real-data pack
 *
 *  WHY IT TAKES A PATH NOW. This used to hard-code _samples/pack.json, which is
 *  gitignored real client data — so in a fresh clone the script had nothing to
 *  render and simply crashed. The default is now the committed fixture
 *  (_fixtures/golden-pack.json), which is the only pack every checkout is
 *  guaranteed to have. The old behaviour is still one argument away, because a
 *  real pack is genuinely the more useful thing to eyeball on the operator's own
 *  machine when a repair lands in it.
 *
 *  HTML is written NEXT TO the pack it came from, so a rendered document can
 *  never be mistaken for a render of a different pack. For the fixture that means
 *  _fixtures/*.html, which .gitignore excludes deliberately: the JSON is the
 *  source of truth and the HTML is derived from it on demand.
 *
 *  This does exactly what gen-check.ts does after generation — render, validate,
 *  write — minus the generation step. Exits 1 if the rendered HTML carries any
 *  governance violation.
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { validateRenderedDeliverables } from "../src/lib/exporters";
import { DELIVERABLES } from "../src/lib/exporters/deliverables";
import type { AssetPack } from "../src/types";

const packPath = resolve(process.cwd(), process.argv[2] ?? "_fixtures/golden-pack.json");
const outDir = dirname(packPath);

const pack = JSON.parse(readFileSync(packPath, "utf8")) as AssetPack;
console.log(`Rendering ${pack.meta.businessName} from ${packPath}\n`);

const { html, violations } = validateRenderedDeliverables(pack);
for (const d of DELIVERABLES) {
  writeFileSync(resolve(outDir, d.filename), html[d.id]);
  console.log(`  wrote ${d.filename}`);
}

if (violations.length) {
  console.error(`\nRendered-HTML violations:\n${violations.join("\n")}`);
  process.exit(1);
}
console.log(`\n✓ ${DELIVERABLES.length} deliverables re-rendered clean into ${outDir}`);
