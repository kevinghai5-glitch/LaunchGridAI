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

// SYMPTOM-vs-SYSTEM positioning — the single most important frame, carried through
// every client-facing surface (cold audit, proposal, asset pack, leak narratives).
//
// The visible, on-the-page problem we name during outreach (the "leak" — a buried
// booking link, a weak hero, a slow mobile page) is only the SYMPTOM: the visible
// spot where revenue is already dripping out. What we actually build and charge for
// is the behind-the-scenes customer-acquisition SYSTEM — instant lead response,
// qualification, follow-up automation, booking, reminders, CRM — that turns the
// leads they already pay for into booked customers. It is NOT a website redesign.
// Any page we touch is only the surface where a system fix becomes visible.
//
// Drop this block into a prompt to force the model to hold the frame.
export const SYSTEM_FRAMING = `POSITIONING — SYMPTOM vs SYSTEM (hold this through everything you write):
- The visible, on-the-page problem you name (a buried booking link, a weak hero, a slow mobile page, no way to book) is only the SYMPTOM — the place where the leak is visible. It is NOT the thing being sold.
- What is actually built and paid for is the behind-the-scenes ACQUISITION SYSTEM: instant lead response, lead qualification, follow-up automation, booking + reminders, and the CRM that runs it. That system is the product.
- This is NOT a website redesign, a "new look", or a cosmetic refresh. Never imply the deliverable is a prettier site. A page only ever changes because a SYSTEM fix has to show up somewhere the visitor can see it.
- Frame every visible fix as the surface of a deeper system fix. The mental model to leave the reader with: "You don't have a design problem, you have a leak problem — the design is just where you can see it dripping."`;
