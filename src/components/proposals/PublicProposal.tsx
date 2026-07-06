"use client";

import React from "react";
import { Zap } from "lucide-react";
import type { ProposalContent } from "@/types";

// The client-facing conversion proposal. Self-contained light/consulting design
// (same language as the deliverables: warm paper, single muted-gold accent, serif
// headings + Inter body, hairline borders, no gradients/animation) so it reads
// identically on the public link and in the builder's dark preview frame.
//
// Framed entirely around CONVERSION — turning leads the business already pays for
// into booked customers — never lead generation. A print-safe plain-language
// layer (ⓘ markers + glossary) explains genuine jargon, mirroring the deliverables.

interface PublicProposalProps {
  business: { name: string; industry?: string | null; city?: string | null };
  content: ProposalContent;
  mobile?: boolean;
}

// ── Plain-language clarification layer (ⓘ + glossary, print-safe) ──────────────
interface GlossaryTerm {
  term: string;
  def: string;
}
const GLOSSARY: GlossaryTerm[] = [
  { term: "speed-to-lead", def: "How fast you respond to a new lead. The faster you reply, the far more likely they are to book — minutes matter, not hours." },
  { term: "conversion", def: "Turning a lead you already have into a booked, paying customer. This system lifts that rate; it does not buy you more leads." },
  { term: "qualification", def: "Sorting incoming leads so your time goes to the ones most likely to become paying customers." },
  { term: "follow-up", def: "Staying in front of leads who aren't ready yet with timely, helpful messages so they choose you when they are." },
  { term: "no-show", def: "A booked appointment where the person doesn't turn up — confirmations and reminders bring this down." },
  { term: "retainer", def: "The ongoing monthly engagement that keeps the system running and continuously optimised." },
  { term: "routing", def: "Automatically sending each lead to the right person or next step instantly, so nothing waits in an inbox." },
];

