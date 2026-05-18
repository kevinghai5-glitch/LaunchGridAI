export const PRICING_PRESETS = [297, 497, 797] as const;

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    limits: {
      businessSaves: 10,
      generations: 5,
      proposals: 3,
    },
    features: [
      "Up to 10 saved businesses",
      "5 AI system generations",
      "3 proposals",
      "Business finder",
      "Public proposal links",
    ],
  },
  pro: {
    name: "Pro",
    price: 49,
    limits: {
      businessSaves: Infinity,
      generations: Infinity,
      proposals: Infinity,
    },
    features: [
      "Unlimited saved businesses",
      "Unlimited AI generations",
      "Unlimited proposals",
      "Priority AI model",
      "Email proposal delivery",
      "Deals pipeline (Kanban)",
      "Custom pricing presets",
      "Priority support",
    ],
  },
} as const;

export const DEAL_STAGES = [
  { key: "SAVED", label: "Saved", color: "bg-slate-500" },
  { key: "SYSTEMS_GENERATED", label: "Systems Generated", color: "bg-blue-500" },
  { key: "PROPOSAL_SENT", label: "Proposal Sent", color: "bg-yellow-500" },
  { key: "FOLLOW_UP", label: "Follow-Up", color: "bg-orange-500" },
  { key: "WON", label: "Won", color: "bg-green-500" },
  { key: "LOST", label: "Lost", color: "bg-red-500" },
] as const;

export type DealStage = (typeof DEAL_STAGES)[number]["key"];

export const PROPOSAL_STATUSES = [
  { key: "DRAFT", label: "Draft", color: "bg-slate-500" },
  { key: "SENT", label: "Sent", color: "bg-blue-500" },
  { key: "VIEWED", label: "Viewed", color: "bg-yellow-500" },
  { key: "ACCEPTED", label: "Accepted", color: "bg-green-500" },
  { key: "REJECTED", label: "Rejected", color: "bg-red-500" },
] as const;

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
