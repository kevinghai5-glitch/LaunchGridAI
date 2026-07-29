import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { Surface, Pill, PanelHeader, KpiCard } from "@/components/dashboard/os";
import { ExternalLink, Copy, Link as LinkIcon, Eye, Check, Mail, Phone, FileText } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

function relTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

type Tone = "neutral" | "accent" | "money" | "warn" | "danger";
const STATUS_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  SENT: "accent",
  VIEWED: "accent",
  ACCEPTED: "money",
  REJECTED: "danger",
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Opened",
  ACCEPTED: "Won",
  REJECTED: "Lost",
};

export default async function ProposalsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const proposals = await prisma.proposal.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { business: true },
  });

  const closedMRR = proposals.reduce((s, p) => (p.status === "ACCEPTED" ? s + p.monthlyPrice : s), 0);
  const inMotion = proposals.filter((p) => ["SENT", "VIEWED"].includes(p.status));
  const pipelineMRR = inMotion.reduce((s, p) => s + p.monthlyPrice, 0);

  // Real buyer-activity timeline derived from actual proposal state changes.
  type Tl = {
    at: number;
    when: string;
    tone: Tone;
    icon: "eye" | "phone" | "mail" | "check";
    who: string;
    what: string;
    meta: string;
    highlight?: boolean;
  };
  const timeline: Tl[] = proposals
    .filter((p) => p.status !== "DRAFT")
    .map((p) => {
      const place = [p.business.industry, p.business.city].filter(Boolean).join(" · ");
      if (p.status === "ACCEPTED") {
        return {
          at: p.updatedAt.getTime(),
          when: relTime(p.updatedAt),
          tone: "money" as Tone,
          icon: "check" as const,
          who: p.business.name,
          what: "signed the retainer",
          meta: `${formatCurrency(p.monthlyPrice)}/mo`,
          highlight: true,
        };
      }
      if (p.status === "REJECTED") {
        return {
          at: p.updatedAt.getTime(),
          when: relTime(p.updatedAt),
          tone: "danger" as Tone,
          icon: "mail" as const,
          who: p.business.name,
          what: "passed on the proposal",
          meta: place || "no longer in pipeline",
        };
      }
      if (p.status === "VIEWED") {
        return {
          at: p.updatedAt.getTime(),
          when: relTime(p.updatedAt),
          tone: "accent" as Tone,
          icon: "eye" as const,
          who: p.business.name,
          what: "opened the proposal",
          meta: place || "awaiting decision",
        };
      }
      return {
        at: p.createdAt.getTime(),
        when: relTime(p.createdAt),
        tone: "accent" as Tone,
        icon: "mail" as const,
        who: p.business.name,
        what: "proposal sent",
        meta: place || "awaiting open",
      };
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, 6);

  return (
    <>
      <TopBar title="Proposals" subtitle="All time" />
      <div style={{ padding: "40px 56px 80px", maxWidth: 1280, margin: "0 auto" }}>
        {/* Editorial header */}
        <div className="rise" style={{ marginBottom: 32 }}>
          <h1
            className="lg-display"
            style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text)" }}
          >
            Proposals
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--text-3)", marginTop: 6 }}>
            {/* Money goes through the one formatter. A literal "$" in JSX text is
                how two of these escaped every previous sweep — it reads as prose,
                not as a number, so nothing that scanned for a formatter call saw
                it. Same law as everywhere else: the marker goes BEFORE the figure. */}
            {proposals.length} total · {formatCurrency(pipelineMRR)} in motion ·{" "}
            {formatCurrency(closedMRR)} closed
          </div>
        </div>

        {/* KPI row */}
        <div className="rise grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 32 }}>
          <KpiCard label="Sent this month" value={String(inMotion.length)} sub="Awaiting reply" />
          <KpiCard
            label="Open rate"
            value={
              inMotion.length
                ? `${Math.round((proposals.filter((p) => p.status === "VIEWED").length / Math.max(inMotion.length, 1)) * 100)}%`
                : "—"
            }
            sub="Of sent proposals"
          />
          <KpiCard label="Closed MRR" value={formatCurrency(closedMRR)} sub={`${proposals.filter((p) => p.status === "ACCEPTED").length} won`} color="money" />
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
          {/* main list */}
          <div>
            <div className="flex items-center" style={{ marginBottom: 14, gap: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>
                All proposals
                <span className="lg-mono" style={{ fontSize: 10.5, color: "var(--text-4)", marginLeft: 6 }}>
                  {proposals.length}
                </span>
              </span>
              <span style={{ flex: 1 }} />
              <Link href="/proposals/new">
                <LgButton variant="primary" size="sm" icon="plus">
                  New proposal
                </LgButton>
              </Link>
            </div>

            {proposals.length === 0 ? (
              <Surface style={{ padding: 48, textAlign: "center" }}>
                <FileText size={28} strokeWidth={1.5} style={{ color: "var(--text-4)", margin: "0 auto 14px" }} />
                <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>No proposals yet</div>
                <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--text-3)" }}>
                  Create your first proposal and start closing recurring clients.
                </p>
                <Link href="/proposals/new">
                  <LgButton variant="secondary" size="sm" icon="plus">
                    Create proposal
                  </LgButton>
                </Link>
              </Surface>
            ) : (
              <div className="rise" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {proposals.map((p) => (
                  <ProposalRow
                    key={p.id}
                    id={p.id}
                    business={p.business.name}
                    title={p.title}
                    city={p.business.city ?? undefined}
                    industry={p.business.industry ?? undefined}
                    price={p.monthlyPrice}
                    status={p.status}
                    sent={formatDate(p.createdAt)}
                    publicId={p.publicId}
                  />
                ))}
              </div>
            )}
          </div>

          {/* activity rail */}
          <Surface padded={0} style={{ position: "sticky", top: 80, alignSelf: "start" }}>
            <PanelHeader
              title="Buyer activity"
              sub="From your proposals"
              right={timeline.length > 0 ? <Pill tone="accent" dot>live</Pill> : undefined}
            />
            <div style={{ padding: "8px 8px 14px" }}>
              {timeline.length === 0 ? (
                <div style={{ padding: "20px 12px", fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.5 }}>
                  No buyer activity yet. Send a proposal and tracked events — opens, signatures, passes — will show up here.
                </div>
              ) : (
                timeline.map((t, i) => (
                  <TimelineEvent
                    key={i}
                    when={t.when}
                    tone={t.tone}
                    icon={t.icon}
                    who={t.who}
                    what={t.what}
                    meta={t.meta}
                    highlight={t.highlight}
                  />
                ))
              )}
            </div>
          </Surface>
        </div>
      </div>
    </>
  );
}

