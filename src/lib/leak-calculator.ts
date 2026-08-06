// The leak calculator — the six questions, their bands, and the arithmetic.
//
// This is a direct port of the standalone Leak Calculator that ran as an HTML
// file on the operator's desktop. It is the FIRST of the two sources of truth
// about a client (the other is the intake form): what they told us on the call,
// priced against their own two numbers.
//
// PURE. No Prisma, no fetch, no React. The page renders it, the API stores its
// output, and the client-facing documents read that stored output — they never
// re-run this. One computation, one set of numbers, everywhere.
//
// EVERY STRING HERE IS READ BY THE PROSPECT. The calculator is screen-shared
// live on the sales call. There are no operator notes, no "their answers", no
// coaching text. If a line would embarrass us on a projector, it does not belong.

// ── The model ────────────────────────────────────────────────────────────────
//
//   exposure — the share of monthly enquiries this leak can even touch
//   band     — [low, high] share of those exposed enquiries that are lost
//
//   Rows 1–5:  loss = enquiries × exposure × band × closeRate × jobValue
//   Row 6:     stock-based — jobs recoverable per YEAR, spread across 12 months
//
// `showFactor` on the no-show row REPLACES the close rate: a no-show is an
// already-booked job, so the rate at which enquiries become jobs no longer
// applies — what matters is the share of no-shows that would have gone ahead.

export interface LeakOption {
  /** The answer, in the owner's words. */
  text: string;
  /** [low, high] share of exposed enquiries lost. Rows 1–5. */
  band?: [number, number];
  /** [low, high] jobs recoverable per YEAR. Row 6 only. */
  jobsPerYear?: [number, number];
  /** A "don't know" answer: priced at the second-worst band and labelled. */
  assumed?: boolean;
  /** The plain consequence line shown once this answer is picked. */
  consequence: string;
}

export interface LeakDef {
  id: string;
  label: string;
  /** The question. `**bold**` marks the phrase that carries the emphasis. */
  question: string;
  /** What we install to close it. Shown by the reveal toggle. */
  fix: string;
  exposure: number;
  /** Row 6 is priced off a stock of old quotes, not a monthly flow. */
  stock?: boolean;
  /** Replaces the close rate on this row (see the note above). */
  showFactor?: number;
  options: LeakOption[];
}

