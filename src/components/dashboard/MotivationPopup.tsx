"use client";

import * as React from "react";

export function MotivationPopup() {
  const [open, setOpen] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("lg-motivation-seen")) return;
    sessionStorage.setItem("lg-motivation-seen", "1");
    setOpen(true);
  }, []);

  const dismiss = React.useCallback(() => {
    setLeaving(true);
    setTimeout(() => setOpen(false), 240);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const auto = setTimeout(dismiss, 6500);
    return () => clearTimeout(auto);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 90,
        maxWidth: 340,
        cursor: "pointer",
        padding: "16px 18px",
        background: "var(--surface)",
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--radius)",
        boxShadow: "0 18px 48px -12px rgba(0,0,0,0.55)",
        animation: leaving
          ? "lg-motiv-out 0.24s ease forwards"
          : "lg-motiv-in 0.32s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <div
        className="flex items-center"
        style={{ gap: 8, marginBottom: 8 }}
      >
        <span
          className="live-dot"
          style={{ color: "var(--warn)", width: 6, height: 6 }}
        />
        <span
          className="lg-mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Reminder
        </span>
      </div>
      <p
        className="lg-display"
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.45,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--text)",
        }}
      >
        If you don&rsquo;t do this you will have to work a job you hate.
      </p>
      <style>{`
        @keyframes lg-motiv-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes lg-motiv-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(8px) scale(0.98); }
        }
      `}</style>
    </div>
  );
}
