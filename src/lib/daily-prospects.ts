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
import { orderMetrosByCallTime } from "@/lib/call-timing";
import {
  selectFinding,
  gateAngle,
  type SelectedFinding,
  type Benchmark,
  type FindingSignals,
} from "@/lib/prospect-finding";

export interface ScoredProspect extends PlaceResult {
  score: number;
  metro: string; // the NA metro this prospect was found in (used for the city field)
  // The ONE finding this row is allowed to open with — chosen deterministically
  // from verifiable Places data (never by the LLM). See prospect-finding.ts.
  finding: SelectedFinding;
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
  // Per-metro review benchmark: EVERY same-niche business Places returned for a
  // metro (including ones we skip as already-seen). This is the free, honest
  // competitor pool a review gap is direction-checked against — no extra API
  // call, same category (same niche search), same city.
  const metroPools = new Map<string, Benchmark[]>();

  // Source ONLY from metros where it's a good LOCAL time to cold-call right now
  // (peak windows first). This is what makes a 9am-ET generation skip California
  // (6am there) and a 6pm-ET generation surface the West Coast (still afternoon).
  // Falls back to the soonest-to-open metros when nothing is callable (late night).
  const orderedMetros = orderMetrosByCallTime(NA_METROS, new Date(), metroOffset).metros;
  for (let i = 0; i < orderedMetros.length && collected.length < count * 2; i++) {
    const metro = orderedMetros[i];
    let batch: PlaceResult[] = [];
    try {
      batch = await searchBusinesses(niche, metro, 20);
    } catch {
      // One metro failing (rate limit etc.) shouldn't sink the whole run.
      continue;
    }
    const pool = metroPools.get(metro) ?? [];
    for (const p of batch) {
      if (p.name && p.userRatingsTotal > 0) {
        pool.push({ name: p.name, reviews: p.userRatingsTotal });
      }
      if (!p.placeId || seen.has(p.placeId)) continue;
      seen.add(p.placeId);
      collected.push({ place: p, metro });
    }
    metroPools.set(metro, pool);
  }

