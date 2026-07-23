// Verification harness for the Tier-1 (regex) owner extractor. No API calls —
// proves the "show the owner(s) the site names, never a guess" law: one owner,
// both co-owners, or nothing (none / too-noisy).
import { extractOwnersRegex } from "../src/lib/owner-name";

let failures = 0;
function check(label: string, corpus: string, biz: string, expected: string | null) {
  const got = extractOwnersRegex(corpus, biz).join(" & ") || null;
  const ok = got === expected;
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${label}  → ${got === null ? "null" : `"${got}"`}${ok ? "" : ` (expected ${expected === null ? "null" : `"${expected}"`})`}`);
  if (!ok) failures++;
}

console.log("=== Single clear owner → shown ===");
check("owned & operated by", "Acme Roofing is owned & operated by John Smith, serving the metro since 2004.", "Acme Roofing", "John Smith");
check("founded by", "About us: Founded by Jane Doe in 2011.", "Bright Dental", "Jane Doe");
check("Name, Owner", "Our team\nMike Reynolds, Owner\nfront desk staff", "Reynolds HVAC", "Mike Reynolds");
check("Owner: Name", "Contact — Owner: Sarah Connor. Call anytime.", "SC Plumbing", "Sarah Connor");
check("Dr. honorific kept", "Meet Dr. Ke Wang, owner and lead orthodontist at our clinic.", "Ke Wang Orthodontics", "Dr. Ke Wang");

console.log("\n=== Two named owners → both shown (a co-owned biz, not a coin flip) ===");
check("inline 'X and Y'", "Owned & operated by John Smith and Jane Doe.", "Acme Roofing", "John Smith & Jane Doe");
check("founded by two", "Founded by Maria Lopez and Tom Reed in 2009.", "MLR Aesthetics", "Maria Lopez & Tom Reed");
check("Owners: X and Y", "Owners: Alan Grant and Ellie Sattler.", "Isla Vet", "Alan Grant & Ellie Sattler");

console.log("\n=== Nothing to show → null ===");
check("staff only, no owner role", "Our team: Jenny at the front desk, Mark in service, Lisa in billing.", "Metro Auto", null);
check("business name only", "Welcome to Smith Dental. Book your cleaning today.", "Smith Dental", null);
check("empty corpus", "", "Anything", null);
check("brand not mistaken for person", "Grand Canyon Air — heating & cooling. Owner: Grand Canyon Air LLC", "Grand Canyon Air", null);
check("3+ named 'owners' = noise → blank", "Owner: Al Green. Owner: Bo Reed. Owner: Cy Long. Owner: Di West.", "Noisy Co", null);

console.log("\n" + (failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`));
process.exit(failures === 0 ? 0 : 1);
