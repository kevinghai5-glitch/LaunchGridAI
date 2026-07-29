import { z } from "zod";

// Auth
export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Business
// Two search modes: by industry+city (discovery) or by a specific business name.
export const businessSearchSchema = z
  .object({
    mode: z.enum(["industry", "name"]).default("industry"),
    industry: z.string().optional(),
    city: z.string().optional(),
    name: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "name") {
      if (!data.name || data.name.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Business name must be at least 2 characters",
          path: ["name"],
        });
      }
    } else {
      if (!data.industry || data.industry.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Industry must be at least 2 characters",
          path: ["industry"],
        });
      }
      if (!data.city || data.city.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "City must be at least 2 characters",
          path: ["city"],
        });
      }
    }
  });

export const saveBusinessSchema = z.object({
  googlePlaceId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  mapsUrl: z.string().optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  photoUrl: z.string().optional(),
});

// Lead lifecycle statuses (mirror LeadStatus in src/lib/call-queue.ts). Kept as a
// literal enum here to avoid importing runtime code into the validation layer.
const LEAD_STATUSES = [
  "SUGGESTED",
  "DECLINED",
  "QUEUED",
  "CALLED",
  "NO_ANSWER",
  "CALLBACK",
  "BOOKED_ZOOM",
  "ZOOM_NO_SHOW",
  "ZOOM_OPEN",
  "WAITING",
  "PROPOSAL",
  "WON",
  "CLOSED",
  "DEAD",
] as const;

export const updateBusinessSchema = z.object({
  favorited: z.boolean().optional(),
  painPoint: z.string().optional(),
  outreachAngle: z.string().optional(),
  suggestedOffer: z.string().optional(),
  // CRM record edits — manual status moves on the board + freeform notes.
  status: z.enum(LEAD_STATUSES).optional(),
  // Inline-editable scheduling: CRM "next action" cell + calendar drag-to-reschedule.
  nextAction: z.string().nullable().optional(),
  nextActionAt: z.coerce.date().nullable().optional(),
  notes: z.string().optional(),
  // Deliverable numbers — manually entered; blank/null → BENCHMARK mode.
  // Nullable so the operator can clear a field back to benchmark math.
  avgClientValueCad: z.coerce.number().int().positive().nullable().optional(),
  monthlyLeadVolume: z.coerce.number().int().positive().nullable().optional(),
  monthlyAdSpendCad: z.coerce.number().int().nonnegative().nullable().optional(),
  // Intake system booleans — null clears back to "unknown / not asked".
  hasCrm: z.boolean().nullable().optional(),
  hasFollowUpSequence: z.boolean().nullable().optional(),
  hasReminderSystem: z.boolean().nullable().optional(),
  hasPastCustomerDatabase: z.boolean().nullable().optional(),
  hasCallTracking: z.boolean().nullable().optional(),
  hasOnlinePayment: z.boolean().nullable().optional(),
  // Services they want more of — copy emphasis only.
  servicesFocus: z.string().max(300).nullable().optional(),
  // Intake form: booking / GBP / build priorities. Enums mirror the form verbatim;
  // null clears back to "not asked".
  bookingMethod: z.enum(["PHONE_EMAIL_ONLY", "BOOKING_TOOL", "OTHER"]).nullable().optional(),
  bookingToolName: z.string().max(120).nullable().optional(),
  gbpManagement: z.enum(["SELF", "NOT_SELF", "SOMEONE_ELSE", "NOT_SURE"]).nullable().optional(),
  // How enquiries are handled today. Slugs mirror intake-options.ts verbatim —
  // the detectors match on these exact strings, so a typo here silently drops a
  // leak back to its benchmark hedge instead of failing loudly.
  afterHoursHandling: z
    .enum(["AUTO_RESPONSE", "NEXT_MORNING", "NOTHING", "UNKNOWN"])
    .nullable()
    .optional(),
  missedCallHandling: z
    .enum(["INSTANT_TEXT_BACK", "CALL_BACK_WHEN_FREE", "VOICEMAIL_ONLY", "UNKNOWN"])
    .nullable()
    .optional(),
  responseSpeed: z
    .enum(["UNDER_5_MIN", "FEW_HOURS", "DAY_OR_TWO", "NOT_TRACKED"])
    .nullable()
    .optional(),
  // "Do enquiries come in through Instagram or Facebook messages?" — the only
  // intake answer that is BOTH a leak fact and a build fact. YES confirms
  // social_dm_unmanaged; NO and NO_ACCOUNTS both suppress it; and NO_ACCOUNTS
  // alone switches the Social DM Capture workflow off. Keep all three slugs — the
  // two that behave the same for the leak behave differently for the build.
  socialEnquiries: z.enum(["YES", "NO", "NO_ACCOUNTS"]).nullable().optional(),
  // "When did you last contact past customers or old quotes?" — the dormancy
  // answer that hasPastCustomerDatabase could never give us. SYSTEMATIC suppresses
  // no_database_reactivation; the other three confirm it.
  pastCustomerContact: z
    .enum(["SYSTEMATIC", "OCCASIONAL", "OVER_A_YEAR", "NEVER"])
    .nullable()
    .optional(),
  // "Do you take a deposit or payment before the work is done?" — the
  // applicability fact for the Text-to-Pay workflow. NEVER is the only answer that
  // takes that workflow out of a build; ALWAYS and SOMETIMES both install it.
  //
  // NOT INTERCHANGEABLE WITH hasOnlinePayment above, however alike they look. That
  // one answers "do they already have a mechanism?" and does one job: suppressing
  // the payment_booking_friction leak. Wire it into the build rule instead of this
  // and the inversion is silent — a client who takes deposits with no online way
  // to collect them is the best candidate for Text-to-Pay, not the worst.
  takesDeposits: z.enum(["ALWAYS", "SOMETIMES", "NEVER"]).nullable().optional(),
  // "Who replies to your Google reviews right now?" — NOBODY is itself a finding
  // (no_review_replies, which can only ever be disclosed because nothing we fetch
  // carries owner replies). OWNER is the only answer that makes removing the Review
  // Response workflow reasonable, and it does NOT remove it: the panel raises a
  // hint and the operator decides.
  reviewReplyOwner: z.enum(["NOBODY", "OWNER", "STAFF_OR_AGENCY"]).nullable().optional(),
  // Comma-separated slugs from the fixed 10-option "prioritize in your build" checkbox.
  buildPriorities: z.string().max(400).nullable().optional(),
});

