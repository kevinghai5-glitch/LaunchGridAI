"use client";

import Link from "next/link";
import { Eye, Sparkles, Check, FileText, Radar, ArrowUpRight, BookOpen, ArrowRight } from "lucide-react";
import { LgButton } from "@/components/ui/lg-button";
import { Surface, PanelHeader, Spark, useCountUp } from "@/components/dashboard/os";
import { CRM_BOARD_STAGES } from "@/lib/crm";

interface BusinessRow {
  id: string;
  name: string;
  industry: string;
  city: string;
  rating: number;
  status: string;
}

interface ActivityRow {
  kind: "signed" | "generated" | "saved";
  tone: "money" | "accent" | "neutral";
  actor: string;
  what: string;
  when: string;
  highlight?: boolean;
}

interface OpportunityRow {
  score: number;
  name: string;
  city: string;
  weakness: string;
}

interface GenerationRow {
  title: string;
  sub: string;
  time: string;
  closed: boolean;
}

interface Props {
  firstName: string;
  totalMRR: number;
  pipelineMRR: number;
  wonCount: number;
  businessCount: number;
  stageCounts: Record<string, number>;
  sparkMRR: number[];
  sparkPipe: number[];
  activity: ActivityRow[];
  opportunities: OpportunityRow[];
  generations: GenerationRow[];
  recentBusinesses: BusinessRow[];
}

const KIND_ICON: Record<ActivityRow["kind"], typeof Eye> = {
  signed: Check,
  generated: Sparkles,
  saved: Radar,
};

const TONE_C: Record<string, string> = {
  accent: "var(--accent)",
  money: "var(--money)",
  warn: "var(--warn)",
  neutral: "var(--text-3)",
};

