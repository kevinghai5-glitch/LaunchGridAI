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
  Lightbulb,
  Copy,
  Check,
} from "lucide-react";
import type { AssetPack } from "@/types";

const TABS = [
  { id: "summary", label: "Analysis", icon: Lightbulb },
  { id: "landing", label: "Landing Page", icon: Layout },
  { id: "lead", label: "Lead Capture", icon: Target },
  { id: "email", label: "Email Sequence", icon: Mail },
  { id: "sms", label: "SMS Follow-Up", icon: MessageSquare },
  { id: "booking", label: "Booking Page", icon: CalendarCheck },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AssetPackView({ pack }: { pack: AssetPack }) {
  const [tab, setTab] = useState<TabId>("summary");

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
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

      {tab === "summary" && <SummaryTab data={pack.businessSummary} />}
      {tab === "landing" && <LandingTab data={pack.landingPage} />}
      {tab === "lead" && <LeadTab data={pack.leadCapture} />}
      {tab === "email" && <EmailTab data={pack.emailSequence} />}
      {tab === "sms" && <SmsTab data={pack.smsSequence} />}
      {tab === "booking" && <BookingTab data={pack.bookingPage} />}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <button
      onClick={onCopy}
      className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors shrink-0"
      aria-label={label ?? "Copy"}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  copyable,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </span>
        {copyable && <CopyButton text={value} />}
      </div>
      <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items?.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-white">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SummaryTab({ data }: { data: AssetPack["businessSummary"] }) {
  return (
    <div className="space-y-4">
      <Field label="Positioning" value={data.positioning} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="panel p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
            Services
          </div>
          <BulletList items={data.services} />
        </div>
        <div className="panel p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
            Strengths
          </div>
          <BulletList items={data.strengths} />
        </div>
      </div>
      <div className="panel p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
          Opportunities to Fix
        </div>
        <BulletList items={data.opportunities} />
      </div>
      <Field label="Local Angle" value={data.localAngle} />
    </div>
  );
}

function LandingTab({ data }: { data: AssetPack["landingPage"] }) {
  return (
    <div className="space-y-4">
      <Field label="Hero Headline" value={data.heroHeadline} copyable />
      <Field label="Hero Subheadline" value={data.heroSubheadline} copyable />
      <Field label="Offer & Positioning" value={data.offer} copyable />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Primary CTA" value={data.ctaPrimary} copyable />
        <Field label="Urgency Framing" value={data.ctaUrgency} copyable />
      </div>
      <div className="panel p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
          Trust Signals
        </div>
        <BulletList items={data.trustSignals} />
      </div>
    </div>
  );
}

function LeadTab({ data }: { data: AssetPack["leadCapture"] }) {
  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
          Qualification Questions
        </div>
        <BulletList items={data.qualificationQuestions} />
      </div>
      <div className="panel p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
          Intake Flow
        </div>
        <ol className="space-y-1.5">
          {data.intakeFlow?.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-white">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-semibold text-blue-300">
                {i + 1}
              </span>
              <span className="leading-relaxed pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <Field label="Lead Scoring Logic" value={data.leadScoring} />
      <Field label="Thank-You Page" value={data.thankYouPage} copyable />
    </div>
  );
}

function EmailTab({ data }: { data: AssetPack["emailSequence"] }) {
  return (
    <div className="space-y-3">
      {data?.map((email, i) => (
        <div key={i} className="panel p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="blue" className="text-xs">
                Day {email.day}
              </Badge>
              <span className="text-xs text-gray-500 capitalize">{email.purpose}</span>
            </div>
            <CopyButton text={`Subject: ${email.subject}\n\n${email.body}`} />
          </div>
          <div className="text-sm font-semibold text-white mb-1.5">{email.subject}</div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {email.body}
          </p>
        </div>
      ))}
    </div>
  );
}

function SmsTab({ data }: { data: AssetPack["smsSequence"] }) {
  return (
    <div className="space-y-3">
      {data?.map((sms, i) => (
        <div key={i} className="panel p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-sm font-medium text-white">{sms.label}</span>
              <span className="text-xs text-gray-500">· {sms.timing}</span>
            </div>
            <CopyButton text={sms.message} />
          </div>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {sms.message}
          </p>
        </div>
      ))}
    </div>
  );
}

function BookingTab({ data }: { data: AssetPack["bookingPage"] }) {
  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
          What to Expect
        </div>
        <BulletList items={data.whatToExpect} />
      </div>
      <Field label="Social Proof Structure" value={data.socialProofStructure} />
      <div className="panel p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-3">
          Objection Handling
        </div>
        <div className="space-y-3">
          {data.objectionHandling?.map((o, i) => (
            <div key={i} className="border-l-2 border-blue-500/30 pl-3">
              <div className="text-sm font-medium text-white mb-0.5">{o.objection}</div>
              <p className="text-sm text-gray-400 leading-relaxed">{o.response}</p>
            </div>
          ))}
        </div>
      </div>
      <Field label="Appointment Framing" value={data.appointmentFraming} copyable />
    </div>
  );
}
