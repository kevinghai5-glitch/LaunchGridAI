import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, iconOnly = false, size = "md" }: LogoProps) {
  const sizes = {
    sm: { icon: 24, fs: 14.5 },
    md: { icon: 26, fs: 15.5 },
    lg: { icon: 30, fs: 18 },
  };
  const { icon, fs } = sizes[size];

  return (
    <div className={cn("flex items-center", className)} style={{ gap: 10 }}>
      <div
        aria-label="LaunchGrid OS logo"
        className="relative grid place-items-center"
        style={{
          width: icon,
          height: icon,
          borderRadius: 7,
          background:
            "linear-gradient(140deg, oklch(0.62 0.20 252) 0%, oklch(0.45 0.18 248) 100%)",
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
          LaunchGrid
          <span style={{ color: "var(--text-3)", fontWeight: 500 }}>/OS</span>
        </span>
      )}
    </div>
  );
}
