import { Check, Zap } from "lucide-react";

interface PublicProposalProps {
  business: { name: string; industry: string | null; city: string | null; rating?: number | null; reviewCount?: number | null };
  title: string;
  overview: string;
  price: number;
  deliverables: string[];
  mobile?: boolean;
}

export function PublicProposal({
  business,
  title,
  overview,
  price,
  deliverables,
  mobile,
}: PublicProposalProps) {
  const pad = mobile ? 18 : 40;
  const titleSize = mobile ? 22 : 34;
  const sectionTitleSize = mobile ? 14 : 17;
  return (
    <div style={{ background: "var(--surface)", minHeight: "100%" }}>
      <div
        className="flex items-center justify-between"
        style={{
          background: "var(--text)",
          color: "var(--bg)",
          padding: `${mobile ? 16 : 22}px ${pad}px`,
        }}
      >
        <div className="flex items-center" style={{ gap: 8 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              background: "var(--accent)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 4,
                background: "var(--bg)",
                opacity: 0.92,
                clipPath: "polygon(0 0, 100% 0, 100% 45%, 45% 45%, 45% 100%, 0 100%)",
                borderRadius: 1,
              }}
            />
          </div>
          <span
            style={{
              fontSize: mobile ? 11 : 12.5,
              fontWeight: 600,
              letterSpacing: "-0.005em",
            }}
          >
            Prepared by LaunchGrid AI
          </span>
        </div>
        <span
          style={{
            fontSize: mobile ? 10 : 11.5,
            opacity: 0.6,
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      <div style={{ padding: `${mobile ? 28 : 56}px ${pad}px ${mobile ? 18 : 32}px` }}>
        <div
          style={{
            fontSize: mobile ? 10.5 : 12,
            fontWeight: 700,
            color: "var(--accent)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: mobile ? 10 : 14,
          }}
        >
          Monthly proposal · {business.industry ?? "Business"}
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "var(--text)",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: `${mobile ? 12 : 20}px 0 0`,
            fontSize: mobile ? 13 : 16,
            lineHeight: 1.55,
            color: "var(--text-muted)",
            maxWidth: mobile ? "100%" : 520,
          }}
        >
          {overview}
        </p>
      </div>

      <div style={{ padding: `0 ${pad}px ${mobile ? 18 : 32}px` }}>
        <div
          className="flex items-center justify-between"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid color-mix(in oklch, var(--accent) 25%, transparent)",
            borderRadius: "var(--radius-lg)",
            padding: mobile ? 16 : 24,
          }}
        >
          <div>
            <div
              style={{
                fontSize: mobile ? 10.5 : 12,
                fontWeight: 700,
                color: "var(--accent)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Investment
            </div>
            <div
              className="flex items-baseline"
              style={{ gap: 6, marginTop: 4 }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans), sans-serif",
                  fontSize: mobile ? 28 : 42,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "var(--text)",
                }}
              >
                ${price}
              </span>
              <span style={{ fontSize: mobile ? 12 : 14, color: "var(--text-muted)" }}>
                / month
              </span>
            </div>
            <div
              style={{
                fontSize: mobile ? 11 : 12.5,
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              Cancel any time. First report in 30 days.
            </div>
          </div>
          {!mobile && (
            <button
              className="cursor-pointer"
              style={{
                background: "var(--accent)",
                color: "var(--accent-text)",
                border: "1px solid var(--accent)",
                borderRadius: "var(--radius)",
                padding: "0 18px",
                height: 44,
                fontSize: 14.5,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              Accept &amp; book kickoff →
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: `${mobile ? 16 : 24}px ${pad}px ${mobile ? 16 : 32}px` }}>
        <h2
          style={{
            margin: "0 0 14px",
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: sectionTitleSize,
            fontWeight: 700,
            letterSpacing: "-0.018em",
            color: "var(--text)",
          }}
        >
          What you&apos;ll get
        </h2>
        <div className="flex flex-col" style={{ gap: mobile ? 10 : 12 }}>
          {deliverables.map((d, i) => (
            <div key={i} className="flex items-start" style={{ gap: 12 }}>
              <div
                className="grid place-items-center flex-none"
                style={{
                  width: mobile ? 20 : 22,
                  height: mobile ? 20 : 22,
                  borderRadius: 99,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  marginTop: 1,
                }}
              >
                <Check size={mobile ? 11 : 12} strokeWidth={2.5} />
              </div>
              <span
                style={{
                  fontSize: mobile ? 13 : 14.5,
                  lineHeight: 1.5,
                  color: "var(--text)",
                }}
              >
                {d}
              </span>
            </div>
          ))}
        </div>
      </div>

      {!mobile && (
        <div style={{ padding: `8px ${pad}px 32px` }}>
          <div
            style={{
              background: "var(--surface-active)",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              border: "1px solid var(--border)",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontFamily: "var(--font-sans), sans-serif",
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "-0.015em",
                color: "var(--text)",
              }}
            >
              Why this works for you
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--text-muted)",
              }}
            >
              You&apos;re already trusted: {business.reviewCount ?? 200} 5-star reviews and a{" "}
              {(business.rating ?? 4.8).toFixed(1)} rating in {business.city ?? "your city"}.
              What&apos;s missing is a system that captures the inquiries you&apos;re losing between
              calls. This proposal builds that system — and runs it for you every month.
            </p>
          </div>
        </div>
      )}

      <div style={{ padding: `${mobile ? 16 : 8}px ${pad}px ${mobile ? 28 : 56}px` }}>
        <h2
          style={{
            margin: "0 0 12px",
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: sectionTitleSize,
            fontWeight: 700,
            letterSpacing: "-0.018em",
            color: "var(--text)",
          }}
        >
          Next steps
        </h2>
        <ol
          className="flex flex-col"
          style={{ margin: 0, padding: 0, listStyle: "none", gap: mobile ? 8 : 10 }}
        >
          {[
            "Accept this proposal",
            "Book a 20-min kickoff call",
            "We deliver your system in 5 business days",
          ].map((s, i) => (
            <li
              key={i}
              className="flex items-center"
              style={{
                gap: 12,
                padding: mobile ? "10px 12px" : "12px 14px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
              }}
            >
              <span
                className="grid place-items-center flex-none"
                style={{
                  width: mobile ? 22 : 26,
                  height: mobile ? 22 : 26,
                  borderRadius: 99,
                  background: "var(--text)",
                  color: "var(--bg)",
                  fontSize: mobile ? 11 : 12,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: mobile ? 13 : 14.5, fontWeight: 500, color: "var(--text)" }}>
                {s}
              </span>
            </li>
          ))}
        </ol>
        {mobile && (
          <button
            className="cursor-pointer w-full"
            style={{
              marginTop: 14,
              padding: 12,
              background: "var(--accent)",
              color: "var(--accent-text)",
              border: "none",
              borderRadius: "var(--radius)",
              fontFamily: "inherit",
              fontSize: 13.5,
              fontWeight: 700,
            }}
          >
            Accept &amp; book kickoff
          </button>
        )}
      </div>
    </div>
  );
}

