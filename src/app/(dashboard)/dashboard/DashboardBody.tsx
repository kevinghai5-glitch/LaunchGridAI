"use client";

import Link from "next/link";
import { Eye, Sparkles, Check, FileText, Plus, ArrowRight, Star } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { LgButton } from "@/components/ui/lg-button";
import { LgBadge } from "@/components/ui/lg-badge";
import { LgCard } from "@/components/ui/lg-card";
import { PIPELINE_STAGES } from "@/lib/stages";

interface BusinessRow {
  id: string;
  name: string;
  industry: string;
  city: string;
  rating: number;
  status: string;
}

interface Props {
  firstName: string;
  totalMRR: number;
  pipelineMRR: number;
  wonCount: number;
  businessCount: number;
  proposalCount: number;
  stageCounts: Record<string, number>;
  recentBusinesses: BusinessRow[];
}

const ACTIVITY = [
  { Icon: Eye, tone: "accent" as const, txt: "Maya Holcomb opened the Cedar & Sage proposal", time: "2h ago" },
  { Icon: Sparkles, tone: "accent" as const, txt: "Generated Content System for Bluebird HVAC", time: "5h ago" },
  { Icon: Check, tone: "success" as const, txt: "Dr. Lena Park signed — Northgate Family Dental → Won ($497/mo)", time: "yesterday" },
  { Icon: FileText, tone: "neutral" as const, txt: "Drafted proposal for Iron Forge Strength Co.", time: "2 days ago" },
  { Icon: Plus, tone: "neutral" as const, txt: "Added 4 new businesses in Tampa, FL", time: "3 days ago" },
];

const QUICK = [
  { num: "01", t: "Find 5 businesses", d: "Pick an industry and city you're targeting.", href: "/businesses" },
  { num: "02", t: "Generate a system", d: "Lead funnel or 30-day content plan.", href: "/studio" },
  { num: "03", t: "Send the proposal", d: "Pick a preset price and share a public link.", href: "/proposals/new" },
];

