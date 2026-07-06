import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
  // The asset pack fires many calls in close succession and routinely brushes
  // the org's tokens-per-minute ceiling. Let the SDK transparently retry 429s
  // (it honors the Retry-After header) so a momentary cap doesn't fail the run.
  maxRetries: 6,
});

export const DEFAULT_MODEL = "gpt-4o-mini";

// The Growth Asset Pack fires nine deliverable calls. On this account gpt-4o is
// capped at 30k tokens/minute, so nine large gpt-4o calls can't run together and
// the pack took minutes (throttled). gpt-4o-mini has a far higher TPM ceiling, so
// all nine run in parallel and the pack finishes in ~30s — and the elaborate
// prompts + HTML design system carry the premium quality. If you raise this
// account's gpt-4o rate limit, set OPENAI_ASSET_MODEL=gpt-4o to switch back.
export const ASSET_MODEL = process.env.OPENAI_ASSET_MODEL ?? "gpt-4o-mini";
