import * as React from "react";
import { cn } from "@/lib/utils";

interface LgCardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export const LgCard = React.forwardRef<HTMLDivElement, LgCardProps>(
  ({ padded = true, className, style, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        {...rest}
        className={cn(className)}
        style={{
          // Flat elevated card (Whop/Apple): solid fill, hairline border, soft
          // grounding shadow — no gradient, no machined inner highlight.
          background: "var(--surface)",
          border: "1px solid var(--line-strong)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow)",
          padding: padded ? 24 : 0,
          ...style,
        }}
      >
        {children}
      </div>
    );
  }
);
LgCard.displayName = "LgCard";
