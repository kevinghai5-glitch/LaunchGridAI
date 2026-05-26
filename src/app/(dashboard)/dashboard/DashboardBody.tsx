"use client";

import Link from "next/link";
import { Eye, Sparkles, Check, FileText, TriangleAlert, Radar, ArrowUpRight } from "lucide-react";
import { LgButton } from "@/components/ui/lg-button";
import { Surface, PanelHeader, Spark, useCountUp } from "@/components/dashboard/os";
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

const SPARK_MRR = [3, 4, 3, 5, 6, 5, 7, 8, 7, 9, 11, 10, 12, 14, 13, 15, 17, 16, 18];
const SPARK_PIPE = [12, 14, 13, 15, 14, 17, 18, 17, 20, 22, 21, 24, 26, 25, 28, 27, 30, 32, 31];

const ACTIVITY = [
  { Icon: Eye, tone: "accent", actor: "Maya Holcomb", what: "opened the Cedar & Sage proposal · 3rd view", when: "just now" },
  { Icon: Sparkles, tone: "accent", actor: "Studio", what: "shipped Growth Asset Pack for Bluebird HVAC", when: "2m" },
  { Icon: Check, tone: "money", actor: "Dr. Lena Park", what: "signed Northgate Family Dental · $1,500/mo", when: "14m", highlight: true },
  { Icon: TriangleAlert, tone: "warn", actor: "Radar", what: "flagged Tiger Lily Day Spa · 94 opportunity score", when: "38m" },
  { Icon: FileText, tone: "neutral", actor: "You", what: "drafted proposal for Iron Forge Strength Co.", when: "1h" },
  { Icon: Radar, tone: "neutral", actor: "Radar", what: "scanned 247 businesses across Tampa, FL", when: "2h" },
] as const;

const OPPORTUNITIES = [
  { score: 94, name: "Tiger Lily Day Spa", city: "Charleston, SC", weakness: "No online booking, 4-day review gap" },
  { score: 89, name: "Magnolia Wellness Retreat", city: "Charleston, SC", weakness: "Stale Instagram, weak lead capture" },
  { score: 86, name: "Lowcountry Bodyworks", city: "Charleston, SC", weakness: "No follow-up sequence detected" },
];

const GENERATIONS = [
  { title: "Growth Asset Pack", sub: "Cedar & Sage Wellness Spa · 5 docs", time: "14m", closed: false },
  { title: "Growth Asset Pack", sub: "Bluebird HVAC · 5 docs", time: "2h", closed: false },
  { title: "Proposal draft", sub: "Iron Forge Strength Co.", time: "yesterday", closed: false },
  { title: "Growth Asset Pack", sub: "Northgate Family Dental", time: "2d", closed: true },
];

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
}: Props) {
  const animMRR = useCountUp(totalMRR, 1100);
  const animPipe = useCountUp(pipelineMRR, 1100);

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
            fontWeight: 500,
            letterSpacing: "-0.025em",
            lineHeight: 1.15,
            maxWidth: 640,
            color: "var(--text)",
          }}
        >
          Good morning, {firstName}.
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
          delta={wonCount > 0 ? `${wonCount} retainers active` : "No retainers yet"}
          spark={SPARK_MRR}
          accent="money"
          sub="Recurring · auto-renew"
        />
        <MetricCard
          label="In pipeline"
          value={`$${Math.round(animPipe).toLocaleString()}`}
          unit="/mo"
          delta="Deals warming"
          spark={SPARK_PIPE}
          accent="accent"
          sub="Awaiting reply · negotiating"
        />
      </div>

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
            {ACTIVITY.map((a, i) => (
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
                    background: "rgba(255,255,255,0.03)",
                    color: TONE_C[a.tone],
                  }}
                >
                  <a.Icon size={13} strokeWidth={1.75} />
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
            ))}
          </div>
        </Surface>

        <Surface padded={0}>
          <PanelHeader title="Opportunities" sub="Auto-detected this week" />
          <div style={{ padding: "6px 16px 16px" }}>
            {OPPORTUNITIES.map((o) => (
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
                    background: "rgba(255,255,255,0.03)",
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
            ))}
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
            {GENERATIONS.map((g, i) => (
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
            ))}
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
    <Surface padded={0} style={{ padding: "26px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{label}</div>
      <div
        className="lg-display tnum"
        style={{ fontSize: 44, fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1, color: "var(--text)" }}
      >
        {value}
        <span style={{ fontSize: 16, color: "var(--text-3)", fontWeight: 400, marginLeft: 4 }}>{unit}</span>
      </div>
      <div className="flex items-end justify-between" style={{ gap: 12 }}>
        <div>
          <div style={{ fontSize: 12.5, color: c, fontWeight: 500 }}>{delta}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 3 }}>{sub}</div>
        </div>
        <Spark data={spark} color={c} w={120} h={32} />
      </div>
    </Surface>
  );
}

function PipelineFlow({ stageCounts }: { stageCounts: Record<string, number> }) {
  const counts = PIPELINE_STAGES.map((s) => stageCounts[s.id] || 0);
  const max = Math.max(...counts, 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {PIPELINE_STAGES.map((s, i) => (
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
                background: s.id === "WON" ? "var(--money)" : "var(--accent)",
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
