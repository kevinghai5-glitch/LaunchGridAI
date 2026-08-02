import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  textOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, iconOnly = false, textOnly = false, size = "md" }: LogoProps) {
  const sizes = {
    sm: { icon: 24, fs: 14.5 },
    md: { icon: 26, fs: 15.5 },
    lg: { icon: 30, fs: 18 },
  };
  const { icon, fs } = sizes[size];

  return (
    <div className={cn("flex items-center", className)} style={{ gap: 10 }}>
      {!textOnly && (
        <div
          aria-label="ReclaimedHQ OS logo"
          className="relative grid place-items-center"
          style={{
            width: icon,
            height: icon,
            borderRadius: 7,
            // The theme's own accent gradient, by token — so the brand tile, the
            // buttons and the favicon read as one mark. The literal fallback is
            // the dark block's stops, for any surface where the token is absent.
            // (The favicon at src/app/icon.svg hardcodes the same three stops;
            // change them together.)
            background:
              "var(--lgx-accent-grad, linear-gradient(140deg, #e89478 0%, #d97757 46%, #b05730 100%))",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.3), 0 6px 20px -6px var(--accent-glow)",
          }}
        >
          <svg
            width={icon * 0.54}
            height={icon * 0.54}
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12 L9 12 L9 4 L15 4 L15 20 L21 20 L21 12" />
          </svg>
        </div>
      )}
      {!iconOnly && (
        <span
          className="whitespace-nowrap"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            fontSize: fs,
            color: "var(--text)",
          }}
        >
          ReclaimedHQ
          <span style={{ color: "var(--text-3)", fontWeight: 500 }}>/OS</span>
        </span>
      )}
    </div>
  );
}
