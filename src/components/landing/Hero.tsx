"use client";

import Link from "next/link";
import { LgButton } from "@/components/ui/lg-button";
import { LgBadge } from "@/components/ui/lg-badge";

const STATS = [
  { stat: "$297–$797", label: "avg. monthly deal" },
  { stat: "4 steps", label: "to close a client" },
  { stat: "∞", label: "recurring potential" },
];

const grainSvg =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>\")";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Drifting gradient mesh — full bleed */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: -300,
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.7,
          background: `
            radial-gradient(closest-side at 22% 38%, color-mix(in oklch, var(--accent) 38%, transparent), transparent 100%),
            radial-gradient(closest-side at 80% 22%, color-mix(in oklch, var(--accent) 22%, transparent), transparent 100%),
            radial-gradient(closest-side at 60% 95%, color-mix(in oklch, var(--accent) 14%, transparent), transparent 100%)
          `,
          backgroundRepeat: "no-repeat",
          backgroundSize: "70% 70%, 60% 60%, 80% 80%",
          animation: "lg-mesh-drift 24s ease-in-out infinite",
          filter: "blur(120px) saturate(115%)",
          willChange: "transform",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.4,
          mixBlendMode: "overlay",
          backgroundImage: grainSvg,
        }}
      />

      <div
        className="relative mx-auto"
        style={{
          padding: "96px 32px 80px",
          maxWidth: 1200,
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: 820, position: "relative", zIndex: 1 }}>
          <LgBadge
            tone="accent"
            style={{ marginBottom: 22, animation: "lg-rise-in 0.55s 0.05s both" }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 99,
                background: "var(--accent)",
                boxShadow: "0 0 8px var(--accent)",
                animation: "lg-pulse 2.4s ease-in-out infinite",
              }}
            />
            AI-powered client acquisition for agencies
          </LgBadge>
          <h1
            style={{
              margin: "0 0 24px",
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: "clamp(44px, 6vw, 76px)",
              lineHeight: 1.0,
              letterSpacing: "-0.04em",
              fontWeight: 800,
              color: "var(--text)",
            }}
          >
            <span className="lg-line-mask">
              <span style={{ animationDelay: "0.18s" }}>Build AI systems</span>
            </span>
            <br />
            <span className="lg-line-mask">
              <span style={{ animationDelay: "0.30s" }}>local businesses</span>
            </span>
            <br />
            <span className="lg-line-mask">
              <span style={{ animationDelay: "0.42s" }}>
                will pay&nbsp;
                <span
                  style={{
                    fontStyle: "italic",
                    fontWeight: 600,
                    color: "var(--accent)",
                  }}
                >
                  monthly
                </span>
                &nbsp;for.
              </span>
            </span>
          </h1>
          <p
            style={{
              margin: "0 0 40px",
              fontSize: 19,
              lineHeight: 1.55,
              color: "var(--text-muted)",
              maxWidth: 620,
              animation: "lg-rise-in 0.65s 0.55s both",
            }}
          >
            Find real local businesses with Google Places. Generate custom Lead &amp; Content
            systems with AI. Send polished proposals. Close recurring clients — all in one
            platform.
          </p>
          <div
            className="flex items-center flex-wrap"
            style={{ gap: 12, animation: "lg-rise-in 0.65s 0.7s both" }}
          >
            <Link href="/signup">
              <LgButton variant="primary" size="lg" iconRight="arrow">
                Start building free
              </LgButton>
            </Link>
            <Link href="#how-it-works">
              <LgButton variant="secondary" size="lg" icon="eye">
                See how it works
              </LgButton>
            </Link>
            <span style={{ fontSize: 13, color: "var(--text-subtle)", marginLeft: 8 }}>
              No credit card · Cancel any time
            </span>
          </div>
        </div>

        <div
          className="lg-rise relative grid"
          style={{
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            marginTop: 72,
            paddingTop: 40,
            borderTop: "1px solid var(--border)",
            zIndex: 1,
          }}
        >
          {STATS.map((s) => (
            <div key={s.label}>
              <div
                style={{
                  fontFamily: "var(--font-sans), sans-serif",
                  fontSize: 36,
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  color: "var(--text)",
                }}
              >
                {s.stat}
              </div>
              <div style={{ marginTop: 4, color: "var(--text-muted)", fontSize: 14 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
