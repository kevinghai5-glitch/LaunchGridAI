// Verifies the ScreenshotOne fetch-and-store fix (item 4): the delivered document
// serves OUR OWN copies and no access key can reach client-facing HTML. Hermetic
// (no network, no DB) — the pure credential guard, the renderer gate, and the
// source wiring. Run: node_modules/.bin/tsx scripts/verify-screenshots.ts

import { carriesScreenshotCredential } from "../src/lib/screenshotone";
import { renderVisuals } from "../src/lib/exporters/_shell";
import { readFileSync } from "fs";
import { join } from "path";

let pass = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) pass++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}
const ROOT = join(__dirname, "..");
const read = (p: string): string => readFileSync(join(ROOT, p), "utf8");

const SIGNED =
  "https://api.screenshotone.com/take?access_key=SECRETKEY123&url=https%3A%2F%2Fx.com&signature=abcdef";
const OURS = "https://app.example.com/api/assets/screenshot/ckxyz123";

// ── A · The credential guard ─────────────────────────────────────────────────
check("A1 a signed ScreenshotOne URL is flagged", carriesScreenshotCredential(SIGNED));
check("A2 a bare screenshotone host URL is flagged", carriesScreenshotCredential("https://api.screenshotone.com/take?url=x"));
check("A3 our own served copy is NOT flagged", !carriesScreenshotCredential(OURS));
check("A4 a data: URI is NOT flagged", !carriesScreenshotCredential("data:image/jpeg;base64,AAAA"));
check("A5 empty/null is not flagged", !carriesScreenshotCredential(null) && !carriesScreenshotCredential(""));
check(
  "A6 an unparseable string with access_key= is still flagged",
  carriesScreenshotCredential("garbage access_key=leak not-a-url")
);

// ── B · The renderer gate drops credentialed shots ───────────────────────────
const credentialedViz = {
  available: true,
  competitiveRead: "read",
  shots: [
    { imageUrl: SIGNED, label: "Target — desktop", viewport: "desktop" as const },
    { imageUrl: SIGNED, label: "Target — mobile", viewport: "mobile" as const },
  ],
};
const credHtml = renderVisuals(credentialedViz);
check(
  "B1 renderVisuals emits NO access_key",
  !credHtml.includes("access_key"),
  "a signed URL must never reach client HTML"
);
check("B2 renderVisuals emits no screenshotone host", !credHtml.includes("screenshotone.com"));

const storedViz = {
  available: true,
  competitiveRead: "read",
  shots: [
    { imageUrl: OURS, label: "Target — desktop", viewport: "desktop" as const },
    { imageUrl: `${OURS}m`, label: "Target — mobile", viewport: "mobile" as const },
  ],
};
const okHtml = renderVisuals(storedViz);
check("B3 our own stored URLs DO render", okHtml.includes("/api/assets/screenshot/"));
check("B4 a stored render carries no credential", !okHtml.includes("access_key"));

// A mixed bundle (one leaked, one stored) must drop only the leaked one.
const mixed = renderVisuals({
  available: true,
  competitiveRead: "",
  shots: [
    { imageUrl: SIGNED, label: "Target — desktop", viewport: "desktop" as const },
    { imageUrl: OURS, label: "Target — mobile", viewport: "mobile" as const },
  ],
});
check("B5 mixed bundle keeps the stored shot", mixed.includes("/api/assets/screenshot/"));
check("B6 mixed bundle drops the credentialed shot", !mixed.includes("access_key"));

// ── C · The wiring ───────────────────────────────────────────────────────────
const store = read("src/lib/screenshot-store.ts");
check("C1 store fetches bytes once and persists them", /fetchScreenshotBytes/.test(store) && /storedScreenshot\.create/.test(store));
check("C2 store rewrites to our own serving URL", /\/api\/assets\/screenshot\//.test(store));
check(
  "C3 a shot that fails to fetch is DROPPED, never passed through signed",
  /filter\(\(s\)[^\n]*=> s !== null\)/.test(store),
  "a partial failure must not leak the signed URL"
);

const assetsRoute = read("src/app/api/generate/assets/route.ts");
check(
  "C4 generation materializes the bundle before use",
  /materializeScreenshotBundle\(/.test(assetsRoute),
  "the signed bundle must be converted to stored copies at generation"
);

const serveRoute = read("src/app/api/assets/screenshot/[id]/route.ts");
check("C5 serving route returns bytes", /Buffer\.from\(shot\.bytes\)/.test(serveRoute));
check("C6 serving route caches immutably", /immutable/.test(serveRoute));
check(
  "C7 serving route is public (no session gate — the client is a stranger)",
  !/getServerSession/.test(serveRoute)
);

const shell = read("src/lib/exporters/_shell.ts");
check(
  "C8 the exporter independently drops credentialed shots",
  /carriesScreenshotCredential/.test(shell),
  "the renderer must enforce the credential gate itself, not trust upstream"
);

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n✗ verify-screenshots: ${failures.length} FAILED, ${pass} passed\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ verify-screenshots: ${pass} assertions passed`);