export const LEAKS: LeakDef[] = [
  {
    id: "after",
    label: "After hours",
    exposure: 0.28,
    question:
      "Someone fills out your form or calls at **8pm on a Tuesday**. What happens between then and the next morning?",
    fix: "Instant AI response and text-back, nights and weekends included — the lead is answered in seconds and booked before morning.",
    options: [
      { text: "Something responds within minutes", band: [0, 0], consequence: "Nothing leaking here — after-hours is covered." },
      { text: "Voicemail / email — we get back to them next morning", band: [0.15, 0.3], consequence: "So an 8pm lead waits roughly twelve hours. Most of them contact someone else before you open." },
      { text: "Nothing until someone happens to check", band: [0.3, 0.5], consequence: "So an evening lead sits untouched until somebody notices. By then they've usually booked a competitor." },
      { text: "Honestly not sure", band: [0.22, 0.4], assumed: true, consequence: "Not measured — and unmeasured after-hours leads are usually the biggest single gap." },
    ],
  },
  {
    id: "missed",
    label: "Missed calls",
    exposure: 0.15,
    question:
      "During a busy day, a call comes in and **nobody can grab it**. Does anything happen automatically, or is it on someone to call back when they're free?",
    fix: "Missed-call text-back: the caller gets a text within seconds, before they've dialled the next result on the list.",
    options: [
      { text: "They instantly get a text back", band: [0, 0], consequence: "Covered — missed callers get caught automatically." },
      { text: "We call them back when we can", band: [0.25, 0.4], consequence: "So the caller waits on someone being free. In your trade the first company to call back usually gets the job." },
      { text: "They hit voicemail and we hope they leave a message", band: [0.45, 0.65], consequence: "So a missed call becomes a voicemail nobody leaves. Most of those people just call the next result." },
      { text: "We don't know how many we miss", band: [0.35, 0.55], assumed: true, consequence: "Not tracked — which means the number is unknown to you but not to your competitors." },
    ],
  },
  {
    id: "speed",
    label: "Response speed",
    exposure: 0.55,
    question:
      "When an enquiry comes in **during the day**, realistically how long before someone gets back to them?",
    fix: "Every enquiry answered in seconds, automatically, then routed to a human — no dependence on who's free.",
    options: [
      { text: "Under 5 minutes", band: [0, 0], consequence: "Fast enough — this isn't where you're leaking." },
      { text: "Within a few hours", band: [0.04, 0.09], consequence: "A few hours is normal, and normal is the problem: whoever replies in minutes takes the job." },
      { text: "Within a day or two", band: [0.12, 0.25], consequence: "At a day or two, most of these have already hired someone else." },
      { text: "We don't track this", band: [0.1, 0.2], assumed: true, consequence: "Untracked response time — usually slower than the owner thinks." },
    ],
  },
  {
    id: "quote",
    label: "Quote follow-up",
    exposure: 0.3,
    question:
      "You send someone a quote and **they go quiet**. Does anything chase them, or is it on whoever remembers?",
    fix: "An automatic follow-up sequence across two weeks — email and text — that runs whether anyone remembers or not.",
    options: [
      { text: "Automatic plus personal follow-up over the next days", band: [0, 0], consequence: "Handled — quotes get chased properly." },
      { text: "One follow-up if we remember", band: [0.1, 0.2], consequence: "One attempt, if someone remembers. Most deals need five touches; you're stopping at one." },
      { text: "Usually nothing", band: [0.22, 0.38], consequence: "So a quote going quiet is a job gone. These are the warmest leads you have." },
      { text: "Nothing — we move on", band: [0.28, 0.45], consequence: "Nothing chases them — and they already told you they were interested enough to get a quote." },
    ],
  },
  {
    id: "noshow",
    label: "No-shows",
    exposure: 0.35,
    showFactor: 0.5,
    question:
      "Someone books and **doesn't turn up**. Does anything go out before to remind them, or after to get them rebooked?",
    fix: "Confirmation on booking, reminders the day before and two hours out, and a rebooking text if they still don't show.",
    options: [
      { text: "Automated reminders before, and a recovery text after", band: [0, 0], consequence: "Covered — reminders and recovery are running." },
      { text: "We call them if we notice", band: [0.08, 0.15], consequence: "So it depends on someone noticing. The slot is already gone by then." },
      { text: "Nothing", band: [0.12, 0.2], consequence: "So a no-show is a paid-for lead, a held slot, and no revenue — and they never hear from you again." },
      { text: "We don't track no-shows", band: [0.1, 0.18], assumed: true, consequence: "Untracked no-shows: the slot cost is invisible, which is exactly why it stays high." },
    ],
  },
  {
    id: "reactivate",
    label: "Past customers & old quotes",
    exposure: 0,
    stock: true,
    question:
      "Everyone who got a quote last year and **didn't go ahead** — does anyone ever contact them again?",
    fix: "A database reactivation campaign across the dormant list, then a standing sequence so it never goes stale again.",
    options: [
      { text: "Systematic re-engagement", jobsPerYear: [0, 0], consequence: "Being worked — good, most businesses never touch this list." },
      { text: "Occasionally, manually", jobsPerYear: [0.5, 1.5], consequence: "Occasional and manual, so it depends on a slow week. That list is the cheapest revenue you own." },
      { text: "Never", jobsPerYear: [1.5, 4], consequence: "Never — so every quote that didn't close last year is just sitting there, paid for and forgotten." },
    ],
  },
];

/** The rough-impact choices on a custom row, in jobs per month. */
export const CUSTOM_IMPACT_OPTIONS = [
  { value: 0, label: "— rough impact —" },
  { value: 0.5, label: "Costs about half a job a month" },
  { value: 1, label: "Costs about a job a month" },
  { value: 2, label: "Costs a couple of jobs a month" },
];

/** Exactly two. They exist for one case: a prospect volunteers something the six
 *  questions don't cover and it gets priced live rather than waved away. */
