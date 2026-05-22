import { Check } from "lucide-react";
import { LgBadge } from "@/components/ui/lg-badge";

const OUTPUTS = [
  {
    eyebrow: "Lead System",
    t: "Lead Capture System",
    d: "A complete lead generation funnel custom-built for each business.",
    points: [
      "Compelling headline & sub-headline",
      "Qualification questions that filter leads",
      "Booking CTA optimized for conversion",
      "5-day follow-up email/SMS sequence",
      "Offer positioning & business strategy",
    ],
  },
  {
    eyebrow: "Content System",
    t: "30-Day Content Plan",
    d: "A 30-day social content plan that builds authority and drives local traffic.",
    points: [
      "Core content pillars for the business",
      "30-day day-by-day posting plan",
      "Short-form hooks for Reels/TikTok",
      "Local angle ideas for community reach",
      "Hashtag strategy for each post",
    ],
  },
  {
    eyebrow: "Proposals",
    t: "Professional Proposals",
    d: "Polished proposals that close at premium prices — sent in minutes.",
    points: [
      "Custom package title & overview",
      "Detailed deliverables list",
      "Benefit statements that sell value",
      "Clear next steps & pricing",
      "Shareable public link + email delivery",
    ],
  },
];

export function WhatWeGenerate() {
  return (
    <section
      className="mx-auto"
      style={{ padding: "96px 32px", maxWidth: 1200 }}
    >
      <div style={{ maxWidth: 720, marginBottom: 48 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 10,
          }}
        >
          What LaunchGrid generates
        </div>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: "var(--text)",
          }}
        >
          Everything you need to land the deal.
        </h2>
        <p
          style={{
            marginTop: 18,
            fontSize: 17,
            lineHeight: 1.5,
            color: "var(--text-muted)",
          }}
        >
          Three output types. Each one AI-generated with the actual business name, industry, and
          city — so it feels hand-crafted.
        </p>
      </div>
      <div
        className="lg-rise grid"
        style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
      >
        {OUTPUTS.map((o) => (
          <div
            key={o.t}
            className="lg-hover-lift"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: 28,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <LgBadge tone="accent">{o.eyebrow}</LgBadge>
            <h3
              style={{
                margin: "16px 0 8px",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--text)",
              }}
            >
              {o.t}
            </h3>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--text-muted)",
              }}
            >
              {o.d}
            </p>
            <ul
              className="flex flex-col"
              style={{ margin: 0, padding: 0, listStyle: "none", gap: 10 }}
            >
              {o.points.map((p) => (
                <li
                  key={p}
                  className="flex"
                  style={{
                    gap: 10,
                    fontSize: 13.5,
                    lineHeight: 1.45,
                    color: "var(--text)",
                  }}
                >
                  <span
                    className="grid place-items-center"
                    style={{
                      flex: "none",
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      marginTop: 1,
                    }}
                  >
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
