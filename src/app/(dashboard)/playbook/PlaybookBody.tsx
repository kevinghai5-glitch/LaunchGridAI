"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Package,
  Layers,
  DollarSign,
  Route,
  MessageSquare,
  HelpCircle,
  ShieldCheck,
  Target,
  Copy,
  Check,
  ArrowRight,
  Clock,
  FileText,
  Calendar,
  TrendingUp,
  Quote,
  type LucideIcon,
} from "lucide-react";
import { Surface, Pill } from "@/components/dashboard/os";
import { LgButton } from "@/components/ui/lg-button";
import { formatCurrency } from "@/lib/utils";

/* ───────────────────────── section registry ───────────────────────── */

type SectionId =
  | "overview"
  | "deliverables"
  | "economics"
  | "process"
  | "scripts"
  | "discovery"
  | "objections"
  | "positioning";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; blurb: string }[] = [
  { id: "overview", label: "The Offer", icon: Package, blurb: "What you sell, in one frame" },
  { id: "deliverables", label: "The 4 Deliverables", icon: Layers, blurb: "Each asset & how to sell it" },
  { id: "economics", label: "Pricing & ROI", icon: DollarSign, blurb: "What to charge + the math" },
  { id: "process", label: "Sales Process", icon: Route, blurb: "Outreach → Zoom → close" },
  { id: "scripts", label: "Scripts & Talk Tracks", icon: MessageSquare, blurb: "Copy-paste outreach & pitch" },
  { id: "discovery", label: "Discovery Questions", icon: HelpCircle, blurb: "Uncover pain, qualify fast" },
  { id: "objections", label: "Objection Handling", icon: ShieldCheck, blurb: "Answers to every pushback" },
  { id: "positioning", label: "Positioning", icon: Target, blurb: "Why you, not the agency" },
];

export function PlaybookBody() {
  const [active, setActive] = useState<SectionId>("overview");

  return (
    <div style={{ padding: "40px 56px 80px", maxWidth: 1320, margin: "0 auto" }}>
      {/* Editorial hero */}
      <div className="rise" style={{ marginBottom: 36 }}>
        <Pill tone="accent" dot>
          Sales enablement
        </Pill>
        <h1
          className="lg-display"
          style={{
            margin: "16px 0 0",
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: "-0.032em",
            lineHeight: 1.12,
            maxWidth: 720,
            color: "var(--text)",
          }}
        >
          Everything you need to sell the Growth Asset Pack
          <span style={{ color: "var(--text-3)" }}> — without winging it.</span>
        </h1>
        <p style={{ margin: "14px 0 0", maxWidth: 660, fontSize: 14.5, lineHeight: 1.6, color: "var(--text-3)" }}>
          A complete, repeatable playbook: know exactly what each deliverable is worth, what to
          charge, what to say on every call, and how to answer any objection. Built around the same
          assets Studio generates from real business data.
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "248px 1fr", gap: 28, alignItems: "start" }}>
        {/* Left section nav */}
        <nav
          className="flex flex-col"
          style={{ gap: 3, position: "sticky", top: 80 }}
          aria-label="Playbook sections"
        >
          {SECTIONS.map((s, i) => {
            const on = active === s.id;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className="flex items-center text-left w-full"
                style={{
                  gap: 12,
                  padding: "11px 12px",
                  borderRadius: 10,
                  background: on ? "rgba(255,255,255,0.045)" : "transparent",
                  border: on ? "1px solid var(--line-strong)" : "1px solid transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: "inherit",
                  transition: "background var(--t)",
                }}
                onMouseEnter={(e) => {
                  if (!on) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                }}
                onMouseLeave={(e) => {
                  if (!on) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <div
                  className="grid place-items-center flex-none"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: on ? "var(--accent-soft)" : "rgba(255,255,255,0.03)",
                    color: on ? "var(--accent)" : "var(--text-3)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <Icon size={14} strokeWidth={1.75} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: on ? "var(--text)" : "var(--text-2)",
                      lineHeight: 1.3,
                    }}
                  >
                    {s.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 1 }}>{s.blurb}</div>
                </div>
                <span className="lg-mono flex-none" style={{ fontSize: 10, color: "var(--text-4)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Right content */}
        <div className="rise" key={active}>
          {active === "overview" && <Overview onJump={setActive} />}
          {active === "deliverables" && <Deliverables />}
          {active === "economics" && <Economics />}
          {active === "process" && <Process />}
          {active === "scripts" && <Scripts />}
          {active === "discovery" && <Discovery />}
          {active === "objections" && <Objections />}
          {active === "positioning" && <Positioning />}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── shared primitives ───────────────────────── */

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div
        className="lg-mono"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--accent)",
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <h2
        className="lg-display"
        style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--text)" }}
      >
        {title}
      </h2>
      {sub && (
        <p style={{ margin: "8px 0 0", maxWidth: 680, fontSize: 14, lineHeight: 1.6, color: "var(--text-3)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function Block({
  title,
  children,
  accent,
}: {
  title?: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <Surface
      padded={0}
      style={{
        padding: "22px 24px",
        ...(accent ? { borderLeft: `2px solid ${accent}` } : {}),
      }}
    >
      {title && (
        <div
          className="lg-display"
          style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text)", marginBottom: 14 }}
        >
          {title}
        </div>
      )}
      {children}
    </Surface>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setDone(false), 1600);
    } catch {
      toast.error("Couldn't copy");
    }
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center"
      style={{
        gap: 6,
        padding: "5px 10px",
        fontSize: 11.5,
        fontWeight: 600,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--line-strong)",
        borderRadius: 7,
        color: done ? "var(--money)" : "var(--text-2)",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "color var(--t)",
      }}
    >
      {done ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={1.75} />}
      {done ? "Copied" : label}
    </button>
  );
}

