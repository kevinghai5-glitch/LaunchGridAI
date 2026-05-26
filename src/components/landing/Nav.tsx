"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LgButton } from "@/components/ui/lg-button";

const LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function Nav() {
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        backdropFilter: "blur(14px)",
        background: "color-mix(in oklch, var(--bg) 80%, transparent)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        className="mx-auto flex items-center justify-between"
        style={{ maxWidth: 1200, height: 64, padding: "0 32px" }}
      >
        <Link href="/" aria-label="LaunchGrid AI home">
          <Logo />
        </Link>
        <nav className="flex items-center" style={{ gap: 32 }}>
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hover:text-[var(--text)] transition-colors"
              style={{
                color: "var(--text-muted)",
                fontSize: 13.5,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center" style={{ gap: 8 }}>
          <Link href="/login">
            <LgButton variant="ghost">Log in</LgButton>
          </Link>
          <Link href="/signup">
            <LgButton variant="primary" iconRight="arrow">
              Start building
            </LgButton>
          </Link>
        </div>
      </div>
    </header>
  );
}
