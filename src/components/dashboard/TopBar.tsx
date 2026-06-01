"use client";

interface TopBarProps {
  title: string;
  /** Breadcrumb shown after the title (e.g. "Charleston, SC · Day Spa"). */
  subtitle?: string;
}

export function TopBar({ title, subtitle = "Today" }: TopBarProps) {
  return (
    <div
      className="flex items-center sticky top-0 z-30"
      style={{
        height: 64,
        padding: "0 40px",
        gap: 24,
        background: "rgba(10, 10, 11, 0.6)",
        borderBottom: "1px solid var(--line)",
        backdropFilter: "blur(32px) saturate(180%)",
        WebkitBackdropFilter: "blur(32px) saturate(180%)",
      }}
    >
      <div className="flex items-center" style={{ gap: 10, minWidth: 220 }}>
        <div
          className="lg-display"
          style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)" }}
        >
          {title}
        </div>
        {subtitle && (
          <>
            <span style={{ fontSize: 13, color: "var(--text-4)", fontWeight: 400 }}>›</span>
            <div style={{ fontSize: 13, color: "var(--text-3)" }}>{subtitle}</div>
          </>
        )}
      </div>

      {/* center search */}
      <div className="flex justify-center" style={{ flex: 1 }}>
        <button
          className="flex items-center text-left"
          style={{
            width: "min(540px, 100%)",
            gap: 10,
            height: 38,
            padding: "0 14px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "background var(--t), border-color var(--t)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--line-strong)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--line)";
          }}
        >
          <span aria-hidden style={{ fontSize: 13, opacity: 0.8, lineHeight: 1 }}>🔍</span>
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>Search</span>
          <span style={{ flex: 1 }} />
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </button>
      </div>

      <div className="flex items-center justify-end" style={{ gap: 4, minWidth: 220 }}>
        <IconButton ariaLabel="Notifications" dot>
          🔔
        </IconButton>
        <IconButton ariaLabel="Settings">
          ⚙️
        </IconButton>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="lg-mono grid place-items-center"
      style={{
        minWidth: 18,
        height: 18,
        padding: "0 4px",
        fontSize: 10.5,
        color: "var(--text-3)",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--line-strong)",
        borderRadius: 4,
      }}
    >
      {children}
    </span>
  );
}

function IconButton({
  children,
  ariaLabel,
  dot,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  dot?: boolean;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className="grid place-items-center cursor-pointer relative"
      style={{
        width: 36,
        height: 36,
        padding: 0,
        fontSize: 15,
        lineHeight: 1,
        background: "transparent",
        border: "none",
        borderRadius: 10,
        opacity: 0.78,
        transition: "background var(--t), opacity var(--t)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
        (e.currentTarget as HTMLElement).style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.opacity = "0.78";
      }}
    >
      {children}
      {dot && (
        <span
          style={{
            position: "absolute",
            top: 7,
            right: 7,
            width: 6,
            height: 6,
            borderRadius: 99,
            background: "var(--accent)",
            boxShadow: "0 0 0 2px rgba(10,10,11,0.6)",
          }}
        />
      )}
    </button>
  );
}
