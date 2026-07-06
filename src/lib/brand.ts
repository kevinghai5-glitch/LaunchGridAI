// Brand / offer configuration for the deliverable engine.
//
// The deliverables sell a two-part offer: a one-time done-for-you setup and a
// monthly qualification retainer powered by a named product. These values are
// referenced by the generation prompts (so the copy names the product and frames
// work as done-for-you) and by the renderers (owner tags, footers). Overridable
// per environment without a code change.

export const PRODUCT_NAME = process.env.DELIVERABLE_PRODUCT_NAME?.trim() || "LeadGate";

// How the provider refers to itself in client-facing copy ("Deployed by us",
// "our team handles…"). Kept generic by default.
export const AGENCY_NAME = process.env.DELIVERABLE_AGENCY_NAME?.trim() || "our team";

// Canonical owner labels used across deliverables (Law 3 — done-for-you framing).
export const OWNER_US = "Deployed by us";
export const OWNER_YOU = "You (owner)";