export function DashboardBody({
  firstName,
  totalMRR,
  pipelineMRR,
  wonCount,
  stageCounts,
  sparkMRR,
  sparkPipe,
  activity,
  opportunities,
  generations,
}: Props) {
  const animMRR = useCountUp(totalMRR, 1100);
  const animPipe = useCountUp(pipelineMRR, 1100);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ padding: "40px 56px 80px", maxWidth: 1280, margin: "0 auto" }}>
      {/* Editorial hero */}
      <div className="rise" style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 10 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <h1
          className="lg-display"
          style={{
            margin: 0,
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.12,
            maxWidth: 640,
            color: "var(--text)",
          }}
        >
          {greeting}, {firstName}.
          <br />
          <span style={{ color: "var(--text-3)" }}>
            Your acquisition engine is running.
          </span>
        </h1>
        <div className="flex" style={{ gap: 10, marginTop: 28 }}>
          <Link href="/businesses">
            <LgButton variant="primary" icon="search">
              Scan for opportunities
            </LgButton>
          </Link>
          <Link href="/studio">
            <LgButton variant="ghost" icon="sparkles">
              Open Studio
            </LgButton>
          </Link>
          <Link href="/playbook">
            <LgButton variant="ghost">
              <BookOpen size={15} strokeWidth={1.75} />
              Sales Playbook
            </LgButton>
          </Link>
        </div>
      </div>

      {/* Headline numbers */}
      <div
        className="rise grid"
        style={{ gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}
      >
        <MetricCard
          label="Active MRR"
          value={`$${Math.round(animMRR).toLocaleString()}`}
          unit="/mo"
          delta={wonCount > 0 ? `${wonCount} retainer${wonCount === 1 ? "" : "s"} active` : "No retainers yet"}
          spark={sparkMRR}
          accent="money"
          sub="Recurring · won deals"
        />
        <MetricCard
          label="In pipeline"
          value={`$${Math.round(animPipe).toLocaleString()}`}
          unit="/mo"
          delta={pipelineMRR > 0 ? "Deals warming" : "No open deals"}
          spark={sparkPipe}
          accent="accent"
          sub="Awaiting reply · negotiating"
        />
      </div>

      {/* Sales Playbook entry */}
      <Link href="/playbook" style={{ textDecoration: "none", color: "inherit" }}>
        <div
          className="row-hover flex items-center"
          style={{
            gap: 18,
            padding: "20px 24px",
            marginBottom: 40,
            borderRadius: 14,
            background: "var(--accent-soft)",
            border: "1px solid color-mix(in oklab, var(--accent) 22%, transparent)",
          }}
        >
          <div
            className="grid place-items-center flex-none"
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              background: "var(--surface-2)",
              border: "1px solid color-mix(in oklab, var(--accent) 30%, transparent)",
              color: "var(--accent)",
            }}
          >
            <BookOpen size={20} strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
              Sales Playbook
            </div>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 3 }}>
              Deliverables explained, pricing & ROI math, copy-paste scripts, and objection handling — everything to close the deal.
            </div>
          </div>
          <div className="flex items-center flex-none" style={{ gap: 7, fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
            Open playbook
            <ArrowRight size={15} strokeWidth={1.75} />
          </div>
        </div>
      </Link>

      {/* Activity + Opportunities */}
      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 40 }}>
        <Surface padded={0}>
          <PanelHeader
            title="Activity"
            sub="Last 24 hours"
            right={
              <LgButton variant="ghost" size="sm" iconRight="arrow">
                All events
              </LgButton>
            }
          />
          <div style={{ padding: "6px 0 14px" }}>
            {activity.length === 0 ? (
              <EmptyRow text="No activity yet — scan a niche or ship a pack to get started." />
            ) : (
              activity.map((a, i) => {
                const Icon = KIND_ICON[a.kind];
                return (
                  <div
                    key={i}
                    className="row-hover grid items-center"
                    style={{ gridTemplateColumns: "32px 1fr auto", gap: 14, padding: "12px 24px" }}
                  >
                    <div
                      className="grid place-items-center"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 99,
                        background: "var(--surface-2)",
                        color: TONE_C[a.tone],
                      }}
                    >
                      <Icon size={13} strokeWidth={1.75} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: "var(--text-2)", lineHeight: 1.5 }}>
                        <span style={{ color: "var(--text)", fontWeight: 500 }}>{a.actor}</span> {a.what}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap" }}>
                      {a.when}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </Surface>

        <Surface padded={0}>
          <PanelHeader title="Opportunities" sub="Auto-detected this week" />
          <div style={{ padding: "6px 16px 16px" }}>
            {opportunities.length === 0 ? (
              <EmptyRow text="No opportunities scored yet — run a scan to populate this." />
            ) : (
              opportunities.map((o) => (
              <Link
                key={o.name}
                href="/businesses"
                className="row-hover flex items-center"
                style={{ gap: 14, padding: "12px 10px", borderRadius: 10, textDecoration: "none", color: "inherit" }}
              >
                <div
                  className="grid place-items-center"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <span className="lg-mono tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                    {o.score}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{o.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                    {o.city} · {o.weakness}
                  </div>
                </div>
                <ArrowUpRight size={13} strokeWidth={1.75} style={{ color: "var(--text-3)" }} />
              </Link>
              ))
            )}
          </div>
        </Surface>
      </div>

      {/* Recent generations + Pipeline */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1.2fr", gap: 20 }}>
        <Surface padded={0}>
          <PanelHeader
            title="Recent generations"
            sub="Studio output"
            right={
              <Link href="/studio">
                <LgButton variant="ghost" size="sm" iconRight="arrow">
                  Studio
                </LgButton>
              </Link>
            }
          />
          <div style={{ padding: "6px 14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            {generations.length === 0 ? (
              <EmptyRow text="No generations yet — open Studio to ship your first pack." />
            ) : (
              generations.map((g, i) => (
              <div
                key={i}
                className="row-hover flex items-center"
                style={{ gap: 12, padding: "11px 10px", borderRadius: 8 }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>{g.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{g.sub}</div>
                </div>
                {g.closed && (
                  <span style={{ fontSize: 11.5, color: "var(--money)", fontWeight: 500 }}>Signed</span>
                )}
                <span style={{ fontSize: 11.5, color: "var(--text-3)", minWidth: 60, textAlign: "right" }}>
                  {g.time}
                </span>
              </div>
              ))
            )}
          </div>
        </Surface>

        <Surface padded={0}>
          <PanelHeader
            title="Pipeline"
            sub="By stage"
            right={
              <Link href="/deals">
                <LgButton variant="ghost" size="sm" iconRight="arrow">
                  Open
                </LgButton>
              </Link>
            }
          />
          <div style={{ padding: "12px 22px 22px" }}>
            <PipelineFlow stageCounts={stageCounts} />
          </div>
        </Surface>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  delta,
  spark,
  accent,
  sub,
}: {
  label: string;
  value: string;
  unit: string;
  delta: string;
  spark: number[];
  accent: "money" | "accent";
  sub: string;
}) {
  const c = accent === "money" ? "var(--money)" : "var(--accent)";
  return (
    <Surface hover padded={0} style={{ padding: "26px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{label}</div>
      <div
        className="lg-display tnum"
        style={{ fontSize: 44, fontWeight: 680, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--text)" }}
      >
        {value}
        <span style={{ fontSize: 16, color: "var(--text-3)", fontWeight: 500, marginLeft: 4 }}>{unit}</span>
      </div>
      <div className="flex items-end justify-between" style={{ gap: 12 }}>
        <div>
          <div style={{ fontSize: 12.5, color: c, fontWeight: 500 }}>{delta}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 3 }}>{sub}</div>
        </div>
        {spark.length >= 2 && <Spark data={spark} color={c} w={120} h={32} />}
      </div>
    </Surface>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "22px 24px",
        fontSize: 13,
        color: "var(--text-3)",
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}

function PipelineFlow({ stageCounts }: { stageCounts: Record<string, number> }) {
  const counts = CRM_BOARD_STAGES.map((s) => stageCounts[s.id] || 0);
  const max = Math.max(...counts, 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {CRM_BOARD_STAGES.map((s, i) => (
        <Link
          key={s.id}
          href="/deals"
          className="row-hover grid items-center"
          style={{
            gridTemplateColumns: "120px 1fr 60px",
            gap: 16,
            padding: "10px 10px",
            borderRadius: 8,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-2)" }}>{s.label}</span>
          <div className="bar">
            <span
              style={{
                transform: `scaleX(${counts[i] / max || 0.04})`,
                animationDelay: `${i * 0.08}s`,
                background: s.id === "WON" ? "var(--money)" : "var(--accent-grad)",
              }}
            />
          </div>
          <span
            className="lg-mono tnum"
            style={{
              fontSize: 13,
              fontWeight: 500,
              textAlign: "right",
              color: s.id === "WON" ? "var(--money)" : "var(--text)",
            }}
          >
            {counts[i]}
          </span>
        </Link>
      ))}
    </div>
  );
}
