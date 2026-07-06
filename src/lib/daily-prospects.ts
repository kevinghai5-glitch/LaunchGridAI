// Daily prospect generator — the engine behind the Opportunities "pick a niche →
// generate 30" flow. Real businesses ONLY (Google Places); the LLM never invents
// a company, it only writes the call angle for a real one.
//
// Flow: rotate through NA metros searching the chosen niche → dedup against
// everything this operator has already seen (and recently-declined) → score by
// how much they NEED the service → take the top N → batch-write a call angle →
// caller persists them as SUGGESTED leads for approve/decline triage.

import { searchBusinesses, type PlaceResult } from "@/lib/google-places";
import { openai, DEFAULT_MODEL } from "@/lib/openai";
import { opportunityScore, NA_METROS, DAILY_BATCH_SIZE } from "@/lib/crm";

export interface ScoredProspect extends PlaceResult {
  score: number;
  metro: string; // the NA metro this prospect was found in (used for the city field)
}

export interface ProspectAngle {
  painPoint: string;
  outreachAngle: string;
}

// Pull real prospects for a niche across the metro rotation, dedup, score, rank.
//  - excludePlaceIds: Places already saved/declined for this operator (skip them).
//  - count: how many to return (defaults to a full daily batch).
//  - metroOffset: rotate the starting metro so repeat runs surface fresh cities.
export async function gatherProspects(
  niche: string,
  excludePlaceIds: Set<string>,
  count: number = DAILY_BATCH_SIZE,
  metroOffset = 0
): Promise<ScoredProspect[]> {
  const seen = new Set<string>(excludePlaceIds);
  const collected: { place: PlaceResult; metro: string }[] = [];

  // Walk metros (rotated by offset) until we have enough fresh, unseen prospects.
  for (let i = 0; i < NA_METROS.length && collected.length < count * 2; i++) {
    const metro = NA_METROS[(i + metroOffset) % NA_METROS.length];
    let batch: PlaceResult[] = [];
    try {
      batch = await searchBusinesses(niche, metro, 20);
    } catch {
      // One metro failing (rate limit etc.) shouldn't sink the whole run.
      continue;
    }
    for (const p of batch) {
      if (!p.placeId || seen.has(p.placeId)) continue;
      seen.add(p.placeId);
      collected.push({ place: p, metro });
    }
  }

  return collected
    .map(({ place, metro }) => ({
      ...place,
      metro: metro.split(",")[0].trim(),
      score: opportunityScore(place.rating, place.userRatingsTotal, Boolean(place.website)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

// One batched LLM call → a call angle per prospect, index-aligned to `prospects`.
// Best-effort: any failure returns empty angles so leads still persist (no angle).
export async function writeAngles(
  prospects: ScoredProspect[],
  niche: string
): Promise<ProspectAngle[]> {
  if (prospects.length === 0) return [];

  const list = prospects
    .map((p, i) => {
      const signals = [
        p.website ? "has website" : "NO website",
        p.rating ? `${p.rating}★` : "no rating",
        `${p.userRatingsTotal} reviews`,
      ].join(", ");
      return `${i + 1}. ${p.name} — ${niche} — ${signals}`;
    })
    .join("\n");

  const prompt = `You help a B2B agency owner cold-call local ${niche} businesses to sell a lead-conversion system (instant speed-to-lead, qualification, follow-up, booking — done-for-you on a new landing/booking page plus a monthly retainer).

For EACH numbered business below, write a concrete one-line pain point and a one-line outreach angle the caller can open with. Base it ONLY on the observable signals given (website presence, rating, review volume) and what's typical for that niche. Never invent specifics you can't see.

Businesses:
${list}

Return ONLY valid JSON: { "items": [ { "n": 1, "painPoint": "...", "outreachAngle": "..." }, ... ] } with one object per business, in order.`;

  try {
    const res = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });
    const content = res.choices[0]?.message?.content;
    if (!content) return prospects.map(() => ({ painPoint: "", outreachAngle: "" }));
    const parsed = JSON.parse(content) as {
      items?: { n?: number; painPoint?: string; outreachAngle?: string }[];
    };
    const byIndex = new Map<number, ProspectAngle>();
    (parsed.items ?? []).forEach((it, idx) => {
      const n = typeof it.n === "number" ? it.n - 1 : idx;
      byIndex.set(n, {
        painPoint: (it.painPoint ?? "").trim(),
        outreachAngle: (it.outreachAngle ?? "").trim(),
      });
    });
    return prospects.map(
      (_, i) => byIndex.get(i) ?? { painPoint: "", outreachAngle: "" }
    );
  } catch {
    return prospects.map(() => ({ painPoint: "", outreachAngle: "" }));
  }
}
