// Pipeline stage configuration — maps DB stage codes to display labels & visual treatment.

export type DealStage =
  | "SAVED"
  | "SYSTEMS_GENERATED"
  | "PROPOSAL_SENT"
  | "FOLLOW_UP"
  | "WON"
  | "LOST";

export interface StageDef {
  id: DealStage;
  label: string;
  hint: string;
  tone: "neutral" | "accent" | "success" | "danger";
}

export const STAGES: StageDef[] = [
  { id: "SAVED", label: "Saved", hint: "Not yet contacted", tone: "neutral" },
  { id: "SYSTEMS_GENERATED", label: "Systems Ready", hint: "AI systems generated", tone: "accent" },
  { id: "PROPOSAL_SENT", label: "Proposal Sent", hint: "Awaiting response", tone: "accent" },
  { id: "FOLLOW_UP", label: "Negotiating", hint: "Active conversation", tone: "accent" },
  { id: "WON", label: "Won", hint: "Closed monthly", tone: "success" },
];

// Stages used for pipeline display (excludes LOST). LOST is filtered out by default.
export const PIPELINE_STAGES = STAGES;