function termRegex(term: string): RegExp {
  return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}\\b`, "i");
}

function InfoTerm({ g }: { g: GlossaryTerm }) {
  return (
    <span className="lgp-info" tabIndex={0} role="note" aria-label={`What does ${g.term} mean?`}>
      &#9432;
      <span className="lgp-pop">
        <strong>{g.term}.</strong> {g.def}
      </span>
    </span>
  );
}

// Render a string, inserting a ⓘ marker after the FIRST document-wide occurrence
// of each glossary term. `used` is shared across the whole proposal so each term
// is annotated once. Mutating during render is deterministic in a single pass.
function annotate(text: string, used: Set<string>): React.ReactNode {
  if (!text) return text;
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  // Repeatedly find the earliest not-yet-used term in the remaining string.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let best: { idx: number; g: GlossaryTerm; len: number } | null = null;
    for (const g of GLOSSARY) {
      if (used.has(g.term)) continue;
      const m = termRegex(g.term).exec(rest);
      if (m && (best === null || m.index < best.idx)) {
        best = { idx: m.index, g, len: m[0].length };
      }
    }
    if (!best) break;
    used.add(best.g.term);
    nodes.push(rest.slice(0, best.idx + best.len));
    nodes.push(<InfoTerm key={`i${key++}`} g={best.g} />);
    rest = rest.slice(best.idx + best.len);
  }
  nodes.push(rest);
  return nodes;
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

export function PublicProposal({ business, content, mobile }: PublicProposalProps) {
  const used = new Set<string>(); // shared across the whole document for ⓘ markers
  const a = (t: string) => annotate(t, used);

  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const preparedBy = content.agencyName?.trim() ? content.agencyName.trim() : "our team";
  const market = [business.city, business.industry].filter(Boolean).join(" · ");

  // Determine which glossary terms ended up used so the backstop lists only them.
  // (Computed after the body renders below via a second pass on the source text.)
  const allText = [
    content.problem?.summary,
    ...(content.problem?.leaks ?? []).flatMap((l) => [l.title, l.detail]),
    ...(content.deliverables ?? []).flatMap((d) => [d.name, d.addresses, d.detail]),
    content.packageOverview,
    content.roi?.summary,
    ...(content.roi?.points ?? []),
    ...(content.scope?.included ?? []),
    ...(content.scope?.excluded ?? []),
    ...(content.timeline ?? []).flatMap((p) => [p.label, p.detail]),
    content.nextSteps,
    ...(content.faq ?? []).flatMap((f) => [f.q, f.a]),
  ]
    .filter(Boolean)
    .join("  ");
  const presentTerms = GLOSSARY.filter((g) => termRegex(g.term).test(allText));

  return (
    <div className={`lgp${mobile ? " is-mobile" : ""}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* 1 — Header */}
      <header className="lgp-header">
        <div className="lgp-eyebrow">Client Conversion Proposal</div>
        <h1 className="lgp-title">{content.title}</h1>
        <div className="lgp-meta">
          <div className="lgp-mi">
            <span className="lgp-k">Prepared for</span>
            <span className="lgp-v">{business.name}</span>
          </div>
          {market && (
            <div className="lgp-mi">
              <span className="lgp-k">Market</span>
              <span className="lgp-v">{market}</span>
            </div>
          )}
          <div className="lgp-mi">
            <span className="lgp-k">Prepared by</span>
            <span className="lgp-v">{preparedBy}</span>
          </div>
          <div className="lgp-mi">
            <span className="lgp-k">Date</span>
            <span className="lgp-v">{date}</span>
          </div>
        </div>
      </header>

      {/* 2 — The problem (from the audit) */}
      <Section n="01" title="What's leaking right now">
        <p className="lgp-lead">{a(content.problem?.summary ?? "")}</p>
        {content.problem?.basis && (
          <div className="lgp-basis">
            <span className="lgp-ico">&#9432;</span>
            <span>{content.problem.basis}</span>
          </div>
        )}
        {(content.problem?.leaks ?? []).map((l, i) => (
          <div className="lgp-leak" key={i}>
            <div className="lgp-leak-head">
              <span className="lgp-leak-t">{a(l.title)}</span>
              {l.monthlyCost && <span className="lgp-cost">{l.monthlyCost}</span>}
            </div>
            <p>{a(l.detail)}</p>
          </div>
        ))}
      </Section>

      {/* 3 — What we deploy */}
      <Section n="02" title="What we deploy">
        <p className="lgp-lead">{a(content.packageOverview)}</p>
        {(content.deliverables ?? []).map((c, i) => (
          <div className={`lgp-comp${c.isRetainer ? " is-retainer" : ""}`} key={i}>
            <div className="lgp-comp-head">
              <span className="lgp-comp-t">{a(c.name)}</span>
              {c.isRetainer && <span className="lgp-badge">Runs continuously</span>}
            </div>
            {c.addresses && (
              <div className="lgp-closes">
                Closes: <strong>{a(c.addresses)}</strong>
              </div>
            )}
            <p>{a(c.detail)}</p>
          </div>
        ))}
      </Section>

      {/* 4 — The investment (two-part) */}
      <Section n="03" title="The investment">
        <div className="lgp-invest">
          <div className="lgp-price">
            <div className="lgp-price-k">One-time setup</div>
            <div className="lgp-price-v">
              {fmtMoney(content.setupFee)} <span className="lgp-cad">CAD</span>
            </div>
            <p className="lgp-price-d">
              Done-for-you build of every component in your scope — we design, build,
              and deploy the entire system for you.
            </p>
          </div>
          <div className="lgp-price">
            <div className="lgp-price-k">Monthly retainer</div>
            <div className="lgp-price-v">
              {fmtMoney(content.monthlyPrice)} <span className="lgp-cad">CAD / mo</span>
            </div>
            <p className="lgp-price-d">
              {a(
                "Keeps the qualification engine running continuously, plus ongoing management, optimisation, and a monthly performance report."
              )}
            </p>
          </div>
        </div>
      </Section>

      {/* 5 — ROI framing */}
      {content.roi && (
        <Section n="04" title="The return">
          <p className="lgp-lead">{a(content.roi.summary)}</p>
          {content.roi.recovered && (
            <div className="lgp-callout">
              <div className="lgp-callout-k">Estimated conversions recovered</div>
              <div className="lgp-callout-v">{content.roi.recovered}</div>
            </div>
          )}
          {content.roi.points?.length > 0 && (
            <ul className="lgp-list">
              {content.roi.points.map((p, i) => (
                <li key={i}>{a(p)}</li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* 6 — Scope */}
      {content.scope && (
        <Section n="05" title="Scope">
          <div className="lgp-scope">
            <div>
              <div className="lgp-scope-h lgp-in">What's included</div>
              <ul className="lgp-list">
                {content.scope.included.map((s, i) => (
                  <li key={i}>{a(s)}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="lgp-scope-h lgp-out">What's not included</div>
              <ul className="lgp-list lgp-list-out">
                {content.scope.excluded.map((s, i) => (
                  <li key={i}>{a(s)}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      )}

      {/* 7 — Timeline */}
      {content.timeline && content.timeline.length > 0 && (
        <Section n="06" title="Timeline">
          <div className="lgp-timeline">
            {content.timeline.map((p, i) => (
              <div className="lgp-phase" key={i}>
                <div className="lgp-phase-n">{i + 1}</div>
                <div className="lgp-phase-body">
                  <div className="lgp-phase-l">{p.label}</div>
                  <p>{a(p.detail)}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 8 — Proof */}
      {content.proof && (
        <Section n="07" title="Proof">
          {content.proof.testimonials.length > 0 ? (
            content.proof.testimonials.map((t, i) => (
              <blockquote className="lgp-quote" key={i}>
                <p>&ldquo;{t.quote}&rdquo;</p>
                <cite>— {t.attribution}</cite>
              </blockquote>
            ))
          ) : (
            <p className="lgp-muted">{content.proof.note}</p>
          )}
        </Section>
      )}

      {/* 9 — Next step */}
      <Section n="08" title="Next step">
        <p className="lgp-lead">{a(content.nextSteps ?? "")}</p>
      </Section>

      {/* 10 — FAQ */}
      {content.faq && content.faq.length > 0 && (
        <Section n="09" title="Common questions">
          {content.faq.map((f, i) => (
            <div className="lgp-faq" key={i}>
              <div className="lgp-faq-q">{f.q}</div>
              <p>{a(f.a)}</p>
            </div>
          ))}
        </Section>
      )}

      {/* Glossary (print-safe backstop for the ⓘ markers) */}
      {presentTerms.length > 0 && (
        <Section n="10" title="Plain-English glossary">
          <dl className="lgp-gl">
            {presentTerms.map((g) => (
              <div className="lgp-gl-item" key={g.term}>
                <dt>{g.term}</dt>
                <dd>{g.def}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <footer className="lgp-footer">
        Confidential — prepared for {business.name}
        {preparedBy !== "our team" ? ` · ${preparedBy}` : ""}
      </footer>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="lgp-sec">
      <div className="lgp-sec-head">
        <span className="lgp-sec-n">{n}</span>
        <h2>{title}</h2>
      </div>
      <div className="lgp-sec-inner">{children}</div>
    </section>
  );
}

// Scoped to .lgp so it renders identically on the light public page and inside the
// builder's dark preview frame. Mirrors the deliverable design language (_shell.ts).
const CSS = `
.lgp {
  --bg:#FBFAF7; --surface:#FFFFFF; --surface-2:#F4F2EC; --ink:#1A1814;
  --ink-muted:#6B6659; --accent:#9A7B3F; --accent-tint:#F2ECDD; --border:#E7E3D8;
  --good:#3F7D5A; --critical:#A8443B;
  --heading:'Source Serif 4',Georgia,'Times New Roman',serif;
  background:var(--bg); color:var(--ink); padding:36px 40px 64px;
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  font-size:15.5px; line-height:1.65; -webkit-font-smoothing:antialiased;
  font-variant-numeric:tabular-nums;
}
.lgp.is-mobile { padding:18px 16px 40px; font-size:13.5px; }
.lgp * { box-sizing:border-box; }
.lgp h1,.lgp h2 { font-family:var(--heading); }
.lgp p { margin:0 0 12px; max-width:68ch; }
.lgp p:last-child { margin-bottom:0; }
.lgp strong { color:var(--ink); font-weight:600; }
.lgp .lgp-muted { color:var(--ink-muted); }

.lgp .lgp-header {
  background:var(--surface); border:1px solid var(--border); border-top:3px solid var(--accent);
  border-radius:4px; padding:40px 40px 30px; margin-bottom:24px;
}
.lgp.is-mobile .lgp-header { padding:24px 20px; }
.lgp .lgp-eyebrow {
  font-family:var(--heading); text-transform:uppercase; letter-spacing:.24em;
  font-size:11px; color:var(--accent); margin-bottom:14px; font-weight:700;
}
.lgp .lgp-title { margin:0 0 22px; font-size:34px; line-height:1.12; letter-spacing:-.015em; font-weight:700; max-width:22ch; }
.lgp.is-mobile .lgp-title { font-size:22px; margin-bottom:16px; }
.lgp .lgp-meta { display:flex; flex-wrap:wrap; gap:0; border-top:1px solid var(--border); padding-top:18px; }
.lgp .lgp-mi { padding-right:28px; margin-right:28px; border-right:1px solid var(--border); margin-bottom:6px; }
.lgp .lgp-mi:last-child { border-right:none; margin-right:0; padding-right:0; }
.lgp.is-mobile .lgp-mi { padding-right:0; margin-right:0; border-right:none; width:50%; }
.lgp .lgp-k { display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.12em; color:var(--ink-muted); margin-bottom:4px; font-weight:600; }
.lgp .lgp-v { display:block; font-size:14px; font-weight:600; color:var(--ink); }

.lgp .lgp-sec { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:30px 36px; margin-bottom:18px; }
.lgp.is-mobile .lgp-sec { padding:20px 18px; }
.lgp .lgp-sec-head { display:flex; align-items:center; gap:14px; margin:0 0 20px; padding:0 0 14px; border-bottom:1px solid var(--border); }
.lgp .lgp-sec-n { font-family:var(--heading); font-size:12px; font-weight:700; color:var(--accent); background:var(--accent-tint); padding:5px 10px; border-radius:6px; line-height:1; }
.lgp .lgp-sec h2 { font-size:22px; margin:0; letter-spacing:-.015em; font-weight:700; line-height:1.2; }
.lgp.is-mobile .lgp-sec h2 { font-size:17px; }
.lgp .lgp-lead { font-size:16px; color:var(--ink); }
.lgp.is-mobile .lgp-lead { font-size:14px; }

.lgp .lgp-basis { display:flex; gap:10px; align-items:flex-start; background:var(--surface-2); border:1px solid var(--border); color:var(--ink-muted); border-radius:8px; padding:12px 16px; font-size:13px; margin:14px 0; }
.lgp .lgp-basis .lgp-ico { color:var(--accent); flex:none; }

.lgp .lgp-leak { border:1px solid var(--border); border-left:3px solid var(--critical); border-radius:0 6px 6px 0; padding:16px 18px; margin:12px 0; background:var(--surface); }
.lgp .lgp-leak-head { display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap; margin-bottom:7px; }
.lgp .lgp-leak-t { font-family:var(--heading); font-weight:700; font-size:16px; letter-spacing:-.01em; }
.lgp .lgp-cost { font-family:var(--heading); font-weight:700; font-size:15px; color:var(--critical); white-space:nowrap; }
.lgp .lgp-leak p { font-size:14px; margin:0; }

.lgp .lgp-comp { border:1px solid var(--border); border-radius:6px; padding:16px 18px; margin:12px 0; background:var(--surface); }
.lgp .lgp-comp.is-retainer { border-color:var(--accent); background:var(--accent-tint); }
.lgp .lgp-comp-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px; }
.lgp .lgp-comp-t { font-family:var(--heading); font-weight:700; font-size:16px; letter-spacing:-.01em; }
.lgp .lgp-badge { display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--accent); background:var(--surface); border:1px solid var(--accent); }
.lgp .lgp-badge::before { content:""; width:6px; height:6px; border-radius:50%; background:var(--accent); }
.lgp .lgp-closes { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-muted); margin-bottom:8px; font-weight:600; }
.lgp .lgp-closes strong { color:var(--accent); text-transform:none; letter-spacing:0; font-weight:700; }
.lgp .lgp-comp p { font-size:14px; }

.lgp .lgp-invest { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px; }
.lgp.is-mobile .lgp-invest { grid-template-columns:1fr; }
.lgp .lgp-price { border:1px solid var(--border); border-radius:6px; padding:20px 22px; background:var(--surface); position:relative; overflow:hidden; }
.lgp .lgp-price::before { content:""; position:absolute; top:0; left:0; right:0; height:3px; background:var(--accent); }
.lgp .lgp-price-k { font-family:var(--heading); font-size:11px; text-transform:uppercase; letter-spacing:.1em; font-weight:700; color:var(--ink-muted); margin-bottom:8px; }
.lgp .lgp-price-v { font-family:var(--heading); font-size:32px; font-weight:700; letter-spacing:-.03em; color:var(--ink); margin-bottom:10px; }
.lgp .lgp-price-v .lgp-cad { font-family:'Inter',sans-serif; font-size:13px; font-weight:600; color:var(--ink-muted); letter-spacing:0; }
.lgp .lgp-price-d { font-size:13px; color:var(--ink-muted); margin:0; }

.lgp .lgp-callout { margin:14px 0; padding:16px 20px; border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:0 6px 6px 0; background:var(--accent-tint); }
.lgp .lgp-callout-k { font-family:var(--heading); font-size:10.5px; text-transform:uppercase; letter-spacing:.14em; font-weight:700; color:var(--ink-muted); margin-bottom:4px; }
.lgp .lgp-callout-v { font-family:var(--heading); font-size:26px; font-weight:700; letter-spacing:-.02em; color:var(--accent); }

.lgp .lgp-list { margin:8px 0 0; padding-left:20px; }
.lgp .lgp-list li { margin:0 0 8px; font-size:14px; }
.lgp .lgp-list li::marker { color:var(--accent); }
.lgp .lgp-list-out li::marker { color:var(--ink-muted); }

.lgp .lgp-scope { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
.lgp.is-mobile .lgp-scope { grid-template-columns:1fr; gap:8px; }
.lgp .lgp-scope-h { font-family:var(--heading); font-size:11px; text-transform:uppercase; letter-spacing:.1em; font-weight:700; margin-bottom:6px; }
.lgp .lgp-scope-h.lgp-in { color:var(--good); }
.lgp .lgp-scope-h.lgp-out { color:var(--ink-muted); }

.lgp .lgp-timeline { display:grid; gap:0; }
.lgp .lgp-phase { display:grid; grid-template-columns:48px 1fr; gap:18px; position:relative; padding-bottom:18px; }
.lgp .lgp-phase::before { content:""; position:absolute; left:23px; top:44px; bottom:-2px; width:1px; background:var(--border); }
.lgp .lgp-phase:last-child { padding-bottom:0; }
.lgp .lgp-phase:last-child::before { display:none; }
.lgp .lgp-phase-n { width:48px; height:48px; border-radius:8px; display:grid; place-items:center; font-family:var(--heading); font-weight:700; font-size:18px; color:var(--accent); background:var(--accent-tint); border:1px solid var(--border); }
.lgp .lgp-phase-l { font-family:var(--heading); font-weight:700; font-size:16px; margin-bottom:5px; letter-spacing:-.01em; }
.lgp .lgp-phase-body p { font-size:14px; }

.lgp .lgp-quote { margin:0 0 14px; background:var(--surface-2); border-left:3px solid var(--accent); border-radius:0 6px 6px 0; padding:18px 22px; }
.lgp .lgp-quote p { font-family:var(--heading); font-size:18px; font-weight:600; line-height:1.4; color:var(--ink); margin:0 0 8px; }
.lgp .lgp-quote cite { font-style:normal; font-size:13px; color:var(--ink-muted); font-weight:600; }

.lgp .lgp-faq { padding:14px 0; border-bottom:1px solid var(--border); }
.lgp .lgp-faq:last-child { border-bottom:none; padding-bottom:0; }
.lgp .lgp-faq-q { font-family:var(--heading); font-weight:700; font-size:15.5px; margin-bottom:6px; }
.lgp .lgp-faq p { font-size:14px; margin:0; color:var(--ink-muted); }

.lgp .lgp-gl { margin:0; }
.lgp .lgp-gl-item { padding:11px 0; border-bottom:1px solid var(--border); display:grid; grid-template-columns:150px 1fr; gap:16px; }
.lgp .lgp-gl-item:last-child { border-bottom:none; }
.lgp.is-mobile .lgp-gl-item { grid-template-columns:1fr; gap:2px; }
.lgp .lgp-gl-item dt { font-family:var(--heading); font-weight:700; font-size:13.5px; color:var(--accent); text-transform:capitalize; }
.lgp .lgp-gl-item dd { margin:0; font-size:13.5px; color:var(--ink); }

.lgp .lgp-info { position:relative; display:inline; cursor:pointer; color:var(--accent); font-weight:700; font-size:.72em; vertical-align:super; line-height:0; margin-left:1px; }
.lgp .lgp-pop { display:none; position:absolute; left:0; top:1.4em; z-index:20; width:260px; padding:10px 13px; background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:0 6px 6px 0; box-shadow:0 6px 24px rgba(26,24,20,.12); font-size:12.5px; line-height:1.5; color:var(--ink); font-weight:400; vertical-align:baseline; }
.lgp .lgp-info:hover .lgp-pop, .lgp .lgp-info:focus .lgp-pop { display:block; }
.lgp .lgp-pop strong { color:var(--accent); }

.lgp .lgp-footer { margin-top:28px; padding-top:18px; border-top:1px solid var(--border); color:var(--ink-muted); font-size:11px; text-transform:uppercase; letter-spacing:.08em; }

@media print {
  .lgp { background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; padding:0; }
  .lgp .lgp-info { display:none; }
  .lgp .lgp-sec, .lgp .lgp-leak, .lgp .lgp-comp, .lgp .lgp-price, .lgp .lgp-phase { break-inside:avoid; }
}
`;

export function BrowserFrame({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div
        className="flex items-center"
        style={{
          height: 36,
          background: "var(--sidebar)",
          borderBottom: "1px solid var(--border)",
          padding: "0 14px",
          gap: 10,
        }}
      >
        <div className="flex" style={{ gap: 6 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div
              key={c}
              style={{ width: 11, height: 11, borderRadius: 99, background: c, opacity: 0.85 }}
            />
          ))}
        </div>
        <div
          className="flex items-center"
          style={{
            flex: 1,
            height: 22,
            borderRadius: 6,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "0 10px",
            gap: 8,
            marginLeft: 12,
          }}
        >
          <Zap size={11} strokeWidth={1.75} style={{ color: "var(--success)" }} />
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono), monospace",
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {url}
          </span>
        </div>
      </div>
      <div style={{ height: 720, overflowY: "auto", background: "#FBFAF7" }}>{children}</div>
    </div>
  );
}

export function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 280,
        borderRadius: 32,
        padding: 8,
        background: "linear-gradient(165deg, #1a1714 0%, #29251f 100%)",
        boxShadow: "var(--shadow-xl)",
      }}
    >
      <div
        className="relative"
        style={{
          width: "100%",
          height: 540,
          borderRadius: 24,
          overflow: "hidden",
          background: "#FBFAF7",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 28,
            padding: "0 18px",
            fontSize: 10.5,
            fontWeight: 700,
            color: "#1A1814",
            background: "rgba(251,250,247,0.9)",
            zIndex: 5,
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          <span>9:41</span>
          <div style={{ width: 60, height: 14, borderRadius: 99, background: "#1a1714" }} />
          <span>100%</span>
        </div>
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 0,
            right: 0,
            bottom: 0,
            overflowY: "auto",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
