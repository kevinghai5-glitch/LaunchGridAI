import { Search, Sparkles, FileText, LineChart, type LucideIcon } from "lucide-react";

const STEPS: { n: string; t: string; d: string; Icon: LucideIcon }[] = [
  {
    n: "01",
    t: "Find Real Businesses",
    d: "Search any industry in any city. LaunchGrid pulls real businesses from Google Places with ratings, contact info, and location data — no fake leads.",
    Icon: Search,
  },
  {
    n: "02",
    t: "Generate AI Systems",
    d: "One click generates a full Lead Capture system or 30-day Content Calendar — custom-written for each business's name, industry, and city.",
    Icon: Sparkles,
  },
  {
    n: "03",
    t: "Send Professional Proposals",
    d: "Build polished proposals with pricing presets ($297, $497, $797/mo). Share a public link or email directly to the business owner.",
    Icon: FileText,
  },
  {
    n: "04",
    t: "Close & Track Deals",
    d: "Manage your pipeline in the deals Kanban. Track MRR as deals move from Saved → Won. Build a real monthly recurring business.",
    Icon: LineChart,
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      style={{
        padding: "80px 32px",
        background: "var(--sidebar)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
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
            Simple process
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
            Four steps to your first recurring client.
          </h2>
        </div>
        <div
          className="lg-rise grid"
          style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}
        >
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="lg-hover-lift relative"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 24,
              }}
            >
              <div className="flex justify-between items-start" style={{ marginBottom: 32 }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 12,
                    color: "var(--text-subtle)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {s.n}
                </div>
                <div
                  className="grid place-items-center"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                  }}
                >
                  <s.Icon size={16} strokeWidth={1.75} />
                </div>
              </div>
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: 16.5,
                  fontWeight: 700,
                  letterSpacing: "-0.015em",
                  color: "var(--text)",
                }}
              >
                {s.t}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: "var(--text-muted)",
                }}
              >
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
