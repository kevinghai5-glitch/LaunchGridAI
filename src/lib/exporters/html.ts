// HTML deliverable builders (File 1 and File 5).
//
// Produces standalone, styled, responsive HTML documents that read like premium
// client-facing consulting deliverables. No external assets — everything is
// inlined so the file works when downloaded and opened directly.

import type {
  AssetPack,
  AssetSection,
  GrowthAuditFile,
  LeadQualificationFile,
  EmailNurtureFile,
  SmsFollowUpFile,
  BookingSystemFile,
} from "@/types";
import {
  esc,
  para,
  list,
  section,
  shell,
  renderTechnicalUx,
  renderVisuals,
  renderFramingOverview,
  renderFramingClose,
  emailBlock,
} from "./_shell";

// ── FILE 1 ───────────────────────────────────────────────────────────────────

export function renderFile1Html(pack: AssetPack): string {
  const f: GrowthAuditFile = pack.file1;
  const parts: string[] = [];

  let n = 0;
  const next = () => ++n;

  const overview = renderFramingOverview(f.framing);
  if (overview) parts.push(section(next(), "Overview", overview));

  parts.push(section(next(), "Executive Summary", para(f.executiveSummary)));

  const visualsHtml = renderVisuals(f.visuals);
  if (visualsHtml) {
    parts.push(section(next(), "Visual Intelligence (Target vs. Local Competitors)", visualsHtml));
  }

  const tuxHtml = renderTechnicalUx(f.technicalUx);
  if (tuxHtml) {
    parts.push(section(next(), "Technical UX & Performance", tuxHtml));
  }

  parts.push(
    section(
      next(),
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
      next(),
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
      next(),
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
      next(),
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
      next(),
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
      next(),
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

  parts.push(section(next(), "Fastest Conversion Wins", list(f.fastestWins)));
  parts.push(section(next(), "Recommended Positioning Strategy", para(f.positioningStrategy)));

  const lp = f.landingPage;
  parts.push(
    section(
      next(),
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

  parts.push(section(next(), "Landing Page Structure", list(f.landingStructure, true)));
  parts.push(section(next(), "CTA Strategy", para(f.ctaStrategy)));
  parts.push(section(next(), "Social Proof Recommendations", list(f.socialProofRecommendations)));
  parts.push(section(next(), "Urgency / Scarcity Strategy", para(f.urgencyStrategy)));
  parts.push(section(next(), "Implementation Notes", para(f.implementationNotes)));

  parts.push(
    section(
      next(),
      "Recommended Tech Stack",
      (f.techStack ?? []).length
        ? `<table><thead><tr><th>Tool</th><th>Purpose</th></tr></thead><tbody>${f.techStack
            .map((t) => `<tr><td><strong>${esc(t.tool)}</strong></td><td>${esc(t.purpose)}</td></tr>`)
            .join("")}</tbody></table>`
        : ""
    )
  );

  parts.push(section(next(), "Tracking / Analytics Recommendations", list(f.trackingAnalytics)));
  parts.push(section(next(), "Loom Walkthrough Talking Points", list(f.loomTalkingPoints)));

  parts.push(
    section(
      next(),
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
      next(),
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

  const close = renderFramingClose(f.framing);
  if (close) parts.push(section(next(), "Implementation & Expected Impact", close));

  return shell(pack.meta, "Landing Page Growth Audit", parts.join("\n"));
}

// ── FILE 5 ───────────────────────────────────────────────────────────────────

export function renderFile5Html(pack: AssetPack): string {
  const f: BookingSystemFile = pack.file5;
  const parts: string[] = [];

  let n = 0;
  const next = () => ++n;

  const overview = renderFramingOverview(f.framing);
  if (overview) parts.push(section(next(), "Overview", overview));

  parts.push(
    section(
      next(),
      "Booking Page",
      `<div class="hero-quote">${esc(f.headline)}</div>${para(f.subheadline)}`
    )
  );
  parts.push(section(next(), "What to Expect", list(f.whatToExpect)));
  parts.push(
    section(
      next(),
      "3-Step Appointment Breakdown",
      list((f.threeStepBreakdown ?? []).map((s) => `${s.step} — ${s.description}`), true)
    )
  );
  parts.push(section(next(), "Appointment Positioning", para(f.appointmentPositioning)));
  parts.push(section(next(), "Micro Social Proof", list(f.microSocialProof)));
  parts.push(
    section(
      next(),
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
  parts.push(section(next(), "Reschedule Framing", para(f.rescheduleFraming)));
  parts.push(section(next(), "Show-Up Quality Notes", para(f.showUpQualityNotes)));
  parts.push(section(next(), "Implementation Instructions", list(f.implementation, true)));

  const close = renderFramingClose(f.framing);
  if (close) parts.push(section(next(), "Implementation Guide & Expected Impact", close));

  return shell(pack.meta, "Booking & Appointment System", parts.join("\n"));
}

// ── FILE 2 ───────────────────────────────────────────────────────────────────

export function renderFile2Html(pack: AssetPack): string {
  const f: LeadQualificationFile = pack.file2;
  const parts: string[] = [];

  let n = 0;
  const next = () => ++n;

  const overview = renderFramingOverview(f.framing);
  if (overview) parts.push(section(next(), "Overview", overview));

  parts.push(
    section(
      next(),
      "Lead Qualification Form",
      `<div class="hero-quote">${esc(f.formHeadline)}</div>${para(f.formSubheadline)}`
    )
  );

  parts.push(
    section(
      next(),
      "Intake Questions",
      (f.questions ?? [])
        .map(
          (q, i) =>
            `<div class="card"><h3>${i + 1}. ${esc(q.question)}</h3><p class="muted"><strong>Input.</strong> ${esc(
              q.inputType
            )}</p>${
              q.options?.length
                ? `<p class="muted"><strong>Options.</strong> ${esc(q.options.join(" · "))}</p>`
                : ""
            }<p><strong>Purpose.</strong> ${esc(q.purpose)}</p><p><strong>Scoring.</strong> ${esc(
              q.scoringImpact
            )}</p></div>`
        )
        .join("")
    )
  );

  const ls = f.leadScoring;
  parts.push(
    section(
      next(),
      "Lead Scoring Model",
      ls
        ? `<div class="label">Rubric</div>${para(ls.rubric)}
           <div class="label">Hot</div>${para(ls.hot)}
           <div class="label">Warm</div>${para(ls.warm)}
           <div class="label">Cold / nurture</div>${para(ls.cold)}`
        : ""
    )
  );

  parts.push(
    section(
      next(),
      "Routing Logic",
      f.routingLogic?.length
        ? `<table><thead><tr><th>Tier</th><th>Timing</th><th>Action</th></tr></thead><tbody>${f.routingLogic
            .map(
              (r) =>
                `<tr><td><strong>${esc(r.tier)}</strong></td><td>${esc(r.timing)}</td><td>${esc(
                  r.action
                )}</td></tr>`
            )
            .join("")}</tbody></table>`
        : ""
    )
  );

  parts.push(
    section(
      next(),
      "Automation & Implementation",
      `<div class="label">Automation workflow</div>${list(f.automationWorkflow)}
       <div class="label">Thank-you page</div>${para(f.thankYouPage)}
       <div class="label">CRM fields</div>${list(f.crmFields)}
       <div class="label">Follow-up timing</div>${para(f.followUpTiming)}
       <div class="label">Implementation</div>${list(f.implementation, true)}`
    )
  );

  const close = renderFramingClose(f.framing);
  if (close) parts.push(section(next(), "Implementation Guide & Expected Impact", close));

  return shell(pack.meta, "Lead Qualification System", parts.join("\n"));
}

// ── FILE 3 ───────────────────────────────────────────────────────────────────

export function renderFile3Html(pack: AssetPack): string {
  const f: EmailNurtureFile = pack.file3;
  const parts: string[] = [];

  let n = 0;
  const next = () => ++n;

  const overview = renderFramingOverview(f.framing);
  if (overview) parts.push(section(next(), "Overview", overview));

  parts.push(
    section(
      next(),
      "7-Day Email Nurture Sequence",
      (f.emails ?? [])
        .map(
          (e) =>
            `<div class="email"><div class="label">Email · Day ${esc(e.day)} · ${esc(
              e.timing
            )}${e.purpose ? ` · ${esc(e.purpose)}` : ""}</div><div class="subj">${esc(
              e.subject
            )}</div>${
              e.subjectB ? `<p class="muted">A/B subject: ${esc(e.subjectB)}</p>` : ""
            }${
              e.previewText ? `<p class="muted">Preview: ${esc(e.previewText)}</p>` : ""
            }${para(e.body)}${
              e.cta ? `<div class="strategy-block">${esc(e.cta)}</div>` : ""
            }</div>`
        )
        .join("")
    )
  );

  const close = renderFramingClose(f.framing);
  if (close) parts.push(section(next(), "Implementation Guide & Expected Impact", close));

  return shell(pack.meta, "Email Nurture System", parts.join("\n"));
}

// ── FILE 4 ───────────────────────────────────────────────────────────────────

export function renderFile4Html(pack: AssetPack): string {
  const f: SmsFollowUpFile = pack.file4;
  const parts: string[] = [];

  let n = 0;
  const next = () => ++n;

  const overview = renderFramingOverview(f.framing);
  if (overview) parts.push(section(next(), "Overview", overview));

  parts.push(
    section(
      next(),
      "SMS Follow-Up Sequence",
      (f.messages ?? [])
        .map(
          (m) =>
            `<div class="card"><div class="label">Message ${esc(m.order)} · send ${esc(
              m.timing
            )} · ${esc(m.charCount)} chars</div><p><strong>${esc(
              m.message
            )}</strong></p><p class="muted"><strong>Psychology.</strong> ${esc(
              m.psychology
            )}</p><p class="muted"><strong>On reply.</strong> ${esc(m.replyStrategy)}</p></div>`
        )
        .join("")
    )
  );

  const close = renderFramingClose(f.framing);
  if (close) parts.push(section(next(), "Implementation Guide & Expected Impact", close));

  return shell(pack.meta, "SMS Follow-Up System", parts.join("\n"));
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

// Render any of the five files as a standalone, premium client-facing HTML
// document — used by Studio to preview the *actual deliverable* (not the
// in-app data view).
export function renderFileHtml(pack: AssetPack, section: AssetSection): string {
  switch (section) {
    case "file1":
      return renderFile1Html(pack);
    case "file2":
      return renderFile2Html(pack);
    case "file3":
      return renderFile3Html(pack);
    case "file4":
      return renderFile4Html(pack);
    case "file5":
      return renderFile5Html(pack);
  }
}
