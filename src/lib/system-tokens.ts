// "Streamed" system output tokens — used by AI Studio for the streaming animation.
// These are designed to look like a real generation; wiring to the backend route
// (`/api/generate/lead`, `/api/generate/content`) can replace this later.

export type StreamToken =
  | { kind: "h1"; text: string }
  | { kind: "subtitle"; text: string }
  | { kind: "section"; text: string }
  | { kind: "p"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "li"; text: string }
  | { kind: "done" };

interface BusinessLike {
  name: string;
  industry: string;
  city: string;
  reviewCount?: number | null;
}

export function buildLeadSystemTokens(business: BusinessLike): StreamToken[] {
  const name = business.name;
  const ind = (business.industry || "business").toLowerCase();
  const cityFull = business.city || "your city";
  const city = cityFull.split(",")[0];
  const reviews = business.reviewCount ?? 200;

  const headline = ind.includes("dental")
    ? `The ${city} dental practice ${reviews}+ neighbors trust with their family's smile.`
    : ind.includes("hvac")
    ? `${city}'s most reliable HVAC team — same-day diagnosis, fair pricing, no surprise charges.`
    : ind.includes("spa")
    ? `${city}'s most-loved escape. Award-winning wellness, booked weeks out — for a reason.`
    : ind.includes("gym")
    ? `${city}'s strongest community. Real coaches. Real progress. Real results in 90 days.`
    : `${city}'s ${ind} that locals actually recommend.`;

  return [
    { kind: "h1", text: "Lead Capture System" },
    { kind: "subtitle", text: `Custom-built for ${name} · ${cityFull}` },
    { kind: "section", text: "01 — Offer Positioning" },
    {
      kind: "p",
      text: `Position ${name} as the go-to ${ind} in ${city} for clients who want a high-trust, results-first experience. Lean into the 5-star reputation (${reviews} reviews) to bypass the price-shopper segment entirely.`,
    },
    { kind: "section", text: "02 — Compelling Headline" },
    { kind: "quote", text: headline },
    { kind: "section", text: "03 — Qualifying Questions" },
    { kind: "li", text: `What's the #1 thing you want to solve in the next 30 days?` },
    { kind: "li", text: `Have you worked with a ${ind} in ${city} before?` },
    { kind: "li", text: `What's your ideal timeline — this week, this month, just exploring?` },
    { kind: "li", text: `What's your phone number so we can confirm your appointment?` },
    { kind: "section", text: "04 — Booking CTA" },
    {
      kind: "p",
      text: `Single primary button: "Claim Your Spot — ${city}". Routes directly into Calendly/booking page. No friction. No second form.`,
    },
    { kind: "section", text: "05 — 5-Day Follow-Up Sequence" },
    {
      kind: "li",
      text: `Day 0 (SMS, 5 min after submit): "Hi {name}, this is the team at ${name}. We saw your inquiry and held a spot for you. Reply YES to confirm."`,
    },
    { kind: "li", text: `Day 1 (Email): Social proof — 3 short reviews from real ${city} clients with photos.` },
    { kind: "li", text: `Day 2 (SMS): A simple "still open?" check-in. Friendly. Human.` },
    { kind: "li", text: `Day 4 (Email): Local angle — "Why ${city} families choose us." Owner story, 90 seconds to read.` },
    { kind: "li", text: `Day 5 (SMS): Soft close — "Want us to lock in your spot or save it for later?"` },
    { kind: "section", text: "06 — Owner Strategy Note" },
    {
      kind: "p",
      text: `Reply within 4 minutes during business hours. Inbound leads cool fast — speed beats polish. Pair this funnel with $300–$500/mo in geo-targeted Meta ads for predictable monthly inflow.`,
    },
    { kind: "done" },
  ];
}

export function buildContentSystemTokens(business: BusinessLike): StreamToken[] {
  const name = business.name;
  const cityFull = business.city || "your city";
  const city = cityFull.split(",")[0];
  const ind = (business.industry || "business").toLowerCase();
  const days = [
    { d: "Mon", post: "Behind-the-scenes — what the morning looks like before doors open." },
    { d: "Tue", post: "Client transformation — before/after carousel + caption story." },
    { d: "Wed", post: `Local angle — "${city} hidden gems we love" (community love post).` },
    { d: "Thu", post: "Quick-tip Reel — 30s answer to the top question new clients ask." },
    { d: "Fri", post: "Team spotlight — meet a staff member, their why, their favorite service." },
    { d: "Sat", post: "User-generated content reshare + thank-you tag." },
    { d: "Sun", post: "Inspirational/aspirational post — outcome the brand stands for." },
  ];
  return [
    { kind: "h1", text: "30-Day Content System" },
    { kind: "subtitle", text: `Custom-built for ${name} · ${cityFull}` },
    { kind: "section", text: "Content Pillars" },
    { kind: "li", text: `Authority — proof of expertise specific to ${ind}.` },
    { kind: "li", text: `Community — ${city}-specific moments, partnerships, customer love.` },
    { kind: "li", text: `Education — quick wins, common questions, myth-busting.` },
    { kind: "li", text: `Personality — the team behind the brand. Trust > polish.` },
    { kind: "section", text: "Weekly Rhythm" },
    ...days.map<StreamToken>((d) => ({ kind: "li", text: `${d.d} — ${d.post}` })),
    { kind: "section", text: "Hook Bank (10 short-form openers)" },
    { kind: "li", text: `"If you've ever Googled ${ind} in ${city}, watch this."` },
    { kind: "li", text: `"3 things our ${ind} clients wish they knew sooner."` },
    { kind: "li", text: `"This is the #1 mistake we see in ${city} every week."` },
    { kind: "li", text: `"POV: it's your first appointment at ${name}."` },
    {
      kind: "li",
      text: `"We tracked 100 clients. Here's what changed for the ones who stayed 90 days."`,
    },
    { kind: "section", text: "Hashtag Strategy" },
    {
      kind: "p",
      text: `Local: #${city.replace(/\s+/g, "")} #${city.replace(/\s+/g, "")}Local · Niche: #${ind.replace(/\s+/g, "")} · Trust: #SmallBusinessLove. Rotate 6–8 per post, never the same set twice.`,
    },
    { kind: "done" },
  ];
}
