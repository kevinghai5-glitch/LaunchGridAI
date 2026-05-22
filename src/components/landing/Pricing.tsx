import Link from "next/link";
import { Check } from "lucide-react";
import { LgButton } from "@/components/ui/lg-button";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    sub: "Forever free",
    popular: false,
    features: [
      "Up to 10 saved businesses",
      "5 AI system generations",
      "3 proposals",
      "Business finder",
      "Public proposal links",
    ],
  },
  {
    name: "Pro",
    price: "$49",
    sub: "Billed monthly · cancel any time",
    popular: true,
    features: [
      "Unlimited saved businesses",
      "Unlimited AI generations",
      "Unlimited proposals",
      "Priority AI model",
      "Email proposal delivery",
      "Deals pipeline (Kanban)",
      "Custom pricing presets",
      "Priority support",
    ],
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      className="mx-auto"
      style={{ padding: "96px 32px", maxWidth: 1200 }}
    >
      <div className="text-center mx-auto" style={{ maxWidth: 600, marginBottom: 48 }}>
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
          Simple pricing
        </div>
        <h2
          style={{
            margin: "0 0 16px",
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: "var(--text)",
          }}
        >
          Start free. Scale when it works.
        </h2>
        <p style={{ margin: 0, fontSize: 17, color: "var(--text-muted)" }}>
          No contracts. Cancel any time. One Pro plan, that&apos;s it.
        </p>
      </div>
      <div
        className="grid mx-auto"
        style={{ gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 880 }}
      >
        {PLANS.map((p) => (
          <div
            key={p.name}
            className="relative"
            style={{
              background: "var(--surface)",
              border: p.popular ? "1.5px solid var(--accent)" : "1px solid var(--border)",
              borderRadius: "var(--radius-xl)",
              padding: 32,
              boxShadow: p.popular ? "var(--shadow-lg)" : "var(--shadow-sm)",
            }}
          >
            {p.popular && (
              <div
                style={{
                  position: "absolute",
                  top: -12,
                  left: 32,
                  padding: "4px 12px",
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  background: "var(--accent)",
                  color: "var(--accent-text)",
                  borderRadius: 999,
                }}
              >
                Most popular
              </div>
            )}
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
              {p.name}
            </h3>
            <div className="flex items-baseline" style={{ marginTop: 18, gap: 8 }}>
              <span
                style={{
                  fontFamily: "var(--font-sans), sans-serif",
                  fontSize: 48,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "var(--text)",
                }}
              >
                {p.price}
              </span>
              {p.name === "Pro" && (
                <span style={{ color: "var(--text-muted)", fontSize: 15 }}>/month</span>
              )}
            </div>
            <p
              style={{
                margin: "6px 0 24px",
                fontSize: 13.5,
                color: "var(--text-muted)",
              }}
            >
              {p.sub}
            </p>
            <ul
              className="flex flex-col"
              style={{ margin: "0 0 28px", padding: 0, listStyle: "none", gap: 10 }}
            >
              {p.features.map((f) => (
                <li
                  key={f}
                  className="flex"
                  style={{ gap: 10, fontSize: 13.5, color: "var(--text)" }}
                >
                  <Check
                    size={16}
                    strokeWidth={2.5}
                    style={{ color: "var(--accent)", marginTop: 1, flex: "none" }}
                  />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/signup" style={{ display: "block" }}>
              <LgButton
                variant={p.popular ? "primary" : "secondary"}
                size="lg"
                style={{ width: "100%" }}
              >
                {p.popular ? "Start with Pro" : "Get started free"}
              </LgButton>
            </Link>
          </div>
        ))}
      </div>
      <p
        className="text-center"
        style={{ marginTop: 32, color: "var(--text-subtle)", fontSize: 14 }}
      >
        One Pro client covers 6+ months of LaunchGrid.
      </p>
    </section>
  );
}