/* A line item with a small bullet dot. */
function Point({ children, color = "var(--accent)" }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-start" style={{ gap: 10 }}>
      <span
        className="flex-none"
        style={{ width: 6, height: 6, borderRadius: 99, background: color, marginTop: 7 }}
      />
      <span style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)" }}>{children}</span>
    </div>
  );
}

/* ───────────────────────── 1 · OVERVIEW ───────────────────────── */

function Overview({ onJump }: { onJump: (s: SectionId) => void }) {
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <SectionHead
        eyebrow="The Offer"
        title="You sell customer-acquisition infrastructure — not 'a website'"
        sub="Local service businesses don't have a traffic problem; they have a conversion-and-follow-up problem. The Growth Asset Pack is the system that turns the attention they already get into booked, paying customers — and then keeps it running."
      />

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <StatTile value="4" label="Done-for-you deliverables" sub="Diagnosis, blueprint, asset pack, rollout" />
        <StatTile value="$6.5k" label="Setup fee" sub="One-time build" accent="var(--text)" />
        <StatTile value="$1,000" label="Monthly retainer" sub="Run + optimize" accent="var(--money)" />
      </div>

      <Block title="The one-sentence pitch" accent="var(--accent)">
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--text)", fontWeight: 500 }}>
          &ldquo;I build the customer-acquisition system most local businesses are missing — a
          high-converting page, automatic lead scoring, and email + text follow-up — grounded in
          your real numbers, then I run it for you so you never let a lead go cold again.&rdquo;
        </p>
        <div style={{ marginTop: 14 }}>
          <CopyButton
            label="Copy pitch"
            text={
              "I build the customer-acquisition system most local businesses are missing — a high-converting page, automatic lead scoring, and email + text follow-up — grounded in your real numbers, then I run it for you so you never let a lead go cold again."
            }
          />
        </div>
      </Block>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Block title="Why it sells">
          <div className="flex flex-col" style={{ gap: 11 }}>
            <Point>It&apos;s built from <strong style={{ color: "var(--text)" }}>their real data</strong> — live site speed, screenshots, reviews, competitors. Not a generic template.</Point>
            <Point>It attacks the <strong style={{ color: "var(--text)" }}>expensive problem</strong>: leads that never convert or follow up.</Point>
            <Point>It&apos;s a <strong style={{ color: "var(--text)" }}>tangible deliverable</strong> they can see and keep — easy to say yes to.</Point>
            <Point>The retainer is justified by <strong style={{ color: "var(--text)" }}>ongoing optimization</strong>, not vague &ldquo;marketing.&rdquo;</Point>
          </div>
        </Block>
        <Block title="Who to sell it to">
          <div className="flex flex-col" style={{ gap: 11 }}>
            <Point color="var(--money)">Local service businesses: spas, dental, HVAC, gyms, med spas, roofing, law, auto.</Point>
            <Point color="var(--money)">Owner-operated, $300k–$3M revenue — big enough to afford it, small enough to have gaps.</Point>
            <Point color="var(--money)">Has demand but a leaky funnel: weak site, thin reviews, no follow-up.</Point>
            <Point color="var(--money)">One clear decision-maker (the owner) — short sales cycle.</Point>
          </div>
        </Block>
      </div>

      <Surface
        padded={0}
        style={{ padding: "20px 24px", background: "var(--accent-soft)", border: "1px solid oklch(0.55 0.18 248 / 0.25)" }}
      >
        <div className="flex items-center justify-between" style={{ gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
              Ready to run a real play?
            </div>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 3 }}>
              Generate a pack you can demo, then work the process end-to-end.
            </div>
          </div>
          <div className="flex" style={{ gap: 8 }}>
            <button onClick={() => onJump("process")} style={ghostChip}>
              See the process <ArrowRight size={13} strokeWidth={1.75} />
            </button>
            <Link href="/studio">
              <LgButton variant="primary" size="sm" icon="sparkles">
                Open Studio
              </LgButton>
            </Link>
          </div>
        </div>
      </Surface>
    </div>
  );
}

function StatTile({
  value,
  label,
  sub,
  accent = "var(--accent)",
}: {
  value: string;
  label: string;
  sub: string;
  accent?: string;
}) {
  return (
    <Surface padded={0} style={{ padding: "20px 22px" }}>
      <div
        className="lg-display tnum"
        style={{ fontSize: 30, fontWeight: 680, letterSpacing: "-0.03em", color: accent, lineHeight: 1 }}
      >
        {value}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginTop: 12 }}>{label}</div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>{sub}</div>
    </Surface>
  );
}

/* ───────────────────────── 2 · DELIVERABLES ───────────────────────── */

