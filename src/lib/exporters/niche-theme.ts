// Niche-aware theme engine for client-facing deliverables.
//
// Maps an industry / Google-Places category string to a small set of design
// tokens (accent, gradient, mood, eyebrow) so each generated deliverable feels
// tailored to the vertical it's written for — dental looks clinical, med spa
// looks luxe, gym looks energetic, roofer looks trust-heavy, etc.
//
// Consumed by html.ts (and any other client-facing exporter that wants to
// look industry-appropriate). Falls back to a clean default for unknown
// industries so we never produce something off-brand.

export type NicheMood =
  | "clinical"
  | "luxury"
  | "energetic"
  | "trust"
  | "hospitality"
  | "professional"
  | "premium"
  | "default";

export interface NicheTheme {
  /** Primary brand accent (hex, with #). */
  accent: string;
  /** Soft tinted accent for backgrounds (hex). */
  accentSoft: string;
  /** Hero gradient stops, top-left → bottom-right. */
  gradientStart: string;
  gradientEnd: string;
  /** Stack used for headings — body always stays system-ui for legibility. */
  headingFont: string;
  /** Short ALL-CAPS eyebrow that sits above the document H1. */
  eyebrow: string;
  /** Mood key — drives subtle CSS variant choices in html.ts. */
  mood: NicheMood;
}

/**
 * Anything we want to match against goes through this normalizer:
 * lowercased, underscores → spaces, collapsed whitespace.
 */
function norm(input: string | null | undefined): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface NicheRule {
  /** Keywords — if any match the normalized industry, this rule wins. */
  match: string[];
  theme: NicheTheme;
}

// Ordered: most specific niches first so e.g. "med spa" wins before "spa".
const RULES: NicheRule[] = [
  // ── Dental / Orthodontic — clinical, trustworthy, crisp blue/teal ─────────
  {
    match: ["dentist", "dental", "orthodont", "endodont", "periodont", "oral surgeon"],
    theme: {
      accent: "#0F8FA8",
      accentSoft: "#E6F4F8",
      gradientStart: "#0F8FA8",
      gradientEnd: "#1B5E80",
      headingFont: "'Inter', system-ui, sans-serif",
      eyebrow: "PRACTICE GROWTH BLUEPRINT",
      mood: "clinical",
    },
  },

  // ── Med spa / Aesthetic / Cosmetic — luxe, restrained, warm taupe ────────
  {
    match: [
      "med spa",
      "medspa",
      "medical spa",
      "day spa",
      "wellness",
      "aesthetic",
      "cosmetic",
      "botox",
      "laser clinic",
      "plastic surgeon",
      "dermatolog",
      "spa",
    ],
    theme: {
      accent: "#9C7E5A",
      accentSoft: "#F5EFE6",
      gradientStart: "#B89A78",
      gradientEnd: "#5E4A35",
      headingFont: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
      eyebrow: "CLIENT EXPERIENCE STRATEGY",
      mood: "luxury",
    },
  },

  // ── Gym / Fitness / Studio — energetic, bold, high-contrast ───────────────
  {
    match: [
      "gym",
      "fitness",
      "crossfit",
      "pilates",
      "yoga",
      "boxing",
      "personal trainer",
      "martial art",
      "f45",
      "orangetheory",
    ],
    theme: {
      accent: "#FF4D2E",
      accentSoft: "#FFEDE7",
      gradientStart: "#FF4D2E",
      gradientEnd: "#A4170B",
      headingFont: "'Inter', system-ui, sans-serif",
      eyebrow: "MEMBER ACQUISITION SYSTEM",
      mood: "energetic",
    },
  },

  // ── Roofing / HVAC / Plumbing / Home services — trust, navy + warm gold ──
  {
    match: [
      "roof",
      "hvac",
      "plumb",
      "electrician",
      "contractor",
      "remodel",
      "construction",
      "garage door",
      "fence",
      "pool service",
      "pest control",
      "landscap",
      "tree service",
      "general contractor",
    ],
    theme: {
      accent: "#1E3A8A",
      accentSoft: "#E8EDF8",
      gradientStart: "#1E3A8A",
      gradientEnd: "#0B1D4D",
      headingFont: "'Inter', system-ui, sans-serif",
      eyebrow: "JOB PIPELINE BLUEPRINT",
      mood: "trust",
    },
  },

  // ── Restaurant / Cafe / Bar — warm, social, appetizing ────────────────────
  {
    match: [
      "restaurant",
      "cafe",
      "coffee shop",
      "bistro",
      "bakery",
      "bar",
      "pub",
      "brewery",
      "winery",
      "diner",
      "food truck",
      "pizzeria",
      "steakhouse",
    ],
    theme: {
      accent: "#C2410C",
      accentSoft: "#FBEFE5",
      gradientStart: "#C2410C",
      gradientEnd: "#7A2208",
      headingFont: "'Playfair Display', Georgia, serif",
      eyebrow: "GUEST ACQUISITION BLUEPRINT",
      mood: "hospitality",
    },
  },

  // ── Law / Accounting / Financial / Consulting — professional, conservative
  {
    match: [
      "lawyer",
      "attorney",
      "law firm",
      "legal",
      "accountant",
      "cpa",
      "tax",
      "financial advisor",
      "wealth",
      "insurance",
      "consult",
    ],
    theme: {
      accent: "#1F3A5F",
      accentSoft: "#E6ECF3",
      gradientStart: "#1F3A5F",
      gradientEnd: "#0A1A2F",
      headingFont: "'Inter', system-ui, sans-serif",
      eyebrow: "CLIENT ACQUISITION FRAMEWORK",
      mood: "professional",
    },
  },

  // ── Salon / Barber / Lash / Nail — premium beauty, soft rose ──────────────
  {
    match: [
      "salon",
      "barber",
      "hair stylist",
      "nail",
      "lash",
      "brow",
      "beauty",
      "makeup",
      "wax",
      "tan",
    ],
    theme: {
      accent: "#B83D5A",
      accentSoft: "#FBE8EE",
      gradientStart: "#B83D5A",
      gradientEnd: "#6F1F33",
      headingFont: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
      eyebrow: "BOOKED CHAIR STRATEGY",
      mood: "premium",
    },
  },

  // ── Real estate / Brokerage — confident, modern ──────────────────────────
  {
    match: ["real estate", "realtor", "broker", "property management", "mortgage"],
    theme: {
      accent: "#0F766E",
      accentSoft: "#E2F2F0",
      gradientStart: "#0F766E",
      gradientEnd: "#063A35",
      headingFont: "'Inter', system-ui, sans-serif",
      eyebrow: "LISTING & LEAD STRATEGY",
      mood: "professional",
    },
  },

  // ── Auto / Detailing / Repair ─────────────────────────────────────────────
  {
    match: [
      "auto repair",
      "auto body",
      "mechanic",
      "tire",
      "detailing",
      "car wash",
      "dealership",
      "transmission",
    ],
    theme: {
      accent: "#B91C1C",
      accentSoft: "#FCE8E8",
      gradientStart: "#B91C1C",
      gradientEnd: "#5C0A0A",
      headingFont: "'Inter', system-ui, sans-serif",
      eyebrow: "BAY UTILIZATION STRATEGY",
      mood: "trust",
    },
  },

  // ── Veterinary / Pet ──────────────────────────────────────────────────────
  {
    match: ["vet", "veterinar", "pet groom", "pet hospital", "animal clinic", "dog daycare"],
    theme: {
      accent: "#2563EB",
      accentSoft: "#E8EFFE",
      gradientStart: "#2563EB",
      gradientEnd: "#102A66",
      headingFont: "'Inter', system-ui, sans-serif",
      eyebrow: "CLIENT BONDING STRATEGY",
      mood: "trust",
    },
  },
];

