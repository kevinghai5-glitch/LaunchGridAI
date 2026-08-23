// Call Queue → CSV, shaped for the LeadConnector (GHL) power dialer.
//
// The operator dials the day's list through GHL, which imports contacts from a
// CSV. So this file has exactly one job: turn today's queue into a file GHL will
// swallow without hand-editing, and that he can also open in Sheets to eyeball.
//
// Everything here is PURE — no DB, no session, no fetch — so the whole format is
// verifiable offline (scripts/verify-export.ts) rather than only observable by
// downloading a file and squinting at it.


// ---------------------------------------------------------------------------
// Phone normalization
// ---------------------------------------------------------------------------

/**
 * Normalize to E.164 (+14165550123) for the dialer. Google Places hands back
 * national format — "(416) 555-0123" — which some dialers accept and some
 * silently drop; E.164 is unambiguous everywhere.
 *
 * Returns null when the input can't be resolved to a dialable number. A null is
 * the honest answer and the caller SKIPS that row: a contact row with a broken
 * phone is worse than an absent one, because the dialer imports it, tries it,
 * and burns a slot in the middle of a calling block.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;

  // Already international — trust the caller's country code, just strip
  // formatting. Never re-stamp +1 onto a number that declared its own country.
  if (s.startsWith("+")) {
    const digits = s.slice(1).replace(/\D/g, "");
    // E.164 allows at most 15 digits; a country code is at least 1 + a
    // subscriber number, so anything under 8 is a fragment, not a number.
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const digits = s.replace(/\D/g, "");
  // NANP: 10 digits bare, or 11 with the country code already on the front.
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// ---------------------------------------------------------------------------
// CSV encoding (RFC 4180 + spreadsheet formula safety)
// ---------------------------------------------------------------------------

// Characters that make Excel / Google Sheets treat a cell as a FORMULA rather
// than text. A business name or an LLM-written call angle is untrusted content:
// Google Places will happily return a name starting with "+" or "=", and the
// angle writer starts sentences with "-" often enough. Opening such a file can
// execute the cell.
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * Encode one cell.
 *
 * `untrusted` marks columns whose content came from Places, the LLM, or free
 * text the operator typed — those get formula-neutralized with a leading
 * apostrophe, the standard mitigation.
 *
 * Columns we generate ourselves (phone, IDs, numbers, URLs, tags) pass
 * untrusted=false ON PURPOSE. Neutralizing them would be actively harmful: the
 * Phone column is E.164 and therefore ALWAYS starts with "+", so blanket
 * neutralization would write '+14165550123 into every row and hand GHL a
 * leading apostrophe on the one field the dialer actually needs. There is no
 * injection vector in a value this module just built to a fixed shape.
 */
