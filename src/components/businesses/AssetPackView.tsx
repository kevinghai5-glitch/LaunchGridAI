"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Layout,
  Target,
  Mail,
  MessageSquare,
  CalendarCheck,
  Copy,
  Check,
  Download,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type {
  AssetPack,
  AssetSection,
  GrowthAuditFile,
  LeadQualificationFile,
  EmailNurtureFile,
  SmsFollowUpFile,
  BookingSystemFile,
} from "@/types";

const TABS: { id: AssetSection; label: string; icon: typeof Layout }[] = [
  { id: "file1", label: "Growth Audit", icon: Layout },
  { id: "file2", label: "Lead Qualification", icon: Target },
  { id: "file3", label: "Email Nurture", icon: Mail },
  { id: "file4", label: "SMS Follow-Up", icon: MessageSquare },
  { id: "file5", label: "Booking System", icon: CalendarCheck },
];

export function AssetPackView({
  pack: initialPack,
  businessId,
  onUpdate,
}: {
  pack: AssetPack;
  businessId: string;
  onUpdate?: (pack: AssetPack) => void;
}) {
  const [pack, setPack] = useState<AssetPack>(initialPack);
  const [tab, setTab] = useState<AssetSection>("file1");
  const [regenerating, setRegenerating] = useState<AssetSection | null>(null);
  const [exporting, setExporting] = useState(false);

  // Older packs (pre-upgrade) won't have meta/file1 — guard against crashes.
  if (!pack?.meta || !pack.file1) {
    return (
      <div className="panel p-5 text-sm text-gray-400">
        This asset pack was generated in an earlier format. Regenerate it from Studio to
        unlock the upgraded deliverables and exports.
      </div>
    );
  }

  const regenerate = async (section: AssetSection) => {
    if (regenerating) return;
    setRegenerating(section);
    try {
      const res = await fetch("/api/generate/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, section }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to regenerate");
        return;
      }
      setPack(data.assetPack);
      onUpdate?.(data.assetPack);
      toast.success("Section regenerated");
    } catch {
      toast.error("Failed to regenerate");
    } finally {
      setRegenerating(null);
    }
  };

  const exportZip = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") ?? "";
      a.download = /filename="(.+?)"/.exec(cd)?.[1] ?? "acquisition-pack.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Exported 5 deliverables");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                    : "text-gray-400 border border-white/[0.06] hover:text-white hover:border-white/10"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={exportZip}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white hover:bg-blue-400 transition-colors disabled:opacity-60"
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export all (.zip)
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 mb-4">
        <ConfidenceBadge pack={pack} />
        <button
          onClick={() => regenerate(tab)}
          disabled={!!regenerating}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-300 transition-colors disabled:opacity-60"
        >
          {regenerating === tab ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Regenerate this section
        </button>
      </div>

      {pack.meta.assumptions.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-amber-200/90 leading-relaxed">
          <span className="font-semibold">Methodology note. </span>
          {pack.meta.assumptions.join(" ")}
        </div>
      )}

      {tab === "file1" && <AuditTab f={pack.file1} />}
      {tab === "file2" && <LeadTab f={pack.file2} />}
      {tab === "file3" && <EmailTab f={pack.file3} />}
      {tab === "file4" && <SmsTab f={pack.file4} />}
      {tab === "file5" && <BookingTab f={pack.file5} />}
    </div>
  );
}

function ConfidenceBadge({ pack }: { pack: AssetPack }) {
  const tone =
    pack.meta.dataConfidence === "high"
      ? "text-emerald-300"
      : pack.meta.dataConfidence === "medium"
      ? "text-amber-300"
      : "text-gray-400";
  return (
    <span className="text-xs text-gray-500">
      Data confidence:{" "}
      <span className={`font-semibold uppercase ${tone}`}>{pack.meta.dataConfidence}</span>
    </span>
  );
}

/* ---------- shared primitives ---------- */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Copied");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Copy failed");
        }
      }}
      className="text-gray-500 hover:text-blue-400 transition-colors shrink-0"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mt-4 mb-1.5">
      {children}
    </div>
  );
}