// Clean, on-brand default — used when we can't confidently classify.
const DEFAULT_THEME: NicheTheme = {
  accent: "#1F5FFF",
  accentSoft: "#EEF3FF",
  gradientStart: "#1F5FFF",
  gradientEnd: "#0A2A8C",
  headingFont: "'Inter', system-ui, sans-serif",
  eyebrow: "GROWTH INFRASTRUCTURE BLUEPRINT",
  mood: "default",
};

/**
 * Resolve a theme from a business's industry / Google-Places category.
 * Pass anything you have — both can be null. We try the more specific
 * one first, then fall back to the other, then to the default theme.
 */
// Single fixed brand theme for the v2 deliverable engine: one premium dark/gold
// system across every niche (no per-vertical palettes). The color tokens here
// are not used by the v2 shell (it hardcodes the gold palette in :root); only
// headingFont and eyebrow are read. Kept as a NicheTheme so existing consumers
// keep type-checking.
const BRAND_THEME: NicheTheme = {
  accent: "#C9A96E",
  accentSoft: "rgba(201,169,110,.14)",
  gradientStart: "#D8BE86",
  gradientEnd: "#9E7C44",
  headingFont: "'Inter', system-ui, sans-serif",
  eyebrow: "CONVERSION INTELLIGENCE",
  mood: "premium",
};

// Neutralized (v2): always returns the single fixed brand theme. The per-niche
// RULES/DEFAULT_THEME tables are retained above for reference but no longer drive
// the palette — the deliverables use one consistent dark/gold identity.
export function resolveNicheTheme(
  _industry?: string | null | undefined,
  _category?: string | null | undefined
): NicheTheme {
  return BRAND_THEME;
}
