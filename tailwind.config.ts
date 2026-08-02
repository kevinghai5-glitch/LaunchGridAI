import type { Config } from "tailwindcss";

// TAILWIND MAJOR VERSION: 3 (package.json ^3.4.6, installed 3.4.19).
//
// The owner also supplied an `@theme inline { --color-*: var(--*) }` block. That
// is Tailwind v4 syntax and is a NO-OP on v3 — v4 reads the theme out of CSS,
// v3 reads it out of this file. The equivalent on v3 is exactly what is below:
// theme.extend.colors entries whose values are `var(--token)`, so the palette
// still lives in globals.css and this file only names it. Nothing was pasted.
//
// Every entry points at the SAME CSS variable that carries that name in
// globals.css, so `bg-card` and `var(--card)` can never drift apart.
//
// darkMode is keyed to [data-theme="dark"], which is set on the dashboard shell
// in src/app/(dashboard)/layout.tsx — NOT on <html>. That is deliberate: it
// keeps the `dark:` variant from being live on the two client-facing routes
// (/a/[publicId], /p/[publicId]) that share the root layout. No file currently
// uses a `dark:` variant, so this is a fence for future code, not a live path.
const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        // shadcn's `accent` is the SUBTLE HOVER SURFACE, not the brand accent.
        // It therefore takes the owner's literal --accent/--accent-foreground
        // pair, which globals.css stores as --accent-subtle/-foreground to keep
        // it from colliding with the brand --accent (196 inline call sites).
        // The brand accent is `primary-*` here, and `lg-accent` below.
        accent: {
          DEFAULT: "var(--accent-subtle)",
          foreground: "var(--accent-subtle-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        // Sidebar scale — new, from the owner's palette.
        // NOTE: --sidebar-border is #ebebeb (near-white) in the supplied dark
        // block. Transcribed as given; pick a dark value before using
        // `border-sidebar-border` on the actual sidebar.
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        // Chart scale — new, from the owner's palette. chart-3 (#1a1915) and
        // chart-4 (#2f2b48) are near-black; they are surface/fill values, not
        // series colours that will read against a dark canvas.
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        // LaunchGrid semantic tokens (use via lg-bg, lg-surface, lg-accent, etc.)
        lg: {
          bg: "var(--bg)",
          "bg-deep": "var(--bg-deep)",
          "bg-elevated": "var(--bg-elevated)",
          surface: "var(--surface)",
          "surface-2": "var(--surface-2)",
          "surface-hi": "var(--surface-hi)",
          "surface-hover": "var(--surface-hover)",
          "surface-active": "var(--surface-active)",
          sidebar: "var(--sidebar)",
          text: "var(--text)",
          "text-2": "var(--text-2)",
          "text-3": "var(--text-3)",
          "text-4": "var(--text-4)",
          "text-muted": "var(--text-muted)",
          "text-subtle": "var(--text-subtle)",
          line: "var(--line)",
          "line-strong": "var(--line-strong)",
          "line-bright": "var(--line-bright)",
          border: "var(--border)",
          "border-strong": "var(--border-strong)",
          accent: "var(--accent)",
          "accent-hover": "var(--accent-hover)",
          "accent-soft": "var(--accent-soft)",
          "accent-text": "var(--accent-text)",
          money: "var(--money)",
          "money-soft": "var(--money-soft)",
          success: "var(--success)",
          "success-soft": "var(--success-soft)",
          warning: "var(--warning)",
          "warning-soft": "var(--warning-soft)",
          danger: "var(--danger)",
          "danger-soft": "var(--danger-soft)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SF Mono", "monospace"],
        display: ["var(--font-sans)", "-apple-system", "sans-serif"],
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
