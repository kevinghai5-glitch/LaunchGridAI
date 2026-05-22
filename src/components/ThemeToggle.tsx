"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "lg-theme";

export function ThemeToggle({ size = 32 }: { size?: number }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      title={isDark ? "Switch to light" : "Switch to dark"}
      aria-label="Toggle theme"
      className="relative inline-flex items-center cursor-pointer rounded-full"
      style={{
        width: size * 1.8,
        height: size,
        padding: 3,
        background: "var(--surface-active)",
        border: "1px solid var(--border)",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <span
        className="grid place-items-center rounded-full"
        style={{
          position: "absolute",
          top: 2,
          left: isDark ? 2 : size * 0.85,
          width: size - 6,
          height: size - 6,
          background: "var(--surface)",
          boxShadow: "var(--shadow-sm)",
          transition: "left 0.2s cubic-bezier(0.3, 0.7, 0.4, 1)",
          color: "var(--text)",
        }}
      >
        {isDark ? <Moon size={13} strokeWidth={1.75} /> : <Sun size={13} strokeWidth={1.75} />}
      </span>
    </button>
  );
}