const DELIVERABLES: {
  n: number;
  icon: LucideIcon;
  file: string;
  title: string;
  what: string;
  solves: string;
  outcome: string;
  sell: string;
}[] = [
  {
    n: 1,
    icon: FileText,
    file: "01-growth-leak-intelligence-report.html",
    title: "Growth Leak Intelligence Report",
    what: "The diagnosis: a 7-axis conversion scorecard, dollar-quantified revenue leaks ranked by impact, a landing-page teardown with real PageSpeed scores and above-the-fold screenshots vs. local competitors — all reconciled to a single recoverable-revenue total.",
    solves: "Their site 'looks fine,' but paid leads quietly die between landing, follow-up, and booking — and they have no idea where the money is leaking or how much.",
    outcome: "A clear, dollar-ranked map of exactly where revenue is escaping and which leak to fix first — the case that makes the whole engagement obvious.",
    sell: "I pulled your real load times, put your homepage next to your top competitor, and put a dollar figure on each leak. Here's exactly where you're losing customers — and what it's worth to fix.",
  },
  {
    n: 2,
    icon: Route,
    file: "02-client-acquisition-infrastructure-blueprint.html",
    title: "Client Acquisition Infrastructure Blueprint",
    what: "The architecture we build: a 6-stage conversion path — Capture, Qualify, Speed-to-Lead, Nurture, Book, No-Show Recovery — plus a CRM-agnostic pipeline and lead tiers, with LeadGate qualifying every lead continuously.",
    solves: "Leads land in an inbox with no system — no scoring, no instant response, no nurture, no recovery. The $5k job and the tire-kicker get treated exactly the same.",
    outcome: "One connected system that catches, scores, and follows up on every lead automatically, so high-intent buyers get an instant response and nothing slips through.",
    sell: "Right now every lead hits your inbox the same way and you call back when you can. This is the system that scores each one the second it lands and gets the big job an instant response — not a next-day callback.",
  },
  {
    n: 3,
    icon: Layers,
    file: "03-conversion-asset-pack.html",
    title: "Conversion Asset Pack",
    what: "Every customer-facing asset that runs the system — the rewritten high-converting landing page, the email nurture sequence, the SMS follow-up sequence, booking and reminder flows, and a post-job review request — written in their voice for their market.",
    solves: "Even with a system in place, the words have to convert. Generic copy and missing follow-up messaging let interested leads go cold before they ever book.",
    outcome: "Done-for-you copy and messaging engineered to move people from interested to booked — the actual words that run on the infrastructure.",
    sell: "These are the exact words that do the work — the rewritten page, the emails, the texts — written for your market so an interested lead actually turns into a booking instead of drifting off.",
  },
  {
    n: 4,
    icon: Calendar,
    file: "04-implementation-optimization-timeline.html",
    title: "Implementation & Optimization Timeline",
    what: "The execution plan: a one-time Setup phase scoped to this report's leaks and sequenced by dollar impact, a Stabilize phase, then the ongoing optimization retainer cadence — all done-for-you.",
    solves: "A diagnosis and assets are worthless if nothing gets deployed. Owners have no time to implement and no plan for what happens after launch.",
    outcome: "A sequenced rollout where we deploy everything in priority order, then keep improving it month over month — the work that justifies the retainer.",
    sell: "You don't lift a finger. Here's the exact order we deploy everything — biggest revenue leak first — then how we keep testing and tightening it every month so it compounds.",
  },
];

function Deliverables() {
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <SectionHead
        eyebrow="The 4 Deliverables"
        title="Know every asset cold — and the line that sells it"
        sub="Each deliverable in the pack solves one expensive, specific problem. Lead with the problem, show the asset, then frame the outcome. Use the 'Say this' line verbatim on calls."
      />
      {DELIVERABLES.map((d) => {
        const Icon = d.icon;
        return (
          <Surface key={d.n} padded={0} style={{ padding: "24px 26px" }}>
            <div className="flex items-start" style={{ gap: 16, marginBottom: 16 }}>
              <div
                className="grid place-items-center flex-none"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 11,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  border: "1px solid oklch(0.55 0.18 248 / 0.25)",
                }}
              >
                <Icon size={19} strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center" style={{ gap: 10, flexWrap: "wrap" }}>
                  <span className="lg-mono" style={{ fontSize: 11, color: "var(--text-4)" }}>
                    FILE {d.n}
                  </span>
                  <Pill tone="neutral">{d.file}</Pill>
                </div>
                <h3
                  className="lg-display"
                  style={{ margin: "8px 0 0", fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--text)" }}
                >
                  {d.title}
                </h3>
                <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)" }}>
                  {d.what}
                </p>
              </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <MiniCol label="The problem it kills" tone="warn" text={d.solves} />
              <MiniCol label="The outcome you promise" tone="money" text={d.outcome} />
            </div>

            <div
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid var(--line)",
              }}
            >
              <div className="flex items-center justify-between" style={{ gap: 12, marginBottom: 8 }}>
                <span
                  className="lg-mono"
                  style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)" }}
                >
                  Say this
                </span>
                <CopyButton text={d.sell} />
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text)", fontStyle: "italic" }}>
                &ldquo;{d.sell}&rdquo;
              </p>
            </div>
          </Surface>
        );
      })}
    </div>
  );
}

function MiniCol({ label, text, tone }: { label: string; text: string; tone: "warn" | "money" }) {
  const c = tone === "warn" ? "var(--warn)" : "var(--money)";
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: c, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-2)" }}>{text}</div>
    </div>
  );
}

/* ───────────────────────── 3 · ECONOMICS ───────────────────────── */

