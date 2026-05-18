import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, iconOnly = false, size = "md" }: LogoProps) {
  const sizes = {
    sm: { icon: 24, text: "text-base" },
    md: { icon: 32, text: "text-xl" },
    lg: { icon: 40, text: "text-2xl" },
  };

  const { icon, text } = sizes[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* Geometric LG mark */}
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="LaunchGrid AI logo"
        className="shrink-0"
      >
        {/* Background square with rounded corners */}
        <rect width="32" height="32" rx="8" fill="#1D4ED8" />
        {/* Grid dots pattern */}
        <circle cx="8" cy="8" r="1.5" fill="white" opacity="0.4" />
        <circle cx="16" cy="8" r="1.5" fill="white" opacity="0.4" />
        <circle cx="24" cy="8" r="1.5" fill="white" opacity="0.4" />
        <circle cx="8" cy="16" r="1.5" fill="white" opacity="0.4" />
        <circle cx="16" cy="16" r="1.5" fill="white" opacity="0.8" />
        <circle cx="24" cy="16" r="1.5" fill="white" opacity="0.4" />
        <circle cx="8" cy="24" r="1.5" fill="white" opacity="0.4" />
        <circle cx="16" cy="24" r="1.5" fill="white" opacity="0.4" />
        <circle cx="24" cy="24" r="1.5" fill="white" opacity="0.4" />
        {/* L shape */}
        <path
          d="M10 10V22H18"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* G shape */}
        <path
          d="M22 14C22 12.3 20.8 11 19.5 11C18 11 17 12.2 17 14V18C17 19.8 18 21 19.5 21C21 21 22 19.8 22 18V17H20"
          stroke="#93C5FD"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!iconOnly && (
        <span className={cn("font-bold tracking-tight text-white", text)}>
          LaunchGrid{" "}
          <span className="text-blue-400">AI</span>
        </span>
      )}
    </div>
  );
}