// Zoom outcome — recorded at the end of the "On the Zoom" runner.
export const zoomOutcomeSchema = z.object({
  outcome: z.enum(["CLOSED", "OPEN", "NO_SHOW", "LOST"]),
});

// Generate
export const generateLeadSchema = z.object({
  businessId: z.string().cuid(),
});

export const generateContentSchema = z.object({
  businessId: z.string().cuid(),
});

export const generateAssetsSchema = z.object({
  businessId: z.string().cuid(),
  // When present, regenerate just one deliverable and merge it into the
  // existing pack instead of generating all five.
  section: z.enum(["file1", "file2", "file3", "file4", "file5"]).optional(),
  // The deliberate "refresh research" action: bust the persisted research +
  // PSI snapshots and re-scrape live. Absent/false → regenerate reuses the
  // stored bundle (zero-scrape, zero-API-cost). Fresh data is always a choice.
  refreshResearch: z.boolean().optional(),
});

export const generateColdAuditSchema = z.object({
  businessId: z.string().cuid(),
});

export const generateProposalSchema = z.object({
  businessId: z.string().cuid(),
});

export const generateSuggestionsSchema = z.object({
  businessId: z.string().cuid(),
});

// Proposal — ONE bespoke, two-part conversion engagement.
const proposalLeakSchema = z.object({
  title: z.string(),
  monthlyCost: z.string(),
  detail: z.string(),
});

const proposalComponentSchema = z.object({
  name: z.string(),
  addresses: z.string(),
  detail: z.string(),
  isRetainer: z.boolean(),
});

const proposalProblemSchema = z.object({
  summary: z.string(),
  basis: z.string(),
  leaks: z.array(proposalLeakSchema),
});

const proposalRoiSchema = z.object({
  summary: z.string(),
  recovered: z.string(),
  points: z.array(z.string()),
});

const proposalScopeSchema = z.object({
  included: z.array(z.string()),
  excluded: z.array(z.string()),
});

const proposalPhaseSchema = z.object({
  label: z.string(),
  detail: z.string(),
});

const proposalProofSchema = z.object({
  note: z.string(),
  testimonials: z.array(z.object({ quote: z.string(), attribution: z.string() })),
});

const proposalFaqSchema = z.object({ q: z.string(), a: z.string() });

export const createProposalSchema = z.object({
  businessId: z.string().cuid(),
  title: z.string().min(1, "Title is required"),
  agencyName: z.string().optional(),
  packageOverview: z.string().min(1, "Overview is required"),
  setupFee: z.number().int().positive(),
  monthlyPrice: z.number().int().positive(),
  deliverables: z.array(proposalComponentSchema),
  problem: proposalProblemSchema,
  roi: proposalRoiSchema,
  scope: proposalScopeSchema,
  timeline: z.array(proposalPhaseSchema),
  proof: proposalProofSchema,
  faq: z.array(proposalFaqSchema),
  nextSteps: z.string().optional(),
  emailMessage: z.string().optional(),
});

export const updateProposalSchema = createProposalSchema.partial();

// Deal
export const createDealSchema = z.object({
  businessId: z.string().cuid(),
  proposalId: z.string().cuid().optional(),
  stage: z.enum(["SAVED", "SYSTEMS_GENERATED", "PROPOSAL_SENT", "FOLLOW_UP", "WON", "LOST"]).default("SAVED"),
  monthlyValue: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

export const updateDealSchema = z.object({
  stage: z.enum(["SAVED", "SYSTEMS_GENERATED", "PROPOSAL_SENT", "FOLLOW_UP", "WON", "LOST"]).optional(),
  monthlyValue: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  proposalId: z.string().cuid().optional().nullable(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type BusinessSearchInput = z.infer<typeof businessSearchSchema>;
export type SaveBusinessInput = z.infer<typeof saveBusinessSchema>;
export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