function Economics() {
  const [custValue, setCustValue] = useState(800);
  const [extraPerMonth, setExtraPerMonth] = useState(4);
  const [retainer] = useState(1000);

  const monthlyGain = custValue * extraPerMonth;
  const netMonthly = monthlyGain - retainer;
  const annualGain = monthlyGain * 12;
  const setup = 6500;
  const firstYearCost = setup + retainer * 12;
  const roi = firstYearCost > 0 ? ((annualGain - firstYearCost) / firstYearCost) * 100 : 0;
  const paybackCustomers = custValue > 0 ? Math.ceil(setup / custValue) : 0;

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <SectionHead
        eyebrow="Pricing & ROI"
        title="What to charge, and how to make the price feel obvious"
        sub="Anchor everything to the value of a single new customer. The system doesn't cost money — it pays for itself the moment it books a handful of jobs they'd otherwise have lost."
      />

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Block title="Setup fee — $6,500 one-time" accent="var(--text)">
          <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)" }}>
            This is the <strong style={{ color: "var(--text)" }}>build of the infrastructure</strong> — four
            deliverables engineered from their real data. Frame it as an asset they own, not a fee.
          </p>
          <div className="flex flex-col" style={{ gap: 9 }}>
            <Point>Bill 50% upfront, 50% on delivery to de-risk it for both sides.</Point>
            <Point>Never discount the build — discount scope instead (e.g. start with the audit + page).</Point>
          </div>
        </Block>
        <Block title="Retainer — $1,000/mo" accent="var(--money)">
          <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)" }}>
            The <strong style={{ color: "var(--text)" }}>engine that keeps it running</strong>: ongoing
            optimization, A/B tests, reporting, and managing the sequences. This is recurring revenue.
          </p>
          <div className="flex flex-col" style={{ gap: 9 }}>
            <Point color="var(--money)">Starts at go-live, not at signing. Cancel anytime, month-to-month.</Point>
            <Point color="var(--money)">The price is the price — never negotiate it. The only flex is the 50% deposit split on the setup.</Point>
          </div>
        </Block>
      </div>

      <Block title="12-month deal value">
        <div className="flex items-end" style={{ gap: 8, flexWrap: "wrap" }}>
          <span
            className="lg-display tnum"
            style={{ fontSize: 38, fontWeight: 680, letterSpacing: "-0.035em", color: "var(--money)", lineHeight: 1 }}
          >
            $18,500
          </span>
          <span style={{ fontSize: 13, color: "var(--text-3)", paddingBottom: 4 }}>
            per client, year one ($6,500 setup + 12 × $1,000)
          </span>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--text-3)", lineHeight: 1.6 }}>
          Just <strong style={{ color: "var(--text)" }}>five clients</strong> is roughly $92k in year-one
          contract value — and the retainers compound every month they renew.
        </p>
      </Block>

      {/* ROI calculator */}
      <Surface padded={0} style={{ padding: "24px 26px", border: "1px solid oklch(0.55 0.16 158 / 0.25)" }}>
        <div className="flex items-center" style={{ gap: 10, marginBottom: 6 }}>
          <TrendingUp size={16} strokeWidth={1.75} style={{ color: "var(--money)" }} />
          <h3 className="lg-display" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
            Live ROI calculator
          </h3>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-3)", lineHeight: 1.55 }}>
          Walk the prospect through this on the call. Plug in their numbers — the price sells itself.
        </p>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <Slider
            label="Avg. customer value"
            prefix="$"
            value={custValue}
            min={100}
            max={5000}
            step={50}
            onChange={setCustValue}
          />
          <Slider
            label="Extra customers / mo"
            value={extraPerMonth}
            min={1}
            max={30}
            step={1}
            onChange={setExtraPerMonth}
          />
          <div>
            <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>Monthly retainer</span>
              <span className="lg-mono tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--money)" }}>
                ${retainer.toLocaleString()}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-4)", lineHeight: 1.5 }}>
              Fixed. The retainer is not negotiable — the only flex is the 50% deposit split on the setup.
            </p>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <ResultTile label="Added revenue / mo" value={formatCurrency(monthlyGain)} tone="money" />
          <ResultTile
            label="Net after retainer"
            value={`${netMonthly >= 0 ? "+" : "−"}${formatCurrency(Math.abs(netMonthly))}/mo`}
            tone={netMonthly >= 0 ? "money" : "warn"}
          />
          <ResultTile label="Setup pays back in" value={`${paybackCustomers} customers`} tone="accent" />
          <ResultTile label="Year-one ROI" value={`${Math.round(roi).toLocaleString()}%`} tone={roi >= 0 ? "money" : "warn"} />
        </div>

        <p style={{ margin: "16px 0 0", fontSize: 12, color: "var(--text-4)", lineHeight: 1.5 }}>
          Planning estimates for the sales conversation — not a guarantee. Always frame projections as
          illustrative.
        </p>
      </Surface>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  prefix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{label}</span>
        <span className="lg-mono tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
          {prefix}
          {value.toLocaleString()}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--money)", cursor: "pointer" }}
      />
    </div>
  );
}

function ResultTile({ label, value, tone }: { label: string; value: string; tone: "money" | "accent" | "warn" }) {
  const c = tone === "money" ? "var(--money)" : tone === "warn" ? "var(--warn)" : "var(--accent)";
  return (
    <div
      style={{
        padding: "14px 14px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid var(--line)",
      }}
    >
      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 8 }}>{label}</div>
      <div className="lg-display tnum" style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", color: c }}>
        {value}
      </div>
    </div>
  );
}

/* ───────────────────────── 4 · PROCESS ───────────────────────── */

// Top-of-funnel flow: how a prospect moves from cold to closed.
const FLOW: { emoji: string; label: string; sub: string; tool?: { label: string; href: string } }[] = [
  {
    emoji: "📞",
    label: "Cold call / email for outreach",
    sub: "Cold calling is the primary channel, email the backup. This first touch has one job: book the meeting — not pitch.",
  },
  {
    emoji: "💻",
    label: "Book a Zoom meeting to pitch the assets",
    sub: "Get them on a screen-share. On the call you show the free cold audit, then the prospect's proposal — the assets do the selling.",
    tool: { label: "Open Studio", href: "/studio" },
  },
  {
    emoji: "💰",
    label: "Close",
    sub: "Sell the OUTCOME — more booked, paying customers — never the system or the files.",
    tool: { label: "Open Proposals", href: "/proposals" },
  },
];

