import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground border-lg-line-strong",
        blue: "border-lg-accent bg-lg-accent-soft text-lg-accent",
        // Lifecycle tones. Three distinct hues in the new palette — --money is
        // green (h149), --warning gold (h44), --danger red (h25) — so green /
        // yellow / red stay as separable as they were. Borders go through
        // color-mix because Tailwind v3 silently DROPS the `/30` alpha modifier
        // on a colour whose value is a bare var(); verified against this
        // project's own config.
        green:
          "border-[color-mix(in_oklab,var(--money)_35%,transparent)] bg-lg-money-soft text-lg-money",
        yellow:
          "border-[color-mix(in_oklab,var(--warning)_35%,transparent)] bg-lg-warning-soft text-lg-warning",
        red:
          "border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-lg-danger-soft text-lg-danger",
        gray: "border-lg-line bg-lg-surface-2 text-lg-text-3",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
