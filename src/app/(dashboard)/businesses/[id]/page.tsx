"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetPackView } from "@/components/businesses/AssetPackView";
import type { AssetPack } from "@/types";
import { STATUS_META, type LeadStatus } from "@/lib/call-queue";
import {
  MapPin,
  Phone,
  Globe,
  Star,
  Heart,
  HeartOff,
  ExternalLink,
  Sparkles,
  FileText,
  Loader2,
  ArrowLeft,
  Zap,
  Target,
  Lightbulb,
  Rocket,
  PhoneCall,
  Check,
} from "lucide-react";

// Operator-selectable statuses for the manual record control.
const RECORD_STATUSES: LeadStatus[] = [
  "QUEUED",
  "CALLBACK",
  "WAITING",
  "BOOKED_ZOOM",
  "PROPOSAL",
  "WON",
  "DEAD",
];

function dispositionLabel(d: string): string {
  return d.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

interface BusinessWithSystems {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  industry: string | null;
  city: string | null;
  category: string | null;
  description: string | null;
  photoUrl: string | null;
  favorited: boolean;
  painPoint: string | null;
  outreachAngle: string | null;
  suggestedOffer: string | null;
  generatedSystems: Array<{ id: string; type: string; content: unknown; createdAt: string }>;
  proposals: Array<{ id: string; title: string; status: string; monthlyPrice: number; createdAt: string }>;
  // CRM record fields
  status: string;
  nextAction: string | null;
  nextActionAt: string | null;
  attemptCount: number;
  notes: string | null;
  lastActivityAt: string | null;
  // Deliverable numbers (blank → benchmark mode)
  avgClientValueCad: number | null;
  monthlyLeadVolume: number | null;
  monthlyAdSpendCad: number | null;
  // Intake system booleans (null = unknown / not asked) + services-focus copy hint
  hasCrm: boolean | null;
  hasFollowUpSequence: boolean | null;
  hasReminderSystem: boolean | null;
  hasPastCustomerDatabase: boolean | null;
  servicesFocus: string | null;
  callLogs: Array<{
    id: string;
    disposition: string;
    note: string | null;
    durationSec: number | null;
    calledAt: string;
  }>;
}

export default function BusinessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [business, setBusiness] = useState<BusinessWithSystems | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  // Client-intake card: local drafts (empty string = blank = benchmark)
  const [numbersDraft, setNumbersDraft] = useState({
    avgClientValueCad: "",
    monthlyLeadVolume: "",
  });
  // Intake system booleans as a tri-state control ("unknown" = null = not asked).
  const [intakeDraft, setIntakeDraft] = useState<{
    hasCrm: "yes" | "no" | "unknown";
    hasFollowUpSequence: "yes" | "no" | "unknown";
    hasReminderSystem: "yes" | "no" | "unknown";
    hasPastCustomerDatabase: "yes" | "no" | "unknown";
    servicesFocus: string;
  }>({
    hasCrm: "unknown",
    hasFollowUpSequence: "unknown",
    hasReminderSystem: "unknown",
    hasPastCustomerDatabase: "unknown",
    servicesFocus: "",
  });
  const [savingNumbers, setSavingNumbers] = useState(false);

  useEffect(() => {
    loadBusiness();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadBusiness = async () => {
    try {
      const res = await fetch(`/api/businesses/${id}`);
      if (!res.ok) {
        toast.error("Business not found");
        router.push("/businesses");
        return;
      }
      const data = await res.json();
      setBusiness(data.business);
      setNotesDraft(data.business.notes ?? "");
      setNumbersDraft({
        avgClientValueCad: data.business.avgClientValueCad?.toString() ?? "",
        monthlyLeadVolume: data.business.monthlyLeadVolume?.toString() ?? "",
      });
      const b2tri = (v: boolean | null | undefined): "yes" | "no" | "unknown" =>
        v === true ? "yes" : v === false ? "no" : "unknown";
      setIntakeDraft({
        hasCrm: b2tri(data.business.hasCrm),
        hasFollowUpSequence: b2tri(data.business.hasFollowUpSequence),
        hasReminderSystem: b2tri(data.business.hasReminderSystem),
        hasPastCustomerDatabase: b2tri(data.business.hasPastCustomerDatabase),
        servicesFocus: data.business.servicesFocus ?? "",
      });
    } catch {
      toast.error("Failed to load business");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!business || status === business.status) return;
    setSavingStatus(true);
    const before = business.status;
    setBusiness((prev) => (prev ? { ...prev, status } : prev));
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setBusiness((prev) => (prev ? { ...prev, status: before } : prev));
        toast.error("Failed to update status");
      } else {
        toast.success("Status updated");
      }
    } catch {
      setBusiness((prev) => (prev ? { ...prev, status: before } : prev));
      toast.error("Failed to update status");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!business || notesDraft === (business.notes ?? "")) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });
      if (!res.ok) {
        toast.error("Failed to save notes");
      } else {
        setBusiness((prev) => (prev ? { ...prev, notes: notesDraft } : prev));
        toast.success("Notes saved");
      }
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  // Persist the three deliverable numbers. Empty string → null (benchmark mode).
  const handleSaveNumbers = async () => {
    if (!business) return;
    const toValue = (s: string): number | null => {
      const t = s.trim();
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
    };
    const tri2bool = (t: "yes" | "no" | "unknown"): boolean | null =>
      t === "yes" ? true : t === "no" ? false : null;
    const focus = intakeDraft.servicesFocus.trim();
    const payload = {
      avgClientValueCad: toValue(numbersDraft.avgClientValueCad),
      monthlyLeadVolume: toValue(numbersDraft.monthlyLeadVolume),
      hasCrm: tri2bool(intakeDraft.hasCrm),
      hasFollowUpSequence: tri2bool(intakeDraft.hasFollowUpSequence),
      hasReminderSystem: tri2bool(intakeDraft.hasReminderSystem),
      hasPastCustomerDatabase: tri2bool(intakeDraft.hasPastCustomerDatabase),
      servicesFocus: focus || null,
    };
    setSavingNumbers(true);
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save intake");
        return;
      }
      setBusiness(data.business);
      toast.success("Client intake saved");
    } catch {
      toast.error("Failed to save intake");
    } finally {
      setSavingNumbers(false);
    }
  };

  const handleFavorite = async () => {
    if (!business) return;
    setFavoriting(true);
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: !business.favorited }),
      });
      const data = await res.json();
      if (res.ok) {
        setBusiness(data.business);
        toast.success(data.business.favorited ? "Added to favorites" : "Removed from favorites");
      }
    } catch {
      toast.error("Failed to update favorite");
    } finally {
      setFavoriting(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    setGeneratingSuggestions(true);
    try {
      const res = await fetch("/api/generate/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to generate suggestions");
        return;
      }
      setBusiness((prev) => prev ? { ...prev, ...data.suggestions } : prev);
      toast.success("AI suggestions generated");
    } catch {
      toast.error("Failed to generate suggestions");
    } finally {
      setGeneratingSuggestions(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <TopBar title="Business Details" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!business) return null;

  const assetSystems = business.generatedSystems.filter((s) => s.type === "ASSETS");
  const latestAssetPack = assetSystems[0]?.content as AssetPack | undefined;

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title={business.name} subtitle={`${business.industry ?? ""} · ${business.city ?? ""}`} />
      <div className="p-6 space-y-6">
        {/* Back */}
        <Button variant="ghost" size="sm" asChild className="text-[color:var(--text-3)]">
          <Link href="/businesses">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Businesses
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Business info */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[color:var(--text)]">{business.name}</h2>
                  <p className="text-sm text-[color:var(--text-3)]">{business.industry}</p>
                </div>
                <Button
                  size="icon"
                  variant={business.favorited ? "blue" : "outline"}
                  className="h-8 w-8"
                  onClick={handleFavorite}
                  disabled={favoriting}
                  aria-label={business.favorited ? "Remove from favorites" : "Add to favorites"}
                >
                  {favoriting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : business.favorited ? (
                    <Heart className="h-4 w-4 fill-current" />
                  ) : (
                    <HeartOff className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="space-y-2 text-sm text-[color:var(--text-3)]">
                {business.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-[color:var(--text-4)]" />
                    <span>{business.address}</span>
                  </div>
                )}
                {business.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-[color:var(--text-4)]" />
                    <a href={`tel:${business.phone}`} className="hover:text-[color:var(--accent)]">{business.phone}</a>
                  </div>
                )}
                {business.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 shrink-0 text-[color:var(--text-4)]" />
                    <a href={business.website} target="_blank" rel="noopener noreferrer" className="truncate hover:text-[color:var(--accent)]">
                      {business.website.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  </div>
                )}
                {business.rating && (
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 shrink-0 text-yellow-400 fill-yellow-400" />
                    <span>{business.rating.toFixed(1)} ({business.reviewCount} reviews)</span>
                  </div>
                )}
                {business.mapsUrl && (
                  <a
                    href={business.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[color:var(--accent)] hover:text-[color:var(--accent-hover)] mt-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on Google Maps
                  </a>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[color:var(--text)] mb-2">Actions</h3>
              <Button variant="blue" className="w-full" asChild>
                <Link href={`/library?businessId=${id}`}>
                  <Rocket className="h-4 w-4 mr-2" />
                  Open in workspace
                </Link>
              </Button>
              <p className="text-xs text-[color:var(--text-4)] -mt-1 mb-1">
                Generate the growth pack, cold audit &amp; proposal from the Library control centre.
              </p>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={`/proposals/new?businessId=${id}`}>
                  <FileText className="h-4 w-4 mr-2" />
                  Create Proposal
                </Link>
              </Button>
            </div>

            {/* CRM record: status + notes */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[color:var(--text)]">Lead record</h3>

              {/* status control */}
              <div>
                <div className="text-xs text-[color:var(--text-3)] mb-2">Status</div>
                <div className="flex flex-wrap gap-1.5">
                  {RECORD_STATUSES.map((s) => {
                    const active = business.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        disabled={savingStatus}
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          padding: "5px 10px",
                          borderRadius: 7,
                          cursor: savingStatus ? "default" : "pointer",
                          fontFamily: "inherit",
                          color: active ? "var(--accent)" : "var(--text-3)",
                          background: active ? "var(--accent-soft)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${active ? "oklch(0.55 0.18 248 / 0.4)" : "var(--line)"}`,
                        }}
                      >
                        {STATUS_META[s].label}
                      </button>
                    );
                  })}
                </div>
                {business.nextAction && (
                  <div className="text-xs text-[color:var(--text-4)] mt-2.5">
                    Next: {business.nextAction}
                    {business.nextActionAt
                      ? ` · ${new Date(business.nextActionAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                      : ""}
                  </div>
                )}
              </div>

              {/* notes */}
              <div>
                <div className="text-xs text-[color:var(--text-3)] mb-2">Notes</div>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Account notes, context, reminders…"
                  rows={4}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    borderRadius: 8,
                    border: "1px solid var(--line-strong)",
                    background: "var(--bg-deep, #0b0d12)",
                    color: "var(--text)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    padding: "9px 11px",
                    outline: "none",
                  }}
                />
                {notesDraft !== (business.notes ?? "") && (
                  <div className="flex justify-end mt-2">
                    <Button variant="blue" size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
                      {savingNotes ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                      Save notes
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Client intake: powers REAL-mode math + confirmed-vs-benchmark leak
                framing in D1–D4. Blank / Unknown = industry benchmarks. */}
            <div className="glass-card p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--text)]">Client intake</h3>
                <p className="text-xs text-[color:var(--text-4)] mt-1" style={{ lineHeight: 1.5 }}>
                  Optional. Fill these in and the paid deliverables run the client&apos;s real
                  economics and confirmed systems. Leave blank and they fall back to industry
                  benchmarks.
                </p>
              </div>

              {(() => {
                const fields: Array<{
                  key: keyof typeof numbersDraft;
                  label: string;
                  hint: string;
                  prefix?: string;
                }> = [
                  { key: "avgClientValueCad", label: "Avg. customer value", hint: "one closed client", prefix: "$" },
                  { key: "monthlyLeadVolume", label: "Monthly inquiries", hint: "inbound leads / mo" },
                ];
                const b2tri = (v: boolean | null | undefined): "yes" | "no" | "unknown" =>
                  v === true ? "yes" : v === false ? "no" : "unknown";
                const storedNumbers = {
                  avgClientValueCad: business.avgClientValueCad?.toString() ?? "",
                  monthlyLeadVolume: business.monthlyLeadVolume?.toString() ?? "",
                };
                const storedIntake = {
                  hasCrm: b2tri(business.hasCrm),
                  hasFollowUpSequence: b2tri(business.hasFollowUpSequence),
                  hasReminderSystem: b2tri(business.hasReminderSystem),
                  hasPastCustomerDatabase: b2tri(business.hasPastCustomerDatabase),
                  servicesFocus: business.servicesFocus ?? "",
                };
                const numbersDirty =
                  numbersDraft.avgClientValueCad !== storedNumbers.avgClientValueCad ||
                  numbersDraft.monthlyLeadVolume !== storedNumbers.monthlyLeadVolume;
                const intakeDirty =
                  intakeDraft.hasCrm !== storedIntake.hasCrm ||
                  intakeDraft.hasFollowUpSequence !== storedIntake.hasFollowUpSequence ||
                  intakeDraft.hasReminderSystem !== storedIntake.hasReminderSystem ||
                  intakeDraft.hasPastCustomerDatabase !== storedIntake.hasPastCustomerDatabase ||
                  intakeDraft.servicesFocus.trim() !== storedIntake.servicesFocus.trim();
                const dirty = numbersDirty || intakeDirty;

                const systemQuestions: Array<{
                  key: "hasCrm" | "hasFollowUpSequence" | "hasReminderSystem" | "hasPastCustomerDatabase";
                  label: string;
                }> = [
                  { key: "hasCrm", label: "CRM / lead pipeline" },
                  { key: "hasFollowUpSequence", label: "Automated follow-up" },
                  { key: "hasReminderSystem", label: "Appointment reminders" },
                  { key: "hasPastCustomerDatabase", label: "Past-customer list" },
                ];

                return (
                  <>
                    <div className="space-y-3">
                      {fields.map((f) => (
                        <div key={f.key}>
                          <div className="flex items-baseline justify-between mb-1.5">
                            <label className="text-xs text-[color:var(--text-3)]">{f.label}</label>
                            <span className="text-[11px] text-[color:var(--text-4)]">{f.hint}</span>
                          </div>
                          <div style={{ position: "relative" }}>
                            {f.prefix && (
                              <span
                                style={{
                                  position: "absolute",
                                  left: 11,
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  color: "var(--text-3)",
                                  fontSize: 13,
                                  pointerEvents: "none",
                                }}
                              >
                                {f.prefix}
                              </span>
                            )}
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={numbersDraft[f.key]}
                              onChange={(e) =>
                                setNumbersDraft((prev) => ({ ...prev, [f.key]: e.target.value }))
                              }
                              placeholder="—"
                              style={{
                                width: "100%",
                                borderRadius: 8,
                                border: "1px solid var(--line-strong)",
                                background: "var(--bg-deep, #0b0d12)",
                                color: "var(--text)",
                                fontFamily: "inherit",
                                fontSize: 13,
                                padding: f.prefix ? "9px 11px 9px 22px" : "9px 11px",
                                outline: "none",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Systems the client already has — Yes suppresses that leak,
                        No renders it "Confirmed at intake", Unknown = benchmark hedge. */}
                    <div className="space-y-2.5 pt-1">
                      <div className="text-[11px] uppercase tracking-wide text-[color:var(--text-4)]">
                        Systems already in place
                      </div>
                      {systemQuestions.map((q) => (
                        <div key={q.key} className="flex items-center justify-between gap-3">
                          <label className="text-xs text-[color:var(--text-3)]">{q.label}</label>
                          <div
                            style={{
                              display: "inline-flex",
                              borderRadius: 8,
                              overflow: "hidden",
                              border: "1px solid var(--line-strong)",
                            }}
                          >
                            {(["yes", "no", "unknown"] as const).map((opt) => {
                              const active = intakeDraft[q.key] === opt;
                              const text = opt === "yes" ? "Yes" : opt === "no" ? "No" : "?";
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() =>
                                    setIntakeDraft((prev) => ({ ...prev, [q.key]: opt }))
                                  }
                                  style={{
                                    padding: "5px 12px",
                                    fontSize: 12,
                                    fontFamily: "inherit",
                                    cursor: "pointer",
                                    border: "none",
                                    borderLeft:
                                      opt === "yes" ? "none" : "1px solid var(--line-strong)",
                                    background: active ? "var(--accent-grad)" : "transparent",
                                    color: active ? "#fff" : "var(--text-3)",
                                  }}
                                >
                                  {text}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Services they want more of — copy emphasis ONLY. */}
                    <div className="pt-1">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <label className="text-xs text-[color:var(--text-3)]">Services they want more of</label>
                        <span className="text-[11px] text-[color:var(--text-4)]">from intake form</span>
                      </div>
                      <textarea
                        value={intakeDraft.servicesFocus}
                        maxLength={300}
                        rows={2}
                        onChange={(e) =>
                          setIntakeDraft((prev) => ({ ...prev, servicesFocus: e.target.value }))
                        }
                        placeholder="e.g. emergency drain calls, water heater installs"
                        style={{
                          width: "100%",
                          borderRadius: 8,
                          border: "1px solid var(--line-strong)",
                          background: "var(--bg-deep, #0b0d12)",
                          color: "var(--text)",
                          fontFamily: "inherit",
                          fontSize: 13,
                          padding: "9px 11px",
                          outline: "none",
                          resize: "vertical",
                        }}
                      />
                      <p className="text-[11px] text-[color:var(--text-4)] mt-1" style={{ lineHeight: 1.5 }}>
                        Shapes copy wording only — never changes which leaks fire, the scores, or
                        the math.
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[color:var(--text-4)]">
                        {business.avgClientValueCad || business.monthlyLeadVolume
                          ? "Real-mode math active"
                          : "Benchmark mode"}
                      </span>
                      {dirty && (
                        <Button variant="blue" size="sm" onClick={handleSaveNumbers} disabled={savingNumbers}>
                          {savingNumbers ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Check className="h-3 w-3 mr-1" />
                          )}
                          Save intake
                        </Button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* AI Suggestions + Systems */}
          <div className="lg:col-span-2 space-y-4">
            {/* AI Suggestions panel */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[color:var(--accent)]" />
                  <h3 className="text-sm font-semibold text-[color:var(--text)]">AI-Generated Suggestions</h3>
                  <Badge variant="blue" className="text-xs">AI</Badge>
                </div>
                <Button
                  variant="blue-outline"
                  size="sm"
                  onClick={handleGenerateSuggestions}
                  disabled={generatingSuggestions}
                >
                  {generatingSuggestions ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  {business.painPoint ? "Regenerate" : "Generate"}
                </Button>
              </div>

              {business.painPoint ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="panel p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-3.5 w-3.5 text-red-400" />
                      <span className="text-xs font-medium text-[color:var(--text-3)]">Pain Point</span>
                    </div>
                    <p className="text-sm text-[color:var(--text)]">{business.painPoint}</p>
                  </div>
                  <div className="panel p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="h-3.5 w-3.5 text-yellow-400" />
                      <span className="text-xs font-medium text-[color:var(--text-3)]">Outreach Angle</span>
                    </div>
                    <p className="text-sm text-[color:var(--text)]">{business.outreachAngle}</p>
                  </div>
                  <div className="panel p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-3.5 w-3.5 text-green-400" />
                      <span className="text-xs font-medium text-[color:var(--text-3)]">Suggested Offer</span>
                    </div>
                    <p className="text-sm text-[color:var(--text)]">{business.suggestedOffer}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-[color:var(--text-4)]">
                  <Sparkles className="h-8 w-8 text-[color:var(--text-4)] mx-auto mb-3" />
                  <p className="text-sm">Click &quot;Generate&quot; to get AI-powered insights for this business</p>
                </div>
              )}
            </div>

            {/* Generated Asset Pack */}
            {latestAssetPack && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Rocket className="h-4 w-4 text-[color:var(--accent)]" />
                  <h3 className="text-sm font-semibold text-[color:var(--text)]">Generated Asset Pack</h3>
                  <span className="text-xs text-[color:var(--text-4)]">
                    · {new Date(assetSystems[0].createdAt).toLocaleDateString()}
                  </span>
                </div>
                <AssetPackView pack={latestAssetPack} businessId={business.id} />
              </div>
            )}

            {/* Call history timeline */}
            {business.callLogs.length > 0 && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <PhoneCall className="h-4 w-4 text-[color:var(--accent)]" />
                  <h3 className="text-sm font-semibold text-[color:var(--text)]">Call history</h3>
                  <span className="text-xs text-[color:var(--text-4)]">
                    · {business.attemptCount} attempt{business.attemptCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-0">
                  {business.callLogs.map((log, i) => (
                    <div key={log.id} className="flex gap-3">
                      {/* rail */}
                      <div className="flex flex-col items-center" style={{ width: 16 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 99,
                            background: "var(--accent)",
                            marginTop: 5,
                            flex: "none",
                          }}
                        />
                        {i < business.callLogs.length - 1 && (
                          <span style={{ width: 1, flex: 1, background: "var(--line)", marginTop: 2 }} />
                        )}
                      </div>
                      {/* entry */}
                      <div style={{ paddingBottom: i < business.callLogs.length - 1 ? 16 : 0, flex: 1 }}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[color:var(--text)]">
                            {dispositionLabel(log.disposition)}
                          </span>
                          <span className="text-xs text-[color:var(--text-4)]">
                            {new Date(log.calledAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            {new Date(log.calledAt).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {log.note && (
                          <p className="text-xs text-[color:var(--text-3)] mt-1" style={{ lineHeight: 1.55 }}>
                            {log.note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generated Systems */}
            {business.generatedSystems.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-[color:var(--text)] mb-4">Generated Systems</h3>
                <div className="space-y-3">
                  {business.generatedSystems.map((system) => (
                    <div key={system.id} className="panel p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {system.type === "LEAD" ? (
                          <Target className="h-4 w-4 text-[color:var(--accent)]" />
                        ) : system.type === "ASSETS" ? (
                          <Rocket className="h-4 w-4 text-[color:var(--accent)]" />
                        ) : (
                          <Zap className="h-4 w-4 text-[color:var(--accent)]" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-[color:var(--text)]">
                            {system.type === "LEAD"
                              ? "Lead Capture System"
                              : system.type === "ASSETS"
                              ? "Growth Infrastructure Pack"
                              : "Content Calendar System"}
                          </div>
                          <div className="text-xs text-[color:var(--text-4)]">
                            Generated {new Date(system.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Badge variant={system.type === "LEAD" ? "blue" : "green"}>
                        {system.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proposals */}
            {business.proposals.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-[color:var(--text)] mb-4">Proposals</h3>
                <div className="space-y-3">
                  {business.proposals.map((p) => (
                    <Link
                      key={p.id}
                      href={`/proposals/${p.id}`}
                      className="panel p-4 flex items-center justify-between group hover:border-[color:var(--accent-soft)] transition-all"
                    >
                      <div>
                        <div className="text-sm font-medium text-[color:var(--text)] group-hover:text-[color:var(--accent-hover)] transition-colors">{p.title}</div>
                        <div className="text-xs text-[color:var(--text-4)]">${p.monthlyPrice}/mo</div>
                      </div>
                      <Badge variant={p.status === "ACCEPTED" ? "green" : p.status === "SENT" ? "blue" : "gray"}>
                        {p.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