// The Zoom call itself — three timed moves.
const MEETING: {
  n: number;
  time: string;
  title: string;
  tag: string;
  objective: string;
  execution: string;
  kicker: { label: string; body: string; quote?: boolean };
}[] = [
  {
    n: 1,
    time: "0–15 min",
    title: "Diagnose",
    tag: "The Cold Audit",
    objective: "Make the hidden gaps visible and painful.",
    execution:
      "Share your screen and walk through your pre-identified findings. Lean heavily on the negative business consequences of these broken systems — wasted time, lost revenue, operational bottlenecks.",
    kicker: {
      label: "The goal",
      body: "Get them to verbally agree that these gaps exist and need to be fixed.",
    },
  },
  {
    n: 2,
    time: "15–20 min",
    title: "The Pivot",
    tag: "The Transition",
    objective: "Shift them from looking at a problem to looking for a solution.",
    execution: "Stop sharing the audit and ask a framing question to test their readiness.",
    kicker: {
      label: "The script",
      quote: true,
      body: "Now that we can see exactly where the bottlenecks are in your system, we have two choices. You can take this data and try to patch it up internally, or I can show you the exact system we use to fully automate and deploy this infrastructure for you. Would you like to see how we build that out?",
    },
  },
  {
    n: 3,
    time: "20–45 min",
    title: "Prescribe",
    tag: "The Proposal",
    objective: "Present your solution as the definitive fix to the specific gaps you just showed them.",
    execution: "Open the proposal. Frame every deliverable and line item directly back to the audit.",
    kicker: {
      label: "The logic",
      body: "Don't say \u201CWe offer CRM setup.\u201D Say \u201CTo fix the broken lead-tracking system we looked at 10 minutes ago, we deploy this specific CRM infrastructure.\u201D",
    },
  },
];

function FieldLabel({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className="lg-mono"
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: accent ? "var(--accent)" : "var(--text-4)",
      }}
    >
      {children}
    </span>
  );
}

function Process() {
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <SectionHead
        eyebrow="Sales Process"
        title="Outreach to close, on one Zoom call"
        sub="The whole motion: reach out to book the meeting, then let the cold audit and proposal do the selling on a screen-share. Always sell the outcome — never the files."
      />

      {/* Top-level flow */}
      <Surface padded={0} style={{ padding: "26px 26px 8px" }}>
        {FLOW.map((s, i) => (
          <div key={i} className="flex" style={{ gap: 16 }}>
            {/* node + connector rail */}
            <div className="flex flex-col items-center flex-none" style={{ width: 42 }}>
              <div
                className="grid place-items-center"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--line-strong)",
                  fontSize: 20,
                  lineHeight: 1,
                }}
              >
                {s.emoji}
              </div>
              {i < FLOW.length - 1 && (
                <div style={{ width: 2, flex: 1, background: "var(--line-strong)", margin: "6px 0" }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingBottom: i < FLOW.length - 1 ? 22 : 18 }}>
              <div
                className="lg-display"
                style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.012em", color: "var(--text)", marginTop: 9 }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--text-3)", marginTop: 5 }}>{s.sub}</div>
              {s.tool && (
                <div style={{ marginTop: 12 }}>
                  <Link href={s.tool.href}>
                    <LgButton variant="secondary" size="sm" iconRight="arrow">
                      {s.tool.label}
                    </LgButton>
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
      </Surface>

      {/* Inside the Zoom call */}
      <div style={{ marginTop: 12 }}>
        <div className="flex items-center" style={{ gap: 10, marginBottom: 5 }}>
          <h3
            className="lg-display"
            style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--text)" }}
          >
            Inside the Zoom call
          </h3>
          <Pill tone="accent">45-min structure</Pill>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-3)" }}>
          Three moves: make the gaps hurt, pivot to the fix, then prescribe the proposal as the cure.
        </p>
      </div>

      <div className="flex flex-col" style={{ gap: 12 }}>
        {MEETING.map((m) => (
          <Surface key={m.n} padded={0} style={{ padding: "22px 24px" }}>
            <div className="flex items-start" style={{ gap: 16 }}>
              <div className="flex flex-col items-center flex-none" style={{ gap: 8, width: 56 }}>
                <div
                  className="grid place-items-center lg-display"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--line-strong)",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--accent)",
                  }}
                >
                  {m.n}
                </div>
                <span
                  className="lg-mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    color: "var(--text-4)",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.time}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-baseline" style={{ gap: 9, flexWrap: "wrap" }}>
                  <h3
                    className="lg-display"
                    style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--text)" }}
                  >
                    {m.title}
                  </h3>
                  <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 500 }}>{m.tag}</span>
                </div>

                <div style={{ marginTop: 14 }}>
                  <FieldLabel>Objective</FieldLabel>
                  <p style={{ margin: "3px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)" }}>
                    {m.objective}
                  </p>
                </div>
                <div style={{ marginTop: 12 }}>
                  <FieldLabel>Execution</FieldLabel>
                  <p style={{ margin: "3px 0 0", fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)" }}>
                    {m.execution}
                  </p>
                </div>

                {/* kicker box */}
                <div
                  style={{
                    marginTop: 14,
                    padding: "13px 15px",
                    borderRadius: 10,
                    background: "var(--accent-soft)",
                    borderLeft: "2px solid var(--accent)",
                  }}
                >
                  <div className="flex items-center justify-between" style={{ gap: 10 }}>
                    <FieldLabel accent>{m.kicker.label}</FieldLabel>
                    {m.kicker.quote && <CopyButton text={m.kicker.body} label="Copy script" />}
                  </div>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: m.kicker.quote ? 14 : 13.5,
                      lineHeight: 1.6,
                      color: "var(--text)",
                      fontStyle: m.kicker.quote ? "italic" : "normal",
                    }}
                  >
                    {m.kicker.quote ? `\u201C${m.kicker.body}\u201D` : m.kicker.body}
                  </p>
                </div>
              </div>
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── 5 · SCRIPTS ───────────────────────── */

