import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "lg-grad shadow hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-lg-line bg-transparent shadow-sm hover:bg-lg-surface-hover hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-lg-surface-hover hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        blue: "lg-grad shadow hover:brightness-110",
        // `blue`/`blue-outline` are legacy NAMES from the pre-terracotta palette
        // — `blue` already resolved to the accent gradient. This variant was the
        // last live blue in the dashboard chrome: a blue outline sitting next to
        // accent-gradient buttons. Now the accent outline. Names left alone on
        // purpose; renaming a variant would touch call sites another workflow owns.
        "blue-outline":
          "border border-[color-mix(in_oklab,var(--accent)_55%,transparent)] text-lg-accent hover:bg-lg-accent-soft hover:border-lg-accent",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-8 text-base",
        xl: "h-12 rounded-xl px-10 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
