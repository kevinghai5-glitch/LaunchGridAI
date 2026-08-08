// Extra search phrasings for a niche — EVIDENCE ONLY.
//
// The Places text query is `${niche} in ${metro}`. A niche whose businesses
// describe themselves in genuinely different vocabulary is reachable under more
// than one phrasing, and each phrasing gets its own fresh 60-result window from
// Google. That is the whole mechanism.
//
// ── WHY THIS MAP IS NEARLY EMPTY, AND MUST STAY THAT WAY ────────────────────
// Variants are NOT a general multiplier. Measured live against Toronto:
//
//   Med Spa                20 → 72 unique across 5 phrasings   (3.6x — real)
//   HVAC                   20 → 27 across 3 phrasings          (1.35x — noise)
//   Personal Injury Lawyer 20 → 27 across 3 phrasings          (1.35x — noise)
//
// Google's matching already covers synonyms for most trades and professions:
// "heating and cooling contractor" returned 85% the same businesses as "HVAC".
// Aesthetics is the exception because the category genuinely fragments — a
// botox clinic, an aesthetics clinic and a med spa are the same buyer under
// three signs.
//
// ── AND THE ONE THAT FAILED ─────────────────────────────────────────────────
// "wellness centre" returned 20 results with ZERO overlap with "Med Spa" —
// which reads like a jackpot and is the opposite. Zero overlap meant it had
// found a different industry: Revive Wellness Club, Wellness Haus, Sage Health
// and Wellness. Yoga and naturopathy, not injectables. It is not in the map.
//
// A variant that inflates the list with businesses that were never prospects is
// worse than no variant, because they get dialled and the script gets blamed.
//
// THE RULE: nothing goes in this map without a probe run first —
// `npm run probe:variants` prints, per candidate, how many results are NEW and
// the first six business names. High overlap means it adds nothing; ZERO overlap
// means look hard at the names before believing it.

export const NICHE_VARIANTS: Record<string, string[]> = {
  // Verified in Toronto: +17 new on "aesthetics clinic", +11 on "botox clinic",
  // both returning unmistakable ICP (skin clinics, injectables, cosmetic clinics).
  // "medical spa" is included despite 80% overlap — the 20% it adds is clean and
  // it costs one query.
  "Med Spa": ["medical spa", "aesthetics clinic", "botox clinic"],
  "Med Spa & Aesthetics": ["medical spa", "aesthetics clinic", "botox clinic"],
  "Dermatology": ["dermatologist", "skin clinic"],
  "Hair Restoration": ["hair transplant clinic"],
};

/** Every phrasing to search for a niche: the niche itself, then its variants.
 *  A niche with no entry searches once, which is the correct behaviour for the
 *  majority — see the note above. */
export function queriesForNiche(niche: string): string[] {
  return [niche, ...(NICHE_VARIANTS[niche] ?? [])];
}