export function DashboardBody({
  firstName,
  totalMRR,
  pipelineMRR,
  wonCount,
  businessCount,
  proposalCount,
  stageCounts,
  recentBusinesses,
}: Props) {
  const maxCount = Math.max(
    1,
    ...PIPELINE_STAGES.map((s) => stageCounts[s.id] || 0)
  );

  return (
    <div style={{ padding: "32px 40px 48px", maxWidth: 1280, margin: "0 auto" }}>
      <header
        className="flex justify-between items-end"
        style={{ marginBottom: 28 }}
      >
        <div>
          <div style={{ fontSize: 13, color: "var(--text-subtle)", marginBottom: 6 }}>
            Welcome back, {firstName}
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-sans), sans-serif",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: "var(--text)",
            }}
          >
            Your agency, in motion.
          </h1>
        </div>
        <div className="flex" style={{ gap: 8 }}>
          <Link href="/businesses">
            <LgButton variant="secondary" icon="search">
              Find businesses
            </LgButton>
          </Link>
          <Link href="/studio">
            <LgButton variant="primary" icon="sparkles">
              New system
            </LgButton>
          </Link>
        </div>
      </header>

      <div
        className="lg-rise grid"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}
      >
        <StatCard
          label="Monthly recurring"
          value={totalMRR}
          prefix="$"
          sub={`${wonCount} active clients`}
          trend={wonCount > 0 ? `+$${(totalMRR / Math.max(wonCount, 1)).toFixed(0)} avg` : "—"}
          tone="accent"
        />
        <StatCard
          label="Pipeline value"
          value={pipelineMRR}
          prefix="$"
          sub="Deals in motion"
        />
        <StatCard
          label="Saved businesses"
          value={businessCount}
          sub="Across your cities"
        />
        <StatCard
          label="Proposals sent"
          value={proposalCount}
          sub="Last 30 days"
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        <LgCard padded={false}>
          <div
            className="flex justify-between items-center"
            style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                Recent activity
              </h3>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                Last 7 days
              </div>
            </div>
            <LgButton variant="ghost" size="sm" iconRight="arrow">
              View all
            </LgButton>
          </div>
          <div style={{ padding: "8px 8px 12px" }}>
            {ACTIVITY.map((a, i) => (
              <div
                key={i}
                className="flex items-center"
                style={{
                  gap: 14,
                  padding: "12px 16px",
                  borderRadius: "var(--radius)",
                }}
              >
                <div
                  className="grid place-items-center flex-none"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background:
                      a.tone === "success"
                        ? "var(--success-soft)"
                        : a.tone === "accent"
                        ? "var(--accent-soft)"
                        : "var(--surface-active)",
                    color:
                      a.tone === "success"
                        ? "var(--success)"
                        : a.tone === "accent"
                        ? "var(--accent)"
                        : "var(--text-muted)",
                  }}
                >
                  <a.Icon size={15} strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1, fontSize: 14, color: "var(--text)" }}>{a.txt}</div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-subtle)",
                    fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  {a.time}
                </div>
              </div>
            ))}
          </div>
        </LgCard>

        <LgCard padded={false}>
          <div
            style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              Quick start
            </h3>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
              Three clicks to your next deal
            </div>
          </div>
          <div style={{ padding: 16 }}>
            {QUICK.map((q) => (
              <Link
                key={q.num}
                href={q.href}
                className="flex items-center w-full"
                style={{
                  gap: 14,
                  padding: "14px 12px",
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  borderRadius: "var(--radius)",
                  color: "inherit",
                  textDecoration: "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "var(--surface-hover)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "transparent")
                }
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 11,
                    color: "var(--accent)",
                    fontWeight: 600,
                    width: 24,
                  }}
                >
                  {q.num}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                    {q.t}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{q.d}</div>
                </div>
                <ArrowRight
                  size={14}
                  strokeWidth={1.75}
                  style={{ color: "var(--text-subtle)" }}
                />
              </Link>
            ))}
          </div>
        </LgCard>
      </div>

      <div
        className="grid"
        style={{ marginTop: 28, gridTemplateColumns: "1fr 1fr", gap: 20 }}
      >
        <LgCard padded={false}>
          <div
            className="flex justify-between items-center"
            style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              Top saved businesses
            </h3>
            <Link href="/businesses">
              <LgButton variant="ghost" size="sm" iconRight="arrow">
                Manage
              </LgButton>
            </Link>
          </div>
          <div>
            {recentBusinesses.length === 0 && (
              <div style={{ padding: 24, fontSize: 13.5, color: "var(--text-muted)" }}>
                No businesses yet.{" "}
                <Link href="/businesses" style={{ color: "var(--accent)" }}>
                  Find some →
                </Link>
              </div>
            )}
            {recentBusinesses.map((b, i) => (
              <div
                key={b.id}
                className="flex justify-between items-center"
                style={{
                  padding: "14px 24px",
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "var(--text)",
                    }}
                  >
                    {b.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {b.industry} · {b.city}
                  </div>
                </div>
                <div className="flex items-center" style={{ gap: 16 }}>
                  {b.rating > 0 && (
                    <span
                      className="inline-flex items-center"
                      style={{
                        gap: 3,
                        color: "color-mix(in oklch, var(--warning) 70%, black)",
                      }}
                    >
                      <Star size={12} fill="currentColor" stroke="none" />
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 12.5,
                          color: "var(--text)",
                        }}
                      >
                        {b.rating.toFixed(1)}
                      </span>
                    </span>
                  )}
                  <LgBadge tone="neutral">{b.status}</LgBadge>
                </div>
              </div>
            ))}
          </div>
        </LgCard>

        <LgCard padded={false}>
          <div
            className="flex justify-between items-center"
            style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              Pipeline this week
            </h3>
            <Link href="/deals">
              <LgButton variant="ghost" size="sm" iconRight="arrow">
                Open Kanban
              </LgButton>
            </Link>
          </div>
          <div style={{ padding: 24 }}>
            <div
              className="flex items-end"
              style={{ gap: 12, height: 140 }}
            >
              {PIPELINE_STAGES.map((s) => {
                const count = stageCounts[s.id] || 0;
                const h = (count / maxCount) * 100;
                return (
                  <div
                    key={s.id}
                    className="flex flex-col items-center"
                    style={{ flex: 1, gap: 6 }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-subtle)",
                        fontFamily: "var(--font-mono), monospace",
                      }}
                    >
                      {count}
                    </div>
                    <div
                      className="flex items-end"
                      style={{ width: "100%", flex: 1 }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: `${Math.max(h, 6)}%`,
                          background:
                            s.id === "WON" ? "var(--success)" : "var(--accent)",
                          opacity:
                            s.id === "SAVED" ? 0.45 : s.id === "WON" ? 1 : 0.7,
                          borderRadius: "6px 6px 2px 2px",
                          transition: "height 0.4s cubic-bezier(0.2, 0.7, 0.3, 1)",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--text-muted)",
                        textAlign: "center",
                        fontWeight: 500,
                        height: 24,
                        lineHeight: 1.1,
                      }}
                    >
                      {s.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </LgCard>
      </div>
    </div>
  );
}
