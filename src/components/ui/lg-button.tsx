"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ArrowLeft,
  Search,
  Sparkles,
  Plus,
  Check,
  ChevronDown,
  Eye,
  FileText,
  Mail,
  Copy,
  Download,
  Link as LinkIcon,
  Filter,
  Trash2,
  Edit3,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  arrow: ArrowRight,
  arrowLeft: ArrowLeft,
  search: Search,
  sparkles: Sparkles,
  plus: Plus,
  check: Check,
  chevronDown: ChevronDown,
  eye: Eye,
  file: FileText,
  mail: Mail,
  copy: Copy,
  download: Download,
  link: LinkIcon,
  filter: Filter,
  trash: Trash2,
  edit: Edit3,
  bell: Bell,
  settings: Settings,
};

export type LgIconName = keyof typeof ICONS;

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface LgButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: Variant;
  size?: Size;
  icon?: LgIconName;
  iconRight?: LgIconName;
  children?: React.ReactNode;
}

const sizeMap: Record<Size, { h: number; px: number; fs: number; gap: number; iconSize: number }> = {
  sm: { h: 30, px: 11, fs: 13, gap: 6, iconSize: 14 },
  md: { h: 36, px: 14, fs: 13.5, gap: 7, iconSize: 14 },
  lg: { h: 44, px: 18, fs: 14.5, gap: 8, iconSize: 16 },
};

export const LgButton = React.forwardRef<HTMLButtonElement, LgButtonProps>(
  (
    { variant = "primary", size = "md", icon, iconRight, children, className, style, ...rest },
    ref
  ) => {
    const s = sizeMap[size];
    const variantStyle: React.CSSProperties =
      variant === "primary"
        ? {
            background: "var(--text)",
            color: "var(--bg-deep)",
            border: "1px solid var(--text)",
          }
        : variant === "secondary"
        ? {
            background: "rgba(255,255,255,0.04)",
            color: "var(--text)",
            border: "1px solid var(--line-strong)",
          }
        : variant === "ghost"
        ? {
            background: "transparent",
            color: "var(--text)",
            border: "1px solid transparent",
          }
        : {
            background: "transparent",
            color: "var(--danger)",
            border: "1px solid var(--border)",
          };

    const IconL = icon ? ICONS[icon] : null;
    const IconR = iconRight ? ICONS[iconRight] : null;

    return (
      <button
        ref={ref}
        {...rest}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
          className
        )}
        style={{
          height: s.h,
          padding: `0 ${s.px}px`,
          fontSize: s.fs,
          gap: s.gap,
          borderRadius: "var(--radius)",
          letterSpacing: "-0.005em",
          transition:
            "transform var(--transition), background var(--transition), border-color var(--transition), box-shadow var(--transition)",
          ...variantStyle,
          ...style,
        }}
      >
        {IconL && <IconL size={s.iconSize} strokeWidth={1.75} />}
        {children}
        {IconR && <IconR size={s.iconSize} strokeWidth={1.75} />}
      </button>
    );
  }
);
LgButton.displayName = "LgButton";
