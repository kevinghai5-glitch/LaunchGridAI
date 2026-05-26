// HTML deliverable builders (File 1 and File 5).
//
// Produces standalone, styled, responsive HTML documents that read like premium
// client-facing consulting deliverables. No external assets — everything is
// inlined so the file works when downloaded and opened directly.

import type { AssetPack, GrowthAuditFile, BookingSystemFile, AssetPackMeta } from "@/types";

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Preserve author line breaks inside long-form copy.
function para(s: string | null | undefined): string {
  if (!s) return "";
  return esc(s)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function list(items: string[] | undefined, ordered = false): string {
  if (!items?.length) return "";
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}>`;
}

function section(num: number, title: string, inner: string): string {
  if (!inner) return "";
  return `<section class="sec"><div class="sec-num">${num
    .toString()
    .padStart(2, "0")}</div><h2>${esc(title)}</h2>${inner}</section>`;
}

function shell(meta: AssetPackMeta, docTitle: string, body: string): string {
  const confidence = meta.dataConfidence.toUpperCase();
  const assumptions = meta.assumptions.length
    ? `<div class="assumptions"><strong>Methodology note.</strong> ${meta.assumptions
        .map((a) => esc(a))
        .join(" ")}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(docTitle)} — ${esc(meta.businessName)}</title>
