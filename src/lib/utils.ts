import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ReclaimedHQ prices in CAD only ($6,500 one-time, $1,000/month), so a USD
// format here was mislabelling every proposal figure on screen. One convention
// across the whole product — the marker goes BEFORE the number, "CAD $1,000" —
// matching leak-narrative.ts's cad() so a report and a proposal read the same.
// Intl's own "CAD" style renders "CA$1,000", which is neither convention, so we
// format the number and prefix the marker ourselves.
export function formatCurrency(amount: number): string {
  const n = new Intl.NumberFormat("en-CA", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `CAD $${n}`;
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