export const CUSTOM_ROW_COUNT = 2;

export const DEFAULT_CLOSE_RATE_PCT = 30;
export const DEFAULT_OVERLAP_PCT = 30;
export const DEFAULT_CAP_PCT = 20;

// ── Inputs and output ────────────────────────────────────────────────────────

export interface CustomRowInput {
  label: string;
  /** Jobs per month. 0 = the row is off. */
  jobsPerMonth: number;
}

export interface CalculatorInputs {
  monthlyEnquiries: number | null;
  avgJobValue: number | null;
  /** leak id → chosen option index, or null when unanswered. */
  answers: Record<string, number | null>;
  customRows: CustomRowInput[];
  closeRatePct: number;
  overlapPct: number;
  capPct: number;
}

export interface ComputedRow {
  id: string;
  label: string;
  /** The answer in the owner's words — null when unanswered. */
  answerText: string | null;
  consequence: string | null;
  fix: string;
  /** A "don't know" answer: priced, and labelled as assumed on screen. */
  assumed: boolean;
  /** This area came back tight. Renders as "no leak", not as a zero. */
  clean: boolean;
  /** Adjusted AND rounded. These are the figures shown, and they sum to the total. */
  monthlyLow: number | null;
  monthlyHigh: number | null;
}

export interface ComputedAssessment {
  /** Both of their numbers are present. Nothing is priced until they are. */
  ready: boolean;
  rows: ComputedRow[];
  customRows: ComputedRow[];
  /** EXACTLY the sum of the rounded row figures above. See reconciliation note. */
  totalLow: number;
  totalHigh: number;
  annualLow: number;
  annualHigh: number;
  /** The overlap cut actually applied, as a whole percent — stated on the page. */
  overlapAppliedPct: number;
  /** The plausibility cap fired and compressed the total. Labelled on screen. */
  capped: boolean;
  answeredCount: number;
  cleanCount: number;
  assumedCount: number;
  /** Every answered area came back clean. A real outcome, not a failure. */
  allClean: boolean;
  /** The method sentence, in plain language, for the prospect to read. */
  derivation: string;
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function money(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-CA");
}

/** Round to a figure that reads like an estimate rather than a measurement.
 *  A precise-looking number implies precision we do not have. */
export function roundFigure(n: number): number {
  if (n >= 4000) return Math.round(n / 500) * 500;
  if (n >= 800) return Math.round(n / 100) * 100;
  return Math.round(n / 50) * 50;
}

/** "$1,200–2,400" — the trailing figure drops its dollar sign, as a range reads. */
export function rangeText(low: number, high: number): string {
  return money(low) + "–" + money(high).replace("$", "");
}

// ── THE MONEY LAW ────────────────────────────────────────────────────────────
// The currency marker comes FIRST, always: "CAD $1,290". Never "$1,290 CAD",
// never a bare "$1,290".
//
// It is one law with one reason. This calculator is screen-shared live, and the
// offer page is sent afterwards — the same person reads both. A page that says
// "$6,500 CAD" beside one that says "CAD $1,290" looks like two documents from
// two companies, on the screen where somebody decides to pay us.
//
// These two functions exist so there is ONE formatter, not one per surface.
// Three separately hand-rolled money strings survived several deliberate passes
// over this codebase before, for the simple reason that a "$" typed in JSX reads
// as prose. scripts/verify-phase4.ts section H renders the offer and reads the
// visible words; section J scans the source of both files, so a new bare "$"
// cannot be typed in the first place.

export function cad(n: number): string {
  return "CAD " + money(n);
}

export function cadRange(low: number, high: number): string {
  return "CAD " + rangeText(low, high);
}

/** Put the marker in front of any figure that is missing it. CHANGES NO DIGITS.
 *
 *  WHY THIS IS NEEDED EVEN THOUGH cad() EXISTS. `derivation` is a SENTENCE that
 *  is computed once and FROZEN on the row — the offer page reads the stored blob
 *  and never recomputes it, which is the whole point (a client is shown the
 *  numbers he was actually quoted, not what today's model would produce). That
 *  also means a row saved before this law was applied carries its old, unmarked
 *  sentence forever. Re-running the model to fix a currency marker would requote
 *  the client; leaving it prints "at $3,000 a job" underneath "CAD $6,550".
 *
 *  So the marker — and only the marker — is repaired at render. The predicate is
 *  deliberately identical to bareDollarFigures() in scripts/verify-phase4.ts:
 *  anything that check would flag, this repairs, and a figure somebody wrote in
 *  another currency on purpose ("US$84") is left exactly alone. */
export function markCurrency(text: string): string {
  return text.replace(/\$\s?\d[\d,]*(?:\.\d{1,2})?/g, (match, offset: number, whole: string) => {
    const before = whole.slice(Math.max(0, offset - 6), offset);
    if (/CAD\s*$/.test(before)) return match; // already marked
    if (/[A-Za-z]$/.test(before)) return match; // US$84 — a different currency
    return "CAD " + match.replace(/^\$\s+/, "$");
  });
}

// ── The computation ──────────────────────────────────────────────────────────

export function emptyInputs(): CalculatorInputs {
  return {
    monthlyEnquiries: null,
    avgJobValue: null,
    answers: Object.fromEntries(LEAKS.map((l) => [l.id, null])),
    customRows: Array.from({ length: CUSTOM_ROW_COUNT }, () => ({ label: "", jobsPerMonth: 0 })),
    closeRatePct: DEFAULT_CLOSE_RATE_PCT,
    overlapPct: DEFAULT_OVERLAP_PCT,
    capPct: DEFAULT_CAP_PCT,
  };
}

export function computeAssessment(input: CalculatorInputs): ComputedAssessment {
  const vol = Math.max(0, input.monthlyEnquiries ?? 0);
  const jv = Math.max(0, input.avgJobValue ?? 0);
  const closeRate = Math.min(1, Math.max(0.01, (input.closeRatePct || DEFAULT_CLOSE_RATE_PCT) / 100));
  const overlap = Math.min(1, Math.max(0, (input.overlapPct ?? DEFAULT_OVERLAP_PCT) / 100));
  const capShare = Math.min(1, Math.max(0.05, (input.capPct || DEFAULT_CAP_PCT) / 100));
  const ready = vol > 0 && jv > 0;

  // ── Pass 1 · raw bands, before any adjustment ──────────────────────────────
  interface Raw { low: number; high: number; index: number; assumed: boolean }
  const raw: (Raw | null)[] = [];
  let rawLow = 0;
  let answeredCount = 0;
  let cleanCount = 0;
  let assumedCount = 0;

  for (const leak of LEAKS) {
    const idx = input.answers[leak.id];
    if (idx === null || idx === undefined || !leak.options[idx]) {
      raw.push(null);
      continue;
    }
    const opt = leak.options[idx];
    answeredCount++;
    if (opt.assumed) assumedCount++;

    let low: number;
    let high: number;
    if (leak.stock) {
      const y = opt.jobsPerYear ?? [0, 0];
      low = (y[0] * jv) / 12;
      high = (y[1] * jv) / 12;
    } else {
      const band = opt.band ?? [0, 0];
      // showFactor REPLACES the close rate on the no-show row — see the note at
      // the top of this file.
      const factor = leak.showFactor ?? closeRate;
      low = vol * leak.exposure * band[0] * factor * jv;
      high = vol * leak.exposure * band[1] * factor * jv;
    }
    if (high === 0) cleanCount++;
    raw.push({ low, high, index: idx, assumed: Boolean(opt.assumed) });
    rawLow += low;
  }

  const rawCustom: ({ low: number; high: number } | null)[] = [];
  for (let i = 0; i < CUSTOM_ROW_COUNT; i++) {
    const row = input.customRows[i];
    const jobs = row?.jobsPerMonth ?? 0;
    if (!jobs) {
      rawCustom.push(null);
      continue;
    }
    const entry = { low: jobs * jv * 0.8, high: jobs * jv * 1.2 };
    rawCustom.push(entry);
    rawLow += entry.low;
  }

  // ── The adjustment factor ─────────────────────────────────────────────────
  // Overlap first: one lost lead can appear in more than one row (an 8pm missed
  // call is two rows), so every row is cut by the same share. Then the
  // plausibility cap: if even the cut low estimate would exceed a share of their
  // estimated monthly revenue, compress until it doesn't. Both are stated on the
  // page — a total nobody believes is worth less than a smaller one they do.
  let k = 1 - overlap;
  let capped = false;
  const estimatedRevenue = vol * closeRate * jv;
  if (ready && estimatedRevenue > 0 && rawLow * k > estimatedRevenue * capShare) {
    k = (estimatedRevenue * capShare) / rawLow;
    capped = true;
  }

  // ── Pass 2 · adjust, round, and SUM THE ROUNDED FIGURES ───────────────────
  // The total is the sum of exactly the numbers printed beside each row. It is
  // not computed from the unrounded figures and rounded at the end — that would
  // leave a ledger whose column does not add up to its own bottom line, which is
  // the fastest way to lose an owner who reaches for a calculator.
  const rows: ComputedRow[] = [];
  let totalLow = 0;
  let totalHigh = 0;

  LEAKS.forEach((leak, i) => {
    const r = raw[i];
    if (!r) {
      rows.push({
        id: leak.id, label: leak.label, answerText: null, consequence: null,
        fix: leak.fix, assumed: false, clean: false, monthlyLow: null, monthlyHigh: null,
      });
      return;
    }
    const opt = leak.options[r.index];
    const clean = r.high === 0;
    let low: number | null = null;
    let high: number | null = null;
    if (ready && !clean) {
      low = roundFigure(r.low * k);
      high = roundFigure(r.high * k);
      totalLow += low;
      totalHigh += high;
    }
    rows.push({
      id: leak.id, label: leak.label, answerText: opt.text, consequence: opt.consequence,
      fix: leak.fix, assumed: r.assumed, clean, monthlyLow: low, monthlyHigh: high,
    });
  });

  const customRows: ComputedRow[] = [];
  for (let i = 0; i < CUSTOM_ROW_COUNT; i++) {
    const r = rawCustom[i];
    const label = input.customRows[i]?.label ?? "";
    if (!r || !ready) {
      customRows.push({
        id: `custom-${i}`, label, answerText: null, consequence: null, fix: "",
        assumed: false, clean: false, monthlyLow: null, monthlyHigh: null,
      });
      continue;
    }
    const low = roundFigure(r.low * k);
    const high = roundFigure(r.high * k);
    totalLow += low;
    totalHigh += high;
    customRows.push({
      id: `custom-${i}`, label, answerText: null, consequence: null, fix: "",
      assumed: false, clean: false, monthlyLow: low, monthlyHigh: high,
    });
  }

  const overlapAppliedPct = Math.round((1 - k) * 100);
  const allClean = answeredCount > 0 && cleanCount === answeredCount;

  // ── The method sentence, for the prospect ─────────────────────────────────
  let derivation: string;
  if (!ready) {
    derivation = "Add your two numbers above to start.";
  } else if (allClean) {
    derivation =
      "Every area we asked about came back covered. Nothing here is priced, because on these six questions nothing is leaking.";
  } else if (totalHigh === 0) {
    derivation = "Nothing priced yet — answer the questions above.";
  } else {
    const parts = [
      `Built from ${vol} enquiries a month at ${cad(jv)} a job, a ${Math.round(closeRate * 100)}% close rate, and published industry benchmarks.`,
      `Every row is already cut ${overlapAppliedPct}% — the same lost lead can show up in more than one, so the rows add up to the total.`,
    ];
    if (assumedCount > 0) {
      parts.push(`${assumedCount} row${assumedCount > 1 ? "s" : ""} marked assumed: not measured on your side.`);
    }
    if (cleanCount > 0) {
      parts.push(`${cleanCount} area${cleanCount > 1 ? "s" : ""} came back clean.`);
    }
    derivation = parts.join(" ");
  }

  return {
    ready,
    rows,
    customRows,
    totalLow,
    totalHigh,
    annualLow: totalLow * 12,
    annualHigh: totalHigh * 12,
    overlapAppliedPct,
    capped,
    answeredCount,
    cleanCount,
    assumedCount,
    allClean,
    derivation,
  };
}