<style>
  :root {
    --ink: #15171c; --muted: #5b6472; --soft: #8a93a2; --line: #e7e9ee;
    --accent: #1f5fff; --accent-soft: #eef3ff; --bg: #f6f7f9; --card: #ffffff;
    --warn: #b54708; --high: #b42318; --med: #b54708; --low: #027a48;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6; font-size: 16px; -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 880px; margin: 0 auto; padding: 56px 24px 96px; }
  header.doc {
    background: linear-gradient(135deg, #0b1f4d, #1f5fff);
    color: #fff; border-radius: 16px; padding: 40px 40px 36px; margin-bottom: 40px;
  }
  header.doc .eyebrow { text-transform: uppercase; letter-spacing: .14em; font-size: 12px; opacity: .8; margin-bottom: 14px; }
  header.doc h1 { margin: 0 0 8px; font-size: 30px; line-height: 1.2; letter-spacing: -.02em; }
  header.doc .meta { font-size: 14px; opacity: .9; }
  header.doc .badge {
    display: inline-block; margin-top: 18px; background: rgba(255,255,255,.16);
    border: 1px solid rgba(255,255,255,.25); padding: 5px 12px; border-radius: 99px; font-size: 12px;
  }
  .assumptions {
    background: #fff8ec; border: 1px solid #f5d9a8; color: #7a4d05;
    border-radius: 10px; padding: 14px 16px; font-size: 13.5px; margin-bottom: 32px;
  }
  .sec { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 28px 32px; margin-bottom: 20px; position: relative; }
  .sec-num { position: absolute; top: 22px; right: 28px; font-size: 13px; font-weight: 700; color: var(--soft); letter-spacing: .04em; }
  h2 { font-size: 20px; margin: 0 0 16px; letter-spacing: -.01em; padding-right: 40px; }
  h3 { font-size: 15px; margin: 22px 0 8px; color: var(--ink); }
  p { margin: 0 0 12px; }
  p:last-child { margin-bottom: 0; }
  ul, ol { margin: 0 0 12px; padding-left: 20px; }
  li { margin: 0 0 6px; }
  .muted { color: var(--muted); }
  .label { text-transform: uppercase; letter-spacing: .07em; font-size: 11.5px; font-weight: 700; color: var(--soft); margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; font-size: 14px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { background: var(--accent-soft); color: #1a3a8a; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .score { font-weight: 700; }
  .pill { display: inline-block; padding: 2px 9px; border-radius: 99px; font-size: 11.5px; font-weight: 700; }
  .pill.high { background: #fee4e2; color: var(--high); }
  .pill.medium { background: #fef0c7; color: var(--med); }
  .pill.low { background: #d1fadf; color: var(--low); }
  .card { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; margin: 0 0 12px; }
  .hero-quote { background: var(--accent-soft); border-left: 4px solid var(--accent); border-radius: 0 10px 10px 0; padding: 18px 20px; font-size: 19px; font-weight: 600; margin: 0 0 14px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ba { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; margin-bottom: 10px; }
  .ba > div { padding: 14px 16px; font-size: 14px; }
  .ba .before { background: #fff5f5; border-right: 1px solid var(--line); }
  .ba .after { background: #f2fbf6; }
  .ba .t { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; margin-bottom: 4px; }
  .email { border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; margin-bottom: 12px; }
  .email .subj { font-weight: 700; margin-bottom: 4px; }
  footer.doc { text-align: center; color: var(--soft); font-size: 12.5px; margin-top: 40px; }
  @media (max-width: 640px) { .grid2, .ba { grid-template-columns: 1fr; } .wrap { padding: 32px 16px 64px; } header.doc { padding: 28px 24px; } }
  @media print { body { background: #fff; } .sec, .card { break-inside: avoid; } }
</style>
</head>
<body>
  <div class="wrap">
    <header class="doc">
      <div class="eyebrow">Client Acquisition Infrastructure</div>
      <h1>${esc(docTitle)}</h1>
      <div class="meta">${esc(meta.businessName)}${meta.city ? ` · ${esc(meta.city)}` : ""}${
        meta.industry ? ` · ${esc(meta.industry)}` : ""
      }</div>
      <div class="badge">Data confidence: ${esc(confidence)}</div>
    </header>
    ${assumptions}
    ${body}
    <footer class="doc">Prepared by LaunchGrid AI · ${esc(
      new Date(meta.generatedAt).toLocaleDateString()
    )}</footer>
  </div>
</body>
</html>`;
}

function emailBlock(label: string, e: { subject: string; body: string }): string {
  if (!e?.subject && !e?.body) return "";
  return `<div class="email"><div class="label">${esc(label)}</div><div class="subj">${esc(
    e.subject
  )}</div>${para(e.body)}</div>`;
}

// ── FILE 1 ───────────────────────────────────────────────────────────────────

export function renderFile1Html(pack: AssetPack): string {
  const f: GrowthAuditFile = pack.file1;
  const parts: string[] = [];

  parts.push(section(1, "Executive Summary", para(f.executiveSummary)));

  parts.push(
    section(
      2,
      "Business Growth Audit",
      para(f.growthAudit?.overview) +
        (f.growthAudit?.findings?.length
          ? `<table><thead><tr><th>Area</th><th>Finding</th><th>Severity</th></tr></thead><tbody>${f.growthAudit.findings
              .map(
                (x) =>
                  `<tr><td><strong>${esc(x.area)}</strong></td><td>${esc(
                    x.finding
                  )}</td><td><span class="pill ${esc(x.severity)}">${esc(
                    x.severity
                  )}</span></td></tr>`
              )
              .join("")}</tbody></table>`
          : "")
    )
  );

  parts.push(
    section(
      3,
      "Top 5 Revenue Leaks",
      f.revenueLeaks?.length
        ? `<table><thead><tr><th>Issue</th><th>Why it matters</th><th>Impact</th><th>Urgency</th><th>Difficulty</th><th>Recommended fix</th><th>Expected impact</th></tr></thead><tbody>${f.revenueLeaks
            .map(
              (l) =>
                `<tr><td><strong>${esc(l.issue)}</strong></td><td>${esc(
                  l.whyItMatters
                )}</td><td class="score">${esc(l.impact)}/10</td><td class="score">${esc(
                  l.urgency
                )}/10</td><td class="score">${esc(l.difficulty)}/10</td><td>${esc(
                  l.recommendedFix
                )}</td><td>${esc(l.expectedImpact)}</td></tr>`
            )
            .join("")}</tbody></table>`
        : ""
    )
  );

  parts.push(
    section(
      4,
      "Conversion Bottleneck Analysis",
      (f.conversionBottlenecks ?? [])
        .map(
          (b) =>
            `<div class="card"><h3>${esc(b.stage)}</h3><p><strong>Problem.</strong> ${esc(
              b.problem
            )}</p><p><strong>Fix.</strong> ${esc(b.fix)}</p></div>`
        )
        .join("")
    )
  );

  const lmi = f.localMarketIntelligence;
  parts.push(
    section(
      5,
      "Local Market Intelligence",
      lmi
        ? [
            ["Customer Psychology", lmi.customerPsychology],
            ["Buying Behavior", lmi.buyingBehavior],
            ["Trust Expectations", lmi.trustExpectations],
            ["Competitive Saturation", lmi.competitiveSaturation],
            ["Seasonal Demand", lmi.seasonalDemand],
            ["Price Sensitivity", lmi.priceSensitivity],
            ["Local Credibility Markers", lmi.credibilityMarkers],
          ]
            .map(([t, v]) => `<div class="label">${esc(t)}</div>${para(v)}`)
            .join("")
        : ""
    )
  );

  const cp = f.competitorPositioning;
  parts.push(
    section(
      6,
      "Competitor Positioning Analysis",
      cp
        ? `<div class="label">Common weak messaging</div>${list(cp.commonWeakMessaging)}
           <div class="label">Overused claims</div>${list(cp.overusedClaims)}
           <div class="label">Trust gaps competitors ignore</div>${list(cp.trustGapsIgnored)}
           <div class="label">Opportunities to stand out</div>${list(cp.opportunitiesToStandOut)}
           <div class="label">Recommended angle</div>${para(cp.recommendedAngle)}`
        : ""
    )
  );

  parts.push(
    section(
      7,
      "Trust Gap Analysis",
      (f.trustGapAnalysis ?? [])
        .map(
          (g) =>
            `<div class="card"><h3>${esc(g.gap)}</h3><p><strong>Impact.</strong> ${esc(
              g.impact
            )}</p><p><strong>Fix.</strong> ${esc(g.fix)}</p></div>`
        )
        .join("")
    )
  );

  parts.push(section(8, "Fastest Conversion Wins", list(f.fastestWins)));
  parts.push(section(9, "Recommended Positioning Strategy", para(f.positioningStrategy)));

  const lp = f.landingPage;
  parts.push(
    section(
      10,
      "Complete Landing Page Copy",
      lp
        ? `<div class="hero-quote">${esc(lp.heroHeadline)}</div>${para(lp.heroSubheadline)}
           <div class="label">CTA block</div>${para(lp.ctaBlock)}
           <div class="label">Problem</div>${para(lp.problemSection)}
           <div class="label">Solution</div>${para(lp.solutionSection)}
           <div class="label">Offer</div>${para(lp.offerSection)}
           <div class="label">3-step process</div>${list(
             (lp.threeStepProcess ?? []).map((s) => `${s.step} — ${s.description}`),
             true
           )}
           <div class="label">Benefits</div>${list(lp.benefits)}
           <div class="label">Trust / proof section</div>${para(lp.trustSection)}
           <div class="label">Testimonials</div>${(lp.testimonials ?? [])
             .map(
               (t) =>
                 `<div class="card">“${esc(t.quote)}”<br><span class="muted">— ${esc(
                   t.name
                 )}, ${esc(t.location)}</span></div>`
             )
             .join("")}
           <div class="label">FAQ / objection handling</div>${(lp.faq ?? [])
             .map((q) => `<div class="card"><strong>${esc(q.question)}</strong>${para(q.answer)}</div>`)
             .join("")}
           <div class="label">Urgency / scarcity</div>${para(lp.urgencyBlock)}
           <div class="label">Final CTA</div>${para(lp.finalCta)}`
        : ""
    )
  );

  parts.push(section(11, "Landing Page Structure", list(f.landingStructure, true)));
  parts.push(section(12, "CTA Strategy", para(f.ctaStrategy)));
  parts.push(section(13, "Social Proof Recommendations", list(f.socialProofRecommendations)));
  parts.push(section(14, "Urgency / Scarcity Strategy", para(f.urgencyStrategy)));
  parts.push(section(15, "Implementation Notes", para(f.implementationNotes)));

  parts.push(
    section(
      16,
      "Recommended Tech Stack",
      (f.techStack ?? []).length
        ? `<table><thead><tr><th>Tool</th><th>Purpose</th></tr></thead><tbody>${f.techStack
            .map((t) => `<tr><td><strong>${esc(t.tool)}</strong></td><td>${esc(t.purpose)}</td></tr>`)
            .join("")}</tbody></table>`
        : ""
    )
  );

  parts.push(section(17, "Tracking / Analytics Recommendations", list(f.trackingAnalytics)));
  parts.push(section(18, "Loom Walkthrough Talking Points", list(f.loomTalkingPoints)));

  parts.push(
    section(
      19,
      "Before / After Content Angles",
      (f.beforeAfterAngles ?? [])
        .map(
          (b) =>
            `<div class="ba"><div class="before"><div class="t">Before</div>${esc(
              b.before
            )}</div><div class="after"><div class="t">After</div>${esc(b.after)}</div></div>`
        )
        .join("")
    )
  );

  const se = f.salesEnablement;
  parts.push(
    section(
      20,
      "High-Ticket Sales Enablement",
      se
        ? `<div class="label">Cold outreach angle</div>${para(se.coldOutreachAngle)}
           <div class="label">Personalized opener</div>${para(se.personalizedOpener)}
           <div class="label">Loom audit script</div>${list(se.loomScriptBullets)}
           <div class="label">Proposal positioning</div>${para(se.proposalPositioning)}
           <div class="label">Discovery call talking points</div>${list(se.discoveryCallPoints)}
           <div class="label">Objection handling</div>${(se.objectionHandling ?? [])
             .map(
               (o) => `<div class="card"><strong>${esc(o.objection)}</strong>${para(o.response)}</div>`
             )
             .join("")}`
        : ""
    )
  );

  return shell(pack.meta, "Landing Page Growth Audit", parts.join("\n"));
}

// ── FILE 5 ───────────────────────────────────────────────────────────────────

export function renderFile5Html(pack: AssetPack): string {
  const f: BookingSystemFile = pack.file5;
  const parts: string[] = [];

  parts.push(
    section(
      1,
      "Booking Page",
      `<div class="hero-quote">${esc(f.headline)}</div>${para(f.subheadline)}`
    )
  );
  parts.push(section(2, "What to Expect", list(f.whatToExpect)));
  parts.push(
    section(
      3,
      "3-Step Appointment Breakdown",
      list((f.threeStepBreakdown ?? []).map((s) => `${s.step} — ${s.description}`), true)
    )
  );
  parts.push(section(4, "Appointment Positioning", para(f.appointmentPositioning)));
  parts.push(section(5, "Micro Social Proof", list(f.microSocialProof)));
  parts.push(
    section(
      6,
      "Email & SMS Sequence",
      emailBlock("Confirmation email", f.confirmationEmail) +
        emailBlock("24-hour reminder email", f.reminderEmail24h) +
        `<div class="label">Day-of reminder SMS</div><div class="card">${esc(
          f.dayOfReminderSms
        )}</div>` +
        emailBlock("No-show recovery email", f.noShowRecoveryEmail) +
        `<div class="label">No-show recovery SMS 1</div><div class="card">${esc(
          f.noShowRecoverySms1
        )}</div>` +
        `<div class="label">No-show recovery SMS 2</div><div class="card">${esc(
          f.noShowRecoverySms2
        )}</div>`
    )
  );
  parts.push(section(7, "Reschedule Framing", para(f.rescheduleFraming)));
  parts.push(section(8, "Show-Up Quality Notes", para(f.showUpQualityNotes)));
  parts.push(section(9, "Implementation Instructions", list(f.implementation, true)));

  return shell(pack.meta, "Booking & Appointment System", parts.join("\n"));
}
