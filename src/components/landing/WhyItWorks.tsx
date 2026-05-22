const ITEMS = [
  {
    t: "Recurring revenue",
    d: "One client at $497/mo = $5,964/year. Stack 10 clients and you have a real $60K/year business. LaunchGrid is built for MRR, not one-time payments.",
  },
  {
    t: "Simple offers",
    d: 'Local businesses understand "I\'ll build you a system that brings in more leads." No complex agency decks — just simple, outcome-based offers.',
  },
  {
    t: "Fast deployment",
    d: "Generate a full Lead or Content system in under 60 seconds. Send a proposal in 5 minutes. Get a decision same day. Speed is your edge.",
  },
  {
    t: "Local businesses need this",
    d: "Most local businesses have no digital systems. They spend money on ads but have no follow-up, no content, no lead capture. You solve a real problem.",
  },
];

export function WhyItWorks() {
  return (
    <section
      style={{
        background: "var(--sidebar)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        padding: "80px 32px",
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 1200 }}>
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
            Why it works
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
            The business model is already proven.
          </h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {ITEMS.map((i) => (
            <div
              key={i.t}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 28,
              }}
            >
              <h3
                style={{
                  margin: "0 0 10px",
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "-0.015em",
                  color: "var(--text)",
                }}
              >
                {i.t}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  color: "var(--text-muted)",
                }}
              >
                {i.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
