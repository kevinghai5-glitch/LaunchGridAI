"use client";

import * as React from "react";

export function MotivationPopup() {
  const [open, setOpen] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("lg-motivation-seen")) return;
    setOpen(true);
  }, []);

  const dismiss = React.useCallback(() => {
    try {
      sessionStorage.setItem("lg-motivation-seen", "1");
    } catch {
      /* ignore */
    }
    setLeaving(true);
    setTimeout(() => setOpen(false), 260);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const auto = setTimeout(dismiss, 5000);
    return () => clearTimeout(auto);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed",
        top: 24,
        right: 24,
        zIndex: 90,
        maxWidth: 340,
        cursor: "pointer",
        padding: "16px 18px",
        background: "var(--surface)",
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-xl)",
        animation: leaving
          ? "lg-motiv-out-tr 0.26s ease forwards"
          : "lg-motiv-in-tr 0.34s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
        <span className="live-dot" style={{ color: "var(--warn)", width: 6, height: 6 }} />
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
        @keyframes lg-motiv-in-tr {
          from { opacity: 0; transform: translate(18px, -16px) scale(0.97); }
          to { opacity: 1; transform: translate(0, 0) scale(1); }
        }
        @keyframes lg-motiv-out-tr {
          from { opacity: 1; transform: translate(0, 0) scale(1); }
          to { opacity: 0; transform: translate(14px, -10px) scale(0.97); }
        }
      `}</style>
    </div>
  );
}
