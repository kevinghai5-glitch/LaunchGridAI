import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, iconOnly = false, size = "md" }: LogoProps) {
  const sizes = {
    sm: { icon: 20, text: "text-[15px]" },
    md: { icon: 22, text: "text-[15px]" },
    lg: { icon: 28, text: "text-lg" },
  };
  const { icon, text } = sizes[size];

  return (
    <div className={cn("flex items-center gap-[9px]", className)}>
      <div
        aria-label="LaunchGrid AI logo"
        className="relative grid place-items-center rounded-[6px]"
        style={{
          width: icon,
          height: icon,
          background:
            "linear-gradient(135deg, var(--accent) 0%, color-mix(in oklch, var(--accent) 70%, black) 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)",
        }}
      >
        <div
          style={{
            width: icon * 0.45,
            height: icon * 0.45,
            borderRadius: 2,
            background: "var(--accent-text)",
            opacity: 0.92,
            clipPath:
              "polygon(0 0, 100% 0, 100% 45%, 45% 45%, 45% 100%, 0 100%)",
          }}
        />
      </div>
      {!iconOnly && (
        <span
          className={cn("font-bold whitespace-nowrap text-[var(--text)]", text)}
          style={{
            fontFamily: "var(--font-sans), sans-serif",
            letterSpacing: "-0.02em",
          }}
        >
          LaunchGrid<span className="text-[var(--accent)]"> AI</span>
        </span>
      )}
    </div>
  );
}
