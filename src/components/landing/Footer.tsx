import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        padding: "48px 32px",
        background: "var(--sidebar)",
      }}
    >
      <div
        className="mx-auto flex justify-between items-center flex-wrap"
        style={{ maxWidth: 1200, gap: 24 }}
      >
        <div>
          <Logo />
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13.5,
              color: "var(--text-muted)",
            }}
          >
            Find businesses. Generate AI systems. Send proposals. Get paid monthly.
          </p>
        </div>
        <div
          className="flex"
          style={{ gap: 24, fontSize: 13.5, color: "var(--text-muted)" }}
        >
          <a href="#how-it-works" style={{ color: "inherit", textDecoration: "none" }}>
            How it works
          </a>
          <a href="#pricing" style={{ color: "inherit", textDecoration: "none" }}>
            Pricing
          </a>
          <a href="#faq" style={{ color: "inherit", textDecoration: "none" }}>
            FAQ
          </a>
        </div>
      </div>
      <div
        className="mx-auto"
        style={{
          maxWidth: 1200,
          margin: "32px auto 0",
          paddingTop: 24,
          borderTop: "1px solid var(--border)",
          fontSize: 12.5,
          color: "var(--text-subtle)",
        }}
      >
        © 2026 LaunchGrid AI. All rights reserved.
      </div>
    </footer>
  );
}