const SCRIPTS: { title: string; when: string; body: string }[] = [
  {
    title: "Cold call — the opener",
    when: "Your primary first touch. The phone is where deals start. Hook them in under 30 seconds.",
    body: `"Hey, is this [First name]? … Hi [First name], it's [Your name] — I'll be quick, I know you're busy. I help [niche] businesses around [City] get more booked customers off their website, and I actually took a look at [Business] before I called.

The reason I'm reaching out: [one specific finding — e.g. your site takes about [X] seconds to load on a phone, and there's no easy way to book without calling]. For a business doing your kind of volume, that's quietly costing you customers every week.

I put together a quick breakdown showing exactly where — no charge, no pitch. Can I walk you through the two biggest things real quick, or would it be easier if I sent it over and we grabbed two minutes later this week?"`,
  },
  {
    title: "Getting past the gatekeeper",
    when: "When a receptionist or staff member picks up. Stay friendly, assume the connection.",
    body: `"Hey, could you do me a favor and put me through to [Owner first name]? … It's [Your name] — just tell them it's about a couple things I noticed on the [Business] website that are costing them bookings. They'll know what it's about. Appreciate you."

If pushed: "Totally fair — I'm honestly not selling anything today, I actually built them a free breakdown. What's the best way to get it in front of [Owner]?"`,
  },
  {
    title: "Voicemail — if they don't pick up",
    when: "No answer. Under 20 seconds, then follow with a quick text.",
    body: `"Hi [First name], this is [Your name] — I help [niche] businesses turn more website visitors into booked customers. I pulled some specifics on [Business] and found a couple quick wins I think you'd want to see. I'll shoot you a text too — give me a call back at [number] when you get a sec. Thanks, [First name]."`,
  },
  {
    title: "Text / email follow-up — secondary",
    when: "After a call or voicemail, or when phone isn't landing. Reference the call, keep it short.",
    body: `Subject: the [Business] breakdown I mentioned

Hi [First name] — [Your name] here, tried giving you a call earlier. Like I mentioned, I took a look at [Business] and noticed your site takes about [X] seconds to load on mobile, with no clear way to book without calling — that combination quietly costs local businesses a lot of leads.

I put together a short teardown showing exactly where you're losing customers, plus a rewritten homepage built to convert. No charge, no pitch. Want me to send it over, or is there a better time to call?

[Your name] · [number]`,
  },
  {
    title: "Cold DM — backup channel",
    when: "Instagram / Facebook DM when you can't reach them by phone. Casual and specific.",
    body: `Hey [First name] — love what you're doing at [Business]. Tried reaching you by phone earlier. Quick thing: I noticed your site doesn't have any follow-up or text reminders set up, so you're probably losing booked customers to no-shows. I built a quick breakdown of how to fix it for a business like yours — want me to send it over? No charge.`,
  },
  {
    title: "Loom / demo walkthrough",
    when: "Recorded screen-share of the audit. 3–5 minutes.",
    body: `Hey [First name], made you a quick video.

[0:00] Here's your site as it is today — watch how long the top loads on mobile.
[0:45] Here's the same page next to [Competitor], who's ranking above you. Notice the difference in the headline and the call-to-action.
[1:30] This is the rewritten version I built for you — clear promise up top, one obvious next step, trust signals right where buyers look.
[2:30] And here's the part most businesses miss — the follow-up. When someone fills this out, here's the email and text sequence that brings them back.
[4:00] If this looks useful, I'd love to walk you through the full system. Reply here or grab a time at [link].`,
  },
  {
    title: "Discovery call opener",
    when: "Start of a live call. Set the frame, then listen.",
    body: `Thanks for hopping on, [First name]. Before I show you anything, I want to make sure this is actually useful for you — so I'm going to ask a few quick questions about how you get customers today, then I'll walk you through what I found. Sound good?

So right now, when someone's interested in [service] — what's the path? How do they find you and what happens next?`,
  },
  {
    title: "Presenting the price",
    when: "After they've seen the value and agree the gap is real.",
    body: `So here's how it works. There's a one-time build of $6,500 — that's the full system: the page, the lead scoring, the email and text follow-up, and the booking flow, all built from your real numbers. Then it's $1,000 a month for me to run it, test it, and keep improving it — that starts at go-live, not today, and it's cancel anytime.

Here's the way I'd think about it: your average customer is worth about [$X]. If this system books you even [3–4] extra customers a month that you would've lost, it's already paid for itself — everything past that is profit. Want to get started?`,
  },
  {
    title: "Follow-up nudge",
    when: "2–4 days after the proposal, no reply.",
    body: `Hey [First name] — just floating this back up. I'm onboarding [one or two] new clients this month and want to make sure I hold a spot for [Business] if the timing's right. Any questions on the proposal I can answer? Happy to jump on a quick call.`,
  },
];

function Scripts() {
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <SectionHead
        eyebrow="Scripts & Talk Tracks"
        title="Word-for-word, ready to dial"
        sub="The sequence, phone first — with text, email, and DM as backup. Change the bracketed details, keep the structure. It's built to open the conversation live, then frame the value before price ever comes up."
      />
      {SCRIPTS.map((s) => (
        <Surface key={s.title} padded={0} style={{ padding: "22px 24px" }}>
          <div className="flex items-start justify-between" style={{ gap: 12, marginBottom: 6 }}>
            <div style={{ minWidth: 0 }}>
              <h3
                className="lg-display"
                style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: "-0.012em", color: "var(--text)" }}
              >
                {s.title}
              </h3>
              <div className="flex items-center" style={{ gap: 7, marginTop: 5, fontSize: 12, color: "var(--text-3)" }}>
                <Clock size={12} strokeWidth={1.75} />
                {s.when}
              </div>
            </div>
            <CopyButton text={s.body} label="Copy script" />
          </div>
          <pre
            style={{
              margin: "12px 0 0",
              padding: "16px 18px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.22)",
              border: "1px solid var(--line)",
              fontSize: 13,
              lineHeight: 1.65,
              color: "var(--text-2)",
              whiteSpace: "pre-wrap",
              fontFamily: "var(--font-sans), system-ui, sans-serif",
            }}
          >
            {s.body}
          </pre>
        </Surface>
      ))}
    </div>
  );
}