function ProposalRow({
  id,
  business,
  title,
  city,
  industry,
  price,
  status,
  sent,
  publicId,
}: {
  id: string;
  business: string;
  title: string;
  city?: string;
  industry?: string;
  price: number;
  status: string;
  sent: string;
  publicId: string;
}) {
  const tone = STATUS_TONE[status] ?? "neutral";
  const won = status === "ACCEPTED";
  const meta = [title, industry, city].filter(Boolean).join(" · ");
  return (
    <div className="surface hover-lift" style={{ padding: 0, overflow: "hidden" }}>
      <div className="grid items-stretch" style={{ gridTemplateColumns: "160px 1fr auto" }}>
        {/* thumbnail */}
        <Link
          href={`/proposals/new?id=${id}`}
          style={{
            position: "relative",
            overflow: "hidden",
            background: `linear-gradient(135deg, ${won ? "var(--money)" : "var(--accent)"}18, transparent 60%), var(--bg-deep)`,
            borderRight: "1px solid var(--line)",
            textDecoration: "none",
          }}
        >
          <div className="bg-grid" style={{ position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 12, display: "flex", flexDirection: "column", gap: 5 }}>
            <div
              className="lg-mono"
              style={{ fontSize: 8.5, color: won ? "var(--money)" : "var(--accent)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}
            >
              Proposal
            </div>
            <div
              className="lg-display"
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--text)",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {business}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
              {[80, 60, 70, 50].map((w, i) => (
                <div key={i} style={{ height: 2.5, width: `${w}%`, borderRadius: 99, background: "rgba(255,255,255,0.10)" }} />
              ))}
            </div>
          </div>
        </Link>

        {/* body */}
        <Link
          href={`/proposals/new?id=${id}`}
          style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0, textDecoration: "none", color: "inherit" }}
        >
          <div className="flex items-center" style={{ gap: 8, flexWrap: "wrap" }}>
            <Pill tone={tone} dot={["SENT", "VIEWED"].includes(status)}>
              {STATUS_LABEL[status] ?? status}
            </Pill>
            <span className="lg-mono" style={{ fontSize: 11, color: "var(--text-4)" }}>
              {status === "DRAFT" ? "not sent yet" : `sent ${sent}`}
            </span>
          </div>
          <div className="lg-display" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {business}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>{meta}</div>
        </Link>

        {/* right rail */}
        <div
          className="flex flex-col items-end justify-between"
          style={{
            padding: "16px 20px",
            gap: 12,
            borderLeft: "1px solid var(--line)",
            minWidth: 160,
            background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.15))",
          }}
        >
          <div style={{ textAlign: "right" }}>
            <div className="lg-mono" style={{ fontSize: 10, color: "var(--text-4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Monthly
            </div>
            <div
              className="lg-display tnum"
              style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.022em", color: won ? "var(--money)" : "var(--text)" }}
            >
              {formatCurrency(price)}
              <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>/mo</span>
            </div>
          </div>
          <div className="flex" style={{ gap: 6 }}>
            <a href={`/p/${publicId}`} target="_blank" rel="noopener noreferrer" aria-label="Open public proposal" style={btnSm}>
              <ExternalLink size={12} strokeWidth={1.75} />
            </a>
            <span style={btnSm}><LinkIcon size={12} strokeWidth={1.75} /></span>
            <span style={btnSm}><Copy size={12} strokeWidth={1.75} /></span>
          </div>
        </div>
      </div>
    </div>
  );
}

