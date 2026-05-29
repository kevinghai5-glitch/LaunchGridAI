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
export const businessSearchSchema = z.object({
  industry: z.string().min(2, "Industry must be at least 2 characters"),
  city: z.string().min(2, "City must be at least 2 characters"),
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

export const updateBusinessSchema = z.object({
  favorited: z.boolean().optional(),
  painPoint: z.string().optional(),
  outreachAngle: z.string().optional(),
  suggestedOffer: z.string().optional(),
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
});

export const generateProposalSchema = z.object({
  businessId: z.string().cuid(),
  monthlyPrice: z.number().int().positive(),
  systemsIncluded: z.array(z.string()),
});

export const generateSuggestionsSchema = z.object({
  businessId: z.string().cuid(),
});

// Proposal
export const createProposalSchema = z.object({
  businessId: z.string().cuid(),
  title: z.string().min(1, "Title is required"),
  packageOverview: z.string().min(1, "Package overview is required"),
  deliverables: z.array(z.string()),
  monthlyPrice: z.number().int().positive(),
  benefits: z.array(z.string()),
  nextSteps: z.string().optional(),
  emailMessage: z.string().optional(),
  systemsIncluded: z.array(z.string()).default([]),
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