/* ───────────────────────── 6 · DISCOVERY ───────────────────────── */

const DISCOVERY: { group: string; color: string; questions: string[] }[] = [
  {
    group: "Current state",
    color: "var(--accent)",
    questions: [
      "Walk me through what happens when a new lead comes in today — start to finish.",
      "How are most of your customers finding you right now?",
      "What are you using for your website and booking — and who manages it?",
    ],
  },
  {
    group: "Lead flow & conversion",
    color: "var(--accent)",
    questions: [
      "Roughly how many leads or inquiries do you get a month?",
      "Of those, how many actually become customers — and do you know why the rest don't?",
      "What happens to a lead that doesn't book right away? Do you follow up?",
    ],
  },
  {
    group: "Pain & cost",
    color: "var(--warn)",
    questions: [
      "What's a customer worth to you on average — first job and over time?",
      "If you booked even a few more customers a month, what would that mean for the business?",
      "What's frustrated you most about marketing or your website so far?",
    ],
  },
  {
    group: "Decision & timing",
    color: "var(--money)",
    questions: [
      "Besides you, is anyone else involved in a decision like this?",
      "If we found something that clearly works, is this something you'd want to move on soon — or later in the year?",
      "What would you need to see to feel confident saying yes?",
    ],
  },
];

function Discovery() {
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <SectionHead
        eyebrow="Discovery Questions"
        title="Ask these before you pitch anything"
        sub="Great discovery does the selling for you. Get them describing their own leaky funnel and quantifying what a customer is worth — then your offer lands against numbers they said out loud."
      />
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {DISCOVERY.map((d) => (
          <Block key={d.group} title={d.group} accent={d.color}>
            <div className="flex flex-col" style={{ gap: 12 }}>
              {d.questions.map((q, i) => (
                <Point key={i} color={d.color}>
                  {q}
                </Point>
              ))}
            </div>
          </Block>
        ))}
      </div>
      <Surface padded={0} style={{ padding: "18px 22px", background: "var(--accent-soft)", border: "1px solid oklch(0.55 0.18 248 / 0.22)" }}>
        <div className="flex items-start" style={{ gap: 12 }}>
          <Quote size={18} strokeWidth={1.75} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)" }}>
            <strong style={{ color: "var(--text)" }}>Rule of thumb:</strong> talk 30%, listen 70%. The
            moment they say &ldquo;yeah, we don&apos;t really follow up&rdquo; or quote you a customer&apos;s
            value — write it down and repeat it back when you present.
          </p>
        </div>
      </Surface>
    </div>
  );
}

/* ───────────────────────── 7 · OBJECTIONS ───────────────────────── */

const OBJECTIONS: { objection: string; reframe: string; response: string }[] = [
  {
    objection: "It's too expensive.",
    reframe: "Shift from cost to cost-of-inaction.",
    response:
      "I get it — let's look at it differently. What's one customer worth to you? If this books you even three or four extra a month that you're losing today, it pays for itself and then some. The real question isn't whether it's expensive — it's how much the leaky funnel is costing you every month you leave it.",
  },
  {
    objection: "We already have a website.",
    reframe: "A website isn't a system.",
    response:
      "Totally — and it probably looks fine. But a website is a brochure; what I build is a system. Your site doesn't score leads, follow up by email and text, or recover no-shows automatically. That's where the customers are actually slipping through, and that's what this fixes.",
  },
  {
    objection: "We tried marketing before and it didn't work.",
    reframe: "Most 'marketing' is traffic, not conversion.",
    response:
      "That's exactly why this is different. Most agencies sell you more traffic and hope it converts. I'm not touching your ad spend — I'm fixing what happens after someone's already interested, so the leads you're paying for actually turn into booked customers. It's grounded in your real data, not guesswork.",
  },
  {
    objection: "I need to think about it / talk to my partner.",
    reframe: "Surface the real hesitation.",
    response:
      "Of course — this should be a clear yes, not a maybe. Just so I can be helpful: is it the investment, the timing, or whether it'll actually work for your business? Let's talk through whichever one it is now, and I'm glad to send a short summary you can share with your partner.",
  },
  {
    objection: "We're too busy right now.",
    reframe: "Busy is the reason to do it.",
    response:
      "Honestly, that's the best reason to put this in place — it runs the follow-up and booking so you don't have to. And it's done-for-you: I build everything, you just approve. The lift on your side is about an hour. Being too busy to capture leads is exactly the problem this solves.",
  },
  {
    objection: "Can you just do one part / make it cheaper?",
    reframe: "Protect the system; flex the scope.",
    response:
      "I can definitely start smaller — the audit and the new page are the highest-leverage piece, so we could begin there. What I won't do is water down the build itself, because half a system gets half the result. Want to start with the page and add the follow-up once you see it working?",
  },
  {
    objection: "How do I know this will actually work?",
    reframe: "Point back to the proof you already gave.",
    response:
      "Fair question. You've already seen the audit — that's real analysis of your site, not a promise. I build everything from your actual numbers and competitors, and we track results monthly so you can see the lift. If it's not moving the needle, you'll know fast, and the retainer is month-to-month.",
  },
];