const btnSm: React.CSSProperties = {
  width: 28,
  height: 28,
  display: "grid",
  placeItems: "center",
  background: "var(--surface-hi)",
  border: "1px solid var(--line-strong)",
  borderRadius: 7,
  color: "var(--text-2)",
  cursor: "pointer",
};

function TimelineEvent({
  when,
  tone,
  icon,
  who,
  what,
  meta,
  highlight,
}: {
  when: string;
  tone: Tone;
  icon: "eye" | "phone" | "mail" | "check";
  who: string;
  what: string;
  meta: string;
  highlight?: boolean;
}) {
  const c =
    tone === "money" ? "var(--money)" : tone === "warn" ? "var(--warn)" : tone === "accent" ? "var(--accent)" : "var(--text-3)";
  const Icon = icon === "eye" ? Eye : icon === "phone" ? Phone : icon === "mail" ? Mail : Check;
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 12px",
        background: highlight ? "linear-gradient(90deg, oklch(0.55 0.16 158 / 0.06), transparent 70%)" : "transparent",
        borderLeft: highlight ? "2px solid var(--money)" : "2px solid transparent",
        borderRadius: 6,
      }}
    >
      <div
        className="grid place-items-center"
        style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: "rgba(255,255,255,0.03)", border: `1px solid ${c}30`, color: c }}
      >
        <Icon size={12} strokeWidth={1.75} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: "var(--text)" }}>
          <span style={{ fontWeight: 600 }}>{who}</span> <span style={{ color: "var(--text-2)" }}>{what}</span>
        </div>
        <div className="lg-mono" style={{ fontSize: 10.5, color: "var(--text-4)", marginTop: 2 }}>
          {meta}
        </div>
      </div>
      <span className="lg-mono" style={{ fontSize: 10.5, color: "var(--text-3)", whiteSpace: "nowrap" }}>
        {when}
      </span>
    </div>
  );
}
