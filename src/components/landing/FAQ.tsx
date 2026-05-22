"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const ITEMS = [
  {
    q: "Do I need any technical skills to use LaunchGrid?",
    a: "No. If you can search a business name and click a button, you can run LaunchGrid. Everything generates on click — no prompts to write, no integrations to set up.",
  },
  {
    q: "Do the businesses I find need to sign up for anything?",
    a: "No. LaunchGrid pulls public Google Places data. The business owner only interacts with the proposal you send them — a clean, branded link.",
  },
  {
    q: "How do I actually get paid by the businesses?",
    a: "You set up your own payment link (Stripe, Square, ACH — whatever you use). LaunchGrid tracks deal status and MRR; payments live in your stack.",
  },
  {
    q: "What is a Lead System vs a Content System?",
    a: "Lead Systems generate inquiries: a hook, a funnel, follow-up sequences. Content Systems build authority: 30 days of social posts, hooks, and a hashtag strategy.",
  },
  {
    q: "Can I really charge $297–$797/month for this?",
    a: "Yes — agencies have charged these prices for years. The pricing presets are based on what works for one-person agencies serving local businesses.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "You keep access to everything for 30 days after canceling. Export any saved businesses, proposals, or systems as CSV/PDF before that.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section
      id="faq"
      className="mx-auto"
      style={{ padding: "96px 32px", maxWidth: 880 }}
    >
      <div style={{ marginBottom: 40 }}>
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
          FAQ
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
          Common questions.
        </h2>
      </div>
      <div
        className="flex flex-col"
        style={{ gap: 0, borderTop: "1px solid var(--border)" }}
      >
        {ITEMS.map((it, i) => (
          <div key={i} style={{ borderBottom: "1px solid var(--border)" }}>
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              className="w-full flex justify-between items-center text-left cursor-pointer"
              style={{
                padding: "20px 4px",
                background: "transparent",
                border: "none",
                fontSize: 16.5,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "var(--text)",
                fontFamily: "inherit",
              }}
            >
              {it.q}
              <ChevronDown
                size={18}
                strokeWidth={1.75}
                style={{
                  transition: "transform 0.2s",
                  transform: open === i ? "rotate(180deg)" : "none",
                  color: "var(--text-muted)",
                }}
              />
            </button>
            {open === i && (
              <div
                className="lg-fade-in"
                style={{
                  padding: "0 4px 24px",
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: "var(--text-muted)",
                }}
              >
                {it.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
