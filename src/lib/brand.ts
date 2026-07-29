// Brand / offer configuration for the deliverable engine.
//
// The deliverables sell a two-part offer:
//   · a ONE-TIME done-for-you setup — the four deliverables plus the system we
//     build for the client, and
//   · a MONTHLY retainer — the named product below qualifying every lead, us
//     running and tuning the live system, and the monthly report.
// The product is retainer-only; it is never part of the one-time build. (The two
// prices themselves live in constants.ts — SETUP_FEE_CAD / MONTHLY_RETAINER_CAD.)
//
// These values are referenced by the generation prompts (so the copy names the
// product and frames work as done-for-you) and by the renderers (owner tags,
// footers). Overridable per environment without a code change.

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
// leads they already pay for into booked customers.
//
// TWO THINGS THIS BLOCK EXISTS TO PREVENT, both of which used to leak into the
// generated copy:
//   1. "a prettier website" — it is not a redesign, and we do not build, rebuild,
//      host, or edit their site. Site findings are ADVISORY: a recommendation they
//      hand to whoever runs the site. The one page WE build is their booking page.
//   2. "here is the plan, go implement it" — that was the previous business model.
//      This is done-for-you: we build the system and we run it. The client
//      implements nothing.
//
// Deliberately does NOT name the platform we build on. This same block is dropped
// into the free cold-audit prompt, which is a pre-pitch document — naming the
// vendor there would put the sale in a report that is supposed to just be useful.
//
// Drop this block into a prompt to force the model to hold the frame.
export const SYSTEM_FRAMING = `POSITIONING — SYMPTOM vs SYSTEM (hold this through everything you write):
- The visible, on-the-page problem you name (a buried booking link, a weak hero, a slow mobile page, no way to book) is only the SYMPTOM — the place where the leak is visible. It is NOT the thing being sold.
- What is actually built and paid for is the behind-the-scenes ACQUISITION SYSTEM: instant lead response, lead qualification, follow-up automation, booking + reminders, and the CRM that runs it. That system is the product.
- WE build that system and WE run it. It is done-for-you from end to end: the client approves copy, shows up to the calls it books, and implements nothing. NEVER write a sentence that hands work to the reader's team, hands over a strategy or plan for someone else to execute, or assumes they have a developer, a marketing team, or an agency to pass this to.
- This is NOT a website redesign, a "new look", or a cosmetic refresh. Never imply the deliverable is a prettier site. We do not build, rebuild, host, or edit their website: anything you say about their existing site is ADVISORY — an observation and a recommendation they can pass to whoever runs it — and must never be written as something we are going to change.
- The ONE page we build for them is their booking page, which we build and run ourselves. When a visible fix has to live somewhere a customer can see it, that page is where it lands.
- Frame every visible fix as the surface of a deeper system fix. The mental model to leave the reader with: "You don't have a design problem, you have a leak problem — the design is just where you can see it dripping."`;