export function csvCell(value: unknown, untrusted = true): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (!s) return "";

  if (untrusted && FORMULA_LEAD.test(s)) s = `'${s}`;

  // Quote when the value contains a delimiter, a quote, or any newline; escape
  // embedded quotes by doubling. Call notes and angles routinely contain commas.
  // Tabs are quoted too — RFC 4180 doesn't require it, but lenient parsers trim
  // leading whitespace from unquoted fields, which would strip the neutralizing
  // apostrophe back off a cell that started with a tab.
  if (/[",\r\n\t]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

/** The lead shape this exporter needs. A structural subset of the queue row. */
export interface ExportLead {
  id: string;
  name: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  address: string | null;
  industry: string | null;
  status: string;
  // The do-not-call axis (dial-status.ts). Included as its own CSV column so a
  // non-fresh business that ever leaks into an export is visible at a glance
  // rather than discovered mid-call.
  dialStatus: string;
  nextAction: string | null;
  attemptCount: number;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  painPoint: string | null;
  outreachAngle: string | null;
  ownerName: string | null;
}

/**
 * Split a resolved owner name into first / last. Everything after the first
 * token is the surname, so "Mary Anne Van Der Berg" keeps its full surname
 * rather than losing the tail. Blank when no owner was ever resolved — GHL
 * shows the business name in that case, which is what he'd say on the call
 * anyway.
 */
export function splitOwnerName(owner: string | null | undefined): {
  first: string;
  last: string;
} {
  const parts = (owner ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

interface Column {
  header: string;
  /** False only for values this module constructs to a known shape. */
  untrusted?: boolean;
  value: (lead: ExportLead, ctx: { phone: string; dateKey: string }) => unknown;
}

// Header names match GHL's standard contact fields where one exists, so the
// import screen auto-maps them instead of making him pair columns by hand. The
// rest land as custom fields and show up beside the number while he dials.
//
// TWELVE COLUMNS, and the count is the point. This carried twenty. Nine came out
// because they duplicated state that already lives in this software — status,
// dial status, attempts, next action — or rode along unread: the maps link, the
// internal lead id, and a time zone GHL derives from the number itself. Each one
// was another row to pair by hand on GHL's mapping screen, every morning.
//
// Tags came out with them and went back in, deliberately. The plan was to apply
// tags by hand in GHL instead; the manual version was worse, so the column is
// back — last, so the saved mapping for the other eleven is untouched.
//
// The eight that came out STAY out. Status especially: GHL defaults it to the
// Opportunity object, so shipping it would raise an opportunity for every cold
// prospect and flood the pipeline.
//
// Pain Point came out for a different reason. It is a GUESS, and a guess does not
// belong on screen during a live call: the script asks, it never asserts.
const COLUMNS: Column[] = [
  { header: "First Name", value: (l) => splitOwnerName(l.ownerName).first },
  { header: "Last Name", value: (l) => splitOwnerName(l.ownerName).last },
  { header: "Business Name", value: (l) => l.name ?? "" },
  // Built by normalizePhone to +[digits] — see csvCell's note on why this is
  // NOT formula-neutralized.
  { header: "Phone", untrusted: false, value: (_l, ctx) => ctx.phone },
  { header: "Address", value: (l) => l.address ?? "" },
  { header: "City", value: (l) => l.city ?? "" },
  { header: "Website", untrusted: false, value: (l) => l.website ?? "" },
  { header: "Industry", value: (l) => l.industry ?? "" },
  { header: "Rating", untrusted: false, value: (l) => (l.rating ? l.rating.toFixed(1) : "") },
  { header: "Reviews", untrusted: false, value: (l) => l.reviewCount ?? "" },
  { header: "Call Angle", value: (l) => l.outreachAngle ?? "" },
  // TAGS IS LAST, and appending is the point: GHL matches columns by header name
  // rather than position, so adding one at the end cannot disturb the saved
  // mapping for the eleven before it.
  //
  // GHL imports these straight into the contact, which is the whole reason the
  // column exists — without it the batch tag gets typed by hand on the import
  // screen every morning, and a manual step that runs daily is a step that
  // eventually gets skipped. The date makes one day's push selectable after the
  // fact; the niche makes verticals comparable without touching the export.
  {
    header: "Tags",
    untrusted: false,
    value: (l, ctx) =>
      ["reclaimedhq", "cold-call", ctx.dateKey, (l.industry ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-")]
        .filter(Boolean)
        .join(", "),
  },
];

/** The header row, exported so verification can assert against it. */
export const CSV_HEADERS: string[] = COLUMNS.map((c) => c.header);

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export interface CsvBuildResult {
  csv: string;
  /** Rows actually written (excludes skipped). */
  rowCount: number;
  /** Leads dropped because no dialable phone could be resolved. */
  skippedNoPhone: number;
}

/**
 * Build the CSV. `dateKey` is YYYY-MM-DD and appears in every row's tags.
 *
 * Rows without a dialable phone are SKIPPED and counted, not emitted blank —
 * see normalizePhone. The count comes back so the UI can tell him, rather than
 * leaving him to notice the import came in 3 short.
 */
export function buildCallQueueCsv(
  leads: ExportLead[],
  dateKey: string
): CsvBuildResult {
  const lines: string[] = [CSV_HEADERS.map((h) => csvCell(h, false)).join(",")];
  let skippedNoPhone = 0;

  for (const lead of leads) {
    const phone = normalizePhone(lead.phone);
    if (!phone) {
      skippedNoPhone++;
      continue;
    }
    const ctx = { phone, dateKey };
    lines.push(
      COLUMNS.map((c) => csvCell(c.value(lead, ctx), c.untrusted ?? true)).join(",")
    );
  }

  return {
    // CRLF per RFC 4180 — the line ending Excel expects and GHL accepts.
    csv: lines.join("\r\n") + "\r\n",
    rowCount: lines.length - 1,
    skippedNoPhone,
  };
}

/**
 * Download filename. The date is the point — he pulls one of these every
 * morning and needs last Tuesday's list to still be identifiable in the
 * downloads folder a month later.
 */
export function exportFilename(dateKey: string): string {
  const safe = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : "undated";
  return `call-queue-${safe}.csv`;
}
