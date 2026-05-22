import type { Config } from "tailwindcss";

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
        background: "var(--bg)",
        foreground: "var(--text)",
        card: {
          DEFAULT: "var(--surface)",
          foreground: "var(--text)",
        },
        popover: {
          DEFAULT: "var(--surface)",
          foreground: "var(--text)",
        },
        primary: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-text)",
        },
        secondary: {
          DEFAULT: "var(--surface-active)",
          foreground: "var(--text)",
        },
        muted: {
          DEFAULT: "var(--surface-active)",
          foreground: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-text)",
        },
        destructive: {
          DEFAULT: "var(--danger)",
          foreground: "#ffffff",
        },
        border: "var(--border)",
        input: "var(--border-strong)",
        ring: "var(--accent)",
        // LaunchGrid semantic tokens (use via lg-bg, lg-surface, lg-accent, etc.)
        lg: {
          bg: "var(--bg)",
          "bg-elevated": "var(--bg-elevated)",
          surface: "var(--surface)",
          "surface-hover": "var(--surface-hover)",
          "surface-active": "var(--surface-active)",
          sidebar: "var(--sidebar)",
          text: "var(--text)",
          "text-muted": "var(--text-muted)",
          "text-subtle": "var(--text-subtle)",
          border: "var(--border)",
          "border-strong": "var(--border-strong)",
          accent: "var(--accent)",
          "accent-soft": "var(--accent-soft)",
          "accent-text": "var(--accent-text)",
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