  return collected
    .map(({ place, metro }) => {
      const signals: FindingSignals = {
        name: place.name,
        hasWebsite: Boolean(place.website),
        rating: place.rating || 0,
        reviews: place.userRatingsTotal || 0,
      };
      // Direction-check the review gap against this metro's real same-niche pool.
      const finding = selectFinding(signals, metroPools.get(metro) ?? []);
      return {
        ...place,
        metro: metro.split(",")[0].trim(),
        score: opportunityScore(place.rating, place.userRatingsTotal, Boolean(place.website)),
        finding,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

// Per-type instruction the LLM writes copy FOR. The finding TYPE is already
// chosen deterministically upstream (selectFinding) — the model only supplies
// voice for it, and can never introduce a booking/speed claim it can't verify.
function findingBrief(p: ScoredProspect, niche: string): string {
  const f = p.finding;
  switch (f.type) {
    case "NO_REAL_WEBSITE":
      return `FIND = NO REAL WEBSITE. There is no real website, so when someone searches ${p.name} there's nothing to find or book on and they phone during hours or move on. Write the find + opener around that. Do NOT mention reviews, speed, or booking widgets.`;
    case "REVIEW_GAP": {
      const c = f.competitor!;
      return `FIND = REVIEW GAP (direction-verified). ${p.name} shows ${p.userRatingsTotal} Google reviews; a real nearby ${niche} competitor, ${c.name}, shows ${c.reviews}. You MUST name ${c.name} and cite BOTH real numbers (${p.userRatingsTotal} and ${c.reviews}). Frame it as the gap quietly deciding calls. Do NOT say "only [N]", do NOT invent numbers, do NOT mention booking or speed.`;
    }
    case "SYSTEMS_ANGLE":
    default:
      return `FIND = SYSTEMS ANGLE. This business looks STRONG from the outside (${p.userRatingsTotal} reviews${p.rating ? `, ${p.rating}★` : ""}, real site) — do NOT invent a weakness. The opener names that the expensive leaks are the INVISIBLE ones — response speed, follow-up, no-shows — explicitly acknowledging they look good outside. Do NOT claim no website, no booking, slow site, or a review gap.`;
  }
}

// How many businesses each LLM angle-call writes for. A single call that emits
// all 30 businesses' copy is output-token-bound and took ~35s — the dominant
// cost of generation. gpt-4o-mini has ample TPM headroom (the asset pack already
// fires ~9 calls at once), so we split into parallel chunks that each emit ~1/4
// the tokens and finish in a fraction of the wall-time.
const ANGLE_CHUNK_SIZE = 8;

// Write angles for ONE chunk of prospects. Returns a map keyed by the prospect's
// GLOBAL index (offset + local) so results merge back index-aligned. Never
// throws — on any failure it yields an empty map and the gate substitutes
// deterministic templates for that chunk.
async function writeAnglesChunk(
  chunk: ScoredProspect[],
  offset: number,
  niche: string
): Promise<Map<number, ProspectAngle>> {
  const byIndex = new Map<number, ProspectAngle>();
  if (chunk.length === 0) return byIndex;

  const list = chunk
    .map((p, i) => `${i + 1}. ${p.name} — ${p.userRatingsTotal} reviews${p.rating ? `, ${p.rating}★` : ""}\n   ${findingBrief(p, niche)}`)
    .join("\n");

  const prompt = `You help a B2B agency owner cold-call local ${niche} businesses to sell a lead-conversion SYSTEM (instant speed-to-lead, qualification, follow-up, booking — done-for-you, plus a monthly retainer).

Each business below already has its ONE opening find chosen for you (FIND = ...). Your ONLY job is to write that find in the owner's plain, specific voice — you must NOT change the find, and you must NOT introduce any observation that isn't in the FIND line. In particular you may NEVER claim a booking path is missing or a site is slow (those are never observed here). Never invent numbers; use only the real counts in the FIND line.

POSITIONING: the visible find is only the SYMPTOM — where the leak shows. The product is the behind-the-scenes acquisition SYSTEM, NOT a website redesign. Never use "redesign", "new look", or "refresh". The opener points at customers slipping away, not at how the site looks.

For EACH numbered business, write: painPoint = the FIND shaped as a ready-to-say cold-call sentence grounded in that business's real numbers; outreachAngle = a one-line opener built on that same find. Plain and specific, no hype.

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
    if (content) {
      const parsed = JSON.parse(content) as {
        items?: { n?: number; painPoint?: string; outreachAngle?: string }[];
      };
      (parsed.items ?? []).forEach((it, idx) => {
        // n is 1-based within THIS chunk; map to the global prospect index.
        const local = typeof it.n === "number" ? it.n - 1 : idx;
        byIndex.set(offset + local, {
          painPoint: (it.painPoint ?? "").trim(),
          outreachAngle: (it.outreachAngle ?? "").trim(),
        });
      });
    }
  } catch {
    // fall through — the gate substitutes templates for this chunk's rows
  }
  return byIndex;
}

// A call angle per prospect, index-aligned to `prospects`. The LLM only writes
// VOICE for the finding already chosen per row; every row is then run through
// gateAngle(), which rejects any unverifiable/direction-wrong copy and
// substitutes a deterministic, defensible template. So the persisted find is
// verifiable-or-silent by construction — never a disprovable leak. Work is split
// into parallel chunks (see ANGLE_CHUNK_SIZE) to keep generation fast.
export async function writeAngles(
  prospects: ScoredProspect[],
  niche: string
): Promise<ProspectAngle[]> {
  if (prospects.length === 0) return [];

  const chunks: Promise<Map<number, ProspectAngle>>[] = [];
  for (let offset = 0; offset < prospects.length; offset += ANGLE_CHUNK_SIZE) {
    chunks.push(
      writeAnglesChunk(prospects.slice(offset, offset + ANGLE_CHUNK_SIZE), offset, niche)
    );
  }
  const maps = await Promise.all(chunks);
  const byIndex = new Map<number, ProspectAngle>();
  for (const m of maps) for (const [k, v] of Array.from(m)) byIndex.set(k, v);

  // The output gate (Defect C): every row must be verifiable + direction-checked
  // + defensible, or it falls back to the deterministic template. This is the
  // single point where an untrustworthy find can never reach the queue.
  return prospects.map((p, i) => {
    const signals: FindingSignals = {
      name: p.name,
      hasWebsite: Boolean(p.website),
      rating: p.rating || 0,
      reviews: p.userRatingsTotal || 0,
    };
    const gated = gateAngle(signals, p.finding, byIndex.get(i));
    return gated.angle;
  });
}
