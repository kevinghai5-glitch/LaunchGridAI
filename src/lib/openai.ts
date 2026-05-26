import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

export const DEFAULT_MODEL = "gpt-4o-mini";

// Premium, multi-section consulting deliverables (the Growth Asset Pack) need a
// stronger model than the lightweight suggestion/proposal tasks. Override via
// env without a code change if needed.
export const ASSET_MODEL = process.env.OPENAI_ASSET_MODEL ?? "gpt-4o";