function Para({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="text-sm text-white whitespace-pre-wrap leading-relaxed mb-1">{children}</p>
  );
}

function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-white">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="panel p-4 mb-3">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3 mt-6 first:mt-0">
      {children}
    </h4>
  );
}

/* ---------- File 1: Growth Audit ---------- */

function AuditTab({ f }: { f: GrowthAuditFile }) {
  return (
    <div className="space-y-1">
      <SectionTitle>Executive Summary</SectionTitle>
      <Panel>
        <Para>{f.executiveSummary}</Para>
      </Panel>

      <SectionTitle>Top 5 Revenue Leaks</SectionTitle>
      <div className="panel overflow-x-auto mb-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-500 border-b border-white/[0.06]">
              <th className="text-left p-3">Issue</th>
              <th className="text-left p-3">Impact</th>
              <th className="text-left p-3">Urgency</th>
              <th className="text-left p-3">Difficulty</th>
              <th className="text-left p-3">Recommended fix</th>
            </tr>
          </thead>
          <tbody>
            {(f.revenueLeaks ?? []).map((l, i) => (
              <tr key={i} className="border-b border-white/[0.04] align-top">
                <td className="p-3 text-white font-medium">{l.issue}</td>
                <td className="p-3 text-blue-300 font-semibold">{l.impact}/10</td>
                <td className="p-3 text-blue-300 font-semibold">{l.urgency}/10</td>
                <td className="p-3 text-blue-300 font-semibold">{l.difficulty}/10</td>
                <td className="p-3 text-gray-300">{l.recommendedFix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle>Growth Audit</SectionTitle>
      <Panel>
        <Para>{f.growthAudit?.overview}</Para>
        {(f.growthAudit?.findings ?? []).map((x, i) => (
          <div key={i} className="mt-2 flex items-start gap-2 text-sm">
            <Badge
              variant={x.severity === "high" ? "red" : x.severity === "medium" ? "yellow" : "green"}
              className="text-[10px] capitalize shrink-0"
            >
              {x.severity}
            </Badge>
            <span className="text-gray-300">
              <span className="text-white font-medium">{x.area}:</span> {x.finding}
            </span>
          </div>
        ))}
      </Panel>

      <SectionTitle>Conversion Bottlenecks</SectionTitle>
      {(f.conversionBottlenecks ?? []).map((b, i) => (
        <Panel key={i}>
          <div className="text-sm font-medium text-white mb-1">{b.stage}</div>
          <p className="text-sm text-gray-400">
            <span className="text-gray-300">Problem:</span> {b.problem}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            <span className="text-gray-300">Fix:</span> {b.fix}
          </p>
        </Panel>
      ))}

      <SectionTitle>Local Market Intelligence</SectionTitle>
      <Panel>
        {f.localMarketIntelligence &&
          (
            [
              ["Customer Psychology", f.localMarketIntelligence.customerPsychology],
              ["Buying Behavior", f.localMarketIntelligence.buyingBehavior],
              ["Trust Expectations", f.localMarketIntelligence.trustExpectations],
              ["Competitive Saturation", f.localMarketIntelligence.competitiveSaturation],
              ["Seasonal Demand", f.localMarketIntelligence.seasonalDemand],
              ["Price Sensitivity", f.localMarketIntelligence.priceSensitivity],
              ["Local Credibility Markers", f.localMarketIntelligence.credibilityMarkers],
            ] as [string, string][]
          ).map(([t, v]) => (
            <div key={t}>
              <Label>{t}</Label>
              <Para>{v}</Para>
            </div>
          ))}
      </Panel>

      <SectionTitle>Competitor Positioning</SectionTitle>
      <Panel>
        <Label>Common weak messaging</Label>
        <Bullets items={f.competitorPositioning?.commonWeakMessaging} />
        <Label>Overused claims</Label>
        <Bullets items={f.competitorPositioning?.overusedClaims} />
        <Label>Trust gaps competitors ignore</Label>
        <Bullets items={f.competitorPositioning?.trustGapsIgnored} />
        <Label>Opportunities to stand out</Label>
        <Bullets items={f.competitorPositioning?.opportunitiesToStandOut} />
        <Label>Recommended angle</Label>
        <Para>{f.competitorPositioning?.recommendedAngle}</Para>
      </Panel>

      <SectionTitle>Trust Gap Analysis</SectionTitle>
      {(f.trustGapAnalysis ?? []).map((g, i) => (
        <Panel key={i}>
          <div className="text-sm font-medium text-white mb-1">{g.gap}</div>
          <p className="text-sm text-gray-400">Impact: {g.impact}</p>
          <p className="text-sm text-gray-400 mt-1">Fix: {g.fix}</p>
        </Panel>
      ))}

      <SectionTitle>Fastest Conversion Wins</SectionTitle>
      <Panel>
        <Bullets items={f.fastestWins} />
      </Panel>

      <SectionTitle>Positioning Strategy</SectionTitle>
      <Panel>
        <Para>{f.positioningStrategy}</Para>
      </Panel>

      <SectionTitle>Landing Page Copy</SectionTitle>
      <Panel>
        <blockquote className="border-l-2 border-blue-500/40 bg-blue-500/[0.06] rounded-r-lg px-4 py-3 text-base font-semibold text-white mb-2">
          {f.landingPage?.heroHeadline}
        </blockquote>
        <Para>{f.landingPage?.heroSubheadline}</Para>
        <Label>CTA block</Label>
        <Para>{f.landingPage?.ctaBlock}</Para>
        <Label>Problem</Label>
        <Para>{f.landingPage?.problemSection}</Para>
        <Label>Solution</Label>
        <Para>{f.landingPage?.solutionSection}</Para>
        <Label>Offer</Label>
        <Para>{f.landingPage?.offerSection}</Para>
        <Label>3-step process</Label>
        <Bullets items={(f.landingPage?.threeStepProcess ?? []).map((s) => `${s.step} — ${s.description}`)} />
        <Label>Benefits</Label>
        <Bullets items={f.landingPage?.benefits} />
        <Label>Trust / proof</Label>
        <Para>{f.landingPage?.trustSection}</Para>
        <Label>Testimonials</Label>
        {(f.landingPage?.testimonials ?? []).map((t, i) => (
          <div key={i} className="border-l-2 border-white/10 pl-3 mb-2 text-sm">
            <p className="text-gray-300 italic">“{t.quote}”</p>
            <p className="text-gray-500 text-xs mt-0.5">
              — {t.name}, {t.location}
            </p>
          </div>
        ))}
        <Label>FAQ / objection handling</Label>
        {(f.landingPage?.faq ?? []).map((q, i) => (
          <div key={i} className="mb-2">
            <div className="text-sm font-medium text-white">{q.question}</div>
            <p className="text-sm text-gray-400">{q.answer}</p>
          </div>
        ))}
        <Label>Urgency / scarcity</Label>
        <Para>{f.landingPage?.urgencyBlock}</Para>
        <Label>Final CTA</Label>
        <Para>{f.landingPage?.finalCta}</Para>
      </Panel>

      <SectionTitle>Implementation & Stack</SectionTitle>
      <Panel>
        <Label>Landing page structure</Label>
        <Bullets items={f.landingStructure} />
        <Label>CTA strategy</Label>
        <Para>{f.ctaStrategy}</Para>
        <Label>Social proof recommendations</Label>
        <Bullets items={f.socialProofRecommendations} />
        <Label>Urgency strategy</Label>
        <Para>{f.urgencyStrategy}</Para>
        <Label>Implementation notes</Label>
        <Para>{f.implementationNotes}</Para>
        <Label>Recommended tech stack</Label>
        <Bullets items={(f.techStack ?? []).map((t) => `${t.tool} — ${t.purpose}`)} />
        <Label>Tracking / analytics</Label>
        <Bullets items={f.trackingAnalytics} />
      </Panel>

      <SectionTitle>Content & Sales Enablement</SectionTitle>
      <Panel>
        <Label>Loom walkthrough talking points</Label>
        <Bullets items={f.loomTalkingPoints} />
        <Label>Before / after angles</Label>
        {(f.beforeAfterAngles ?? []).map((b, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 text-sm">
            <div className="rounded-lg bg-red-500/[0.06] border border-red-500/15 p-2">
              <div className="text-[10px] uppercase text-red-300/80 mb-0.5">Before</div>
              <span className="text-gray-300">{b.before}</span>
            </div>
            <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 p-2">
              <div className="text-[10px] uppercase text-emerald-300/80 mb-0.5">After</div>
              <span className="text-gray-300">{b.after}</span>
            </div>
          </div>
        ))}
        <Label>Cold outreach angle</Label>
        <Para>{f.salesEnablement?.coldOutreachAngle}</Para>
        <Label>Personalized opener</Label>
        <Para>{f.salesEnablement?.personalizedOpener}</Para>
        <Label>Loom audit script</Label>
        <Bullets items={f.salesEnablement?.loomScriptBullets} />
        <Label>Proposal positioning</Label>
        <Para>{f.salesEnablement?.proposalPositioning}</Para>
        <Label>Discovery call talking points</Label>
        <Bullets items={f.salesEnablement?.discoveryCallPoints} />
        <Label>Objection handling</Label>
        {(f.salesEnablement?.objectionHandling ?? []).map((o, i) => (
          <div key={i} className="border-l-2 border-blue-500/30 pl-3 mb-2">
            <div className="text-sm font-medium text-white">{o.objection}</div>
            <p className="text-sm text-gray-400">{o.response}</p>
          </div>
        ))}
      </Panel>
    </div>
  );
}

/* ---------- File 2: Lead Qualification ---------- */

function LeadTab({ f }: { f: LeadQualificationFile }) {
  return (
    <div className="space-y-1">
      <Panel>
        <div className="text-base font-semibold text-white">{f.formHeadline}</div>
        <Para>{f.formSubheadline}</Para>
      </Panel>

      <SectionTitle>Intake Questions</SectionTitle>
      {(f.questions ?? []).map((q, i) => (
        <Panel key={i}>
          <div className="text-sm font-medium text-white mb-1">
            {i + 1}. {q.question}
          </div>
          <div className="text-xs text-gray-500">Input: {q.inputType}</div>
          {q.options?.length > 0 && (
            <div className="text-xs text-gray-400 mt-1">Options: {q.options.join(" · ")}</div>
          )}
          <p className="text-sm text-gray-400 mt-1.5">Purpose: {q.purpose}</p>
          <p className="text-sm text-gray-400 mt-1">Scoring: {q.scoringImpact}</p>
        </Panel>
      ))}

      <SectionTitle>Lead Scoring</SectionTitle>
      <Panel>
        <Label>Rubric</Label>
        <Para>{f.leadScoring?.rubric}</Para>
        <Label>Hot</Label>
        <Para>{f.leadScoring?.hot}</Para>
        <Label>Warm</Label>
        <Para>{f.leadScoring?.warm}</Para>
        <Label>Cold / nurture</Label>
        <Para>{f.leadScoring?.cold}</Para>
      </Panel>

      <SectionTitle>Routing Logic</SectionTitle>
      {(f.routingLogic ?? []).map((r, i) => (
        <Panel key={i}>
          <div className="flex items-center gap-2">
            <Badge variant="blue" className="text-xs">
              {r.tier}
            </Badge>
            <span className="text-xs text-gray-500">{r.timing}</span>
          </div>
          <p className="text-sm text-gray-300 mt-1.5">{r.action}</p>
        </Panel>
      ))}

      <SectionTitle>Automation & Implementation</SectionTitle>
      <Panel>
        <Label>Automation workflow</Label>
        <Bullets items={f.automationWorkflow} />
        <Label>Thank-you page</Label>
        <Para>{f.thankYouPage}</Para>
        <Label>CRM fields</Label>
        <Bullets items={f.crmFields} />
        <Label>Follow-up timing</Label>
        <Para>{f.followUpTiming}</Para>
        <Label>Implementation</Label>
        <Bullets items={f.implementation} />
      </Panel>
    </div>
  );
}

/* ---------- File 3: Email Nurture ---------- */

function EmailTab({ f }: { f: EmailNurtureFile }) {
  return (
    <div className="space-y-3">
      {(f.emails ?? []).map((e, i) => (
        <div key={i} className="panel p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="blue" className="text-xs">
                Email {e.day}
              </Badge>
              <span className="text-xs text-gray-500 capitalize">{e.purpose}</span>
              <span className="text-xs text-gray-600">· {e.timing}</span>
            </div>
            <CopyButton text={`Subject: ${e.subject}\nPreview: ${e.previewText}\n\n${e.body}\n\n${e.cta}`} />
          </div>
          <div className="text-sm font-semibold text-white">{e.subject}</div>
          <div className="text-xs text-gray-500 mb-1">A/B: {e.subjectB}</div>
          <div className="text-xs text-gray-500 mb-2">Preview: {e.previewText}</div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{e.body}</p>
          <div className="text-sm text-blue-300 mt-2">CTA: {e.cta}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- File 4: SMS Follow-Up ---------- */

function SmsTab({ f }: { f: SmsFollowUpFile }) {
  return (
    <div className="space-y-3">
      {(f.messages ?? []).map((m, i) => (
        <div key={i} className="panel p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="blue" className="text-xs">
                #{m.order}
              </Badge>
              <span className="text-xs text-gray-500">{m.timing}</span>
              <span
                className={`text-xs ${m.charCount > 160 ? "text-amber-400" : "text-gray-600"}`}
              >
                · {m.charCount} chars
              </span>
            </div>
            <CopyButton text={m.message} />
          </div>
          <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{m.message}</p>
          <p className="text-xs text-gray-500 mt-2">Psychology: {m.psychology}</p>
          <p className="text-xs text-gray-500 mt-1">On reply: {m.replyStrategy}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- File 5: Booking System ---------- */

function BookingTab({ f }: { f: BookingSystemFile }) {
  return (
    <div className="space-y-1">
      <Panel>
        <div className="text-base font-semibold text-white">{f.headline}</div>
        <Para>{f.subheadline}</Para>
      </Panel>

      <SectionTitle>What to Expect</SectionTitle>
      <Panel>
        <Bullets items={f.whatToExpect} />
        <Label>3-step breakdown</Label>
        <Bullets items={(f.threeStepBreakdown ?? []).map((s) => `${s.step} — ${s.description}`)} />
        <Label>Appointment positioning</Label>
        <Para>{f.appointmentPositioning}</Para>
        <Label>Micro social proof</Label>
        <Bullets items={f.microSocialProof} />
      </Panel>

      <SectionTitle>Confirmation & Reminders</SectionTitle>
      <Panel>
        <Label>Confirmation email</Label>
        <div className="text-sm font-medium text-white">{f.confirmationEmail?.subject}</div>
        <Para>{f.confirmationEmail?.body}</Para>
        <Label>24-hour reminder email</Label>
        <div className="text-sm font-medium text-white">{f.reminderEmail24h?.subject}</div>
        <Para>{f.reminderEmail24h?.body}</Para>
        <Label>Day-of reminder SMS</Label>
        <Para>{f.dayOfReminderSms}</Para>
      </Panel>

      <SectionTitle>No-Show Recovery</SectionTitle>
      <Panel>
        <Label>Recovery email</Label>
        <div className="text-sm font-medium text-white">{f.noShowRecoveryEmail?.subject}</div>
        <Para>{f.noShowRecoveryEmail?.body}</Para>
        <Label>Recovery SMS 1</Label>
        <Para>{f.noShowRecoverySms1}</Para>
        <Label>Recovery SMS 2</Label>
        <Para>{f.noShowRecoverySms2}</Para>
        <Label>Reschedule framing</Label>
        <Para>{f.rescheduleFraming}</Para>
      </Panel>

      <SectionTitle>Quality & Implementation</SectionTitle>
      <Panel>
        <Label>Show-up quality notes</Label>
        <Para>{f.showUpQualityNotes}</Para>
        <Label>Implementation</Label>
        <Bullets items={f.implementation} />
      </Panel>
    </div>
  );
}