function Objections() {
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <SectionHead
        eyebrow="Objection Handling"
        title="An answer for every pushback"
        sub="Objections aren't rejection — they're requests for more confidence. Reframe first, then respond. Never discount on the first objection; defend the value instead."
      />
      {OBJECTIONS.map((o) => (
        <Surface key={o.objection} padded={0} style={{ padding: "22px 24px" }}>
          <div className="flex items-start" style={{ gap: 12, marginBottom: 12 }}>
            <div
              className="grid place-items-center flex-none"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "var(--warn-soft)",
                color: "var(--warn)",
                border: "1px solid oklch(0.55 0.14 75 / 0.3)",
              }}
            >
              <ShieldCheck size={15} strokeWidth={1.75} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="lg-display" style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>
                &ldquo;{o.objection}&rdquo;
              </div>
              <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 4, fontWeight: 600 }}>
                {o.reframe}
              </div>
            </div>
          </div>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid var(--line)",
            }}
          >
            <div className="flex items-center justify-between" style={{ gap: 12, marginBottom: 8 }}>
              <span
                className="lg-mono"
                style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--money)" }}
              >
                Your response
              </span>
              <CopyButton text={o.response} />
            </div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--text-2)" }}>{o.response}</p>
          </div>
        </Surface>
      ))}
    </div>
  );
}

/* ───────────────────────── 8 · POSITIONING ───────────────────────── */

function Positioning() {
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <SectionHead
        eyebrow="Positioning"
        title="Why you — not the agency, the freelancer, or DIY"
        sub="You're not competing on price or being 'a marketer.' You're the operator who installs the acquisition system a business is missing and runs it. Hold that frame in every conversation."
      />

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <VsCard
          them="Big agency"
          theirWeakness="Expensive retainers, slow, treats them like account #400, sells traffic and reports."
          you="Senior attention, fast, and focused on the part that actually books customers — built from their real data."
        />
        <VsCard
          them="Cheap freelancer"
          theirWeakness="Builds a one-off page and disappears. No system, no follow-up, no accountability."
          you="A complete, connected system plus an operator who runs and improves it every month."
        />
        <VsCard
          them="Doing it themselves"
          theirWeakness="No time, no expertise, half-finished tools that never get used or optimized."
          you="Done-for-you and grounded in proven structure — they approve, you build and run it."
        />
      </div>

      <Block title="The core narrative" accent="var(--accent)">
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: "var(--text-2)" }}>
          &ldquo;Most local businesses don&apos;t have a traffic problem — they have a system problem.
          People find them, get a little interested, and then nothing happens: no follow-up, no
          reminders, no reason to come back. I build the system that catches every one of those
          leads — a page that converts, scoring that prioritizes the real buyers, and email + text
          follow-up that brings people back — all built from your real numbers. Then I run it so it
          keeps getting better. You keep doing what you&apos;re great at; I make sure none of your
          demand goes to waste.&rdquo;
        </p>
        <div style={{ marginTop: 16 }}>
          <CopyButton
            label="Copy narrative"
            text={
              "Most local businesses don't have a traffic problem — they have a system problem. People find them, get a little interested, and then nothing happens: no follow-up, no reminders, no reason to come back. I build the system that catches every one of those leads — a page that converts, scoring that prioritizes the real buyers, and email + text follow-up that brings people back — all built from your real numbers. Then I run it so it keeps getting better. You keep doing what you're great at; I make sure none of your demand goes to waste."
            }
          />
        </div>
      </Block>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Block title="Words that work">
          <div className="flex flex-col" style={{ gap: 10 }}>
            <Point color="var(--money)">&ldquo;System&rdquo; and &ldquo;infrastructure&rdquo; — not &ldquo;website&rdquo; or &ldquo;marketing.&rdquo;</Point>
            <Point color="var(--money)">&ldquo;Booked, paying customers&rdquo; — not &ldquo;leads&rdquo; or &ldquo;traffic.&rdquo;</Point>
            <Point color="var(--money)">&ldquo;Built from your real numbers&rdquo; — emphasize the grounding.</Point>
            <Point color="var(--money)">&ldquo;I run it for you&rdquo; — sell the done-for-you relief.</Point>
          </div>
        </Block>
        <Block title="Words to avoid">
          <div className="flex flex-col" style={{ gap: 10 }}>
            <Point color="var(--warn)">&ldquo;Cheap&rdquo; or &ldquo;affordable&rdquo; — competes on the wrong axis.</Point>
            <Point color="var(--warn)">&ldquo;Maybe&rdquo; / &ldquo;might&rdquo; / &ldquo;could possibly&rdquo; — kills confidence.</Point>
            <Point color="var(--warn)">Jargon: &ldquo;funnel optimization,&rdquo; &ldquo;CRO,&rdquo; &ldquo;omnichannel.&rdquo;</Point>
            <Point color="var(--warn)">Over-promising specific revenue numbers you can&apos;t guarantee.</Point>
          </div>
        </Block>
      </div>
    </div>
  );
}

function VsCard({ them, theirWeakness, you }: { them: string; theirWeakness: string; you: string }) {
  return (
    <Surface padded={0} style={{ padding: "20px 22px" }}>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}>vs.</div>
      <div className="lg-display" style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
        {them}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--warn)", marginBottom: 5 }}>Their weakness</div>
      <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.55, color: "var(--text-2)" }}>{theirWeakness}</p>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--money)", marginBottom: 5 }}>Your edge</div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-2)" }}>{you}</p>
    </Surface>
  );
}

/* ───────────────────────── styles ───────────────────────── */

const ghostChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "0 14px",
  height: 30,
  fontSize: 13,
  fontWeight: 600,
  background: "transparent",
  border: "1px solid var(--line-strong)",
  borderRadius: "var(--radius)",
  color: "var(--text)",
  cursor: "pointer",
  fontFamily: "inherit",
};