export function BrowserFrame({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div
        className="flex items-center"
        style={{
          height: 36,
          background: "var(--sidebar)",
          borderBottom: "1px solid var(--border)",
          padding: "0 14px",
          gap: 10,
        }}
      >
        <div className="flex" style={{ gap: 6 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div
              key={c}
              style={{ width: 11, height: 11, borderRadius: 99, background: c, opacity: 0.85 }}
            />
          ))}
        </div>
        <div
          className="flex items-center"
          style={{
            flex: 1,
            height: 22,
            borderRadius: 6,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "0 10px",
            gap: 8,
            marginLeft: 12,
          }}
        >
          <Zap size={11} strokeWidth={1.75} style={{ color: "var(--success)" }} />
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono), monospace",
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {url}
          </span>
        </div>
      </div>
      <div style={{ height: 720, overflowY: "auto", background: "var(--bg)" }}>{children}</div>
    </div>
  );
}

export function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 280,
        borderRadius: 32,
        padding: 8,
        background: "linear-gradient(165deg, #1a1714 0%, #29251f 100%)",
        boxShadow: "var(--shadow-xl)",
      }}
    >
      <div
        className="relative"
        style={{
          width: "100%",
          height: 540,
          borderRadius: 24,
          overflow: "hidden",
          background: "var(--bg)",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 28,
            padding: "0 18px",
            fontSize: 10.5,
            fontWeight: 700,
            color: "var(--text)",
            background: "color-mix(in oklch, var(--bg) 90%, transparent)",
            zIndex: 5,
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          <span>9:41</span>
          <div style={{ width: 60, height: 14, borderRadius: 99, background: "#1a1714" }} />
          <span>100%</span>
        </div>
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 0,
            right: 0,
            bottom: 0,
            overflowY: "auto",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
