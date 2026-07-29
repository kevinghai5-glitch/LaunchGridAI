"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Check } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { LgCard } from "@/components/ui/lg-card";
import { PublicProposal, BrowserFrame, MobileFrame } from "@/components/proposals/PublicProposal";
import type { SavedBusiness, ProposalContent } from "@/types";
import { APP_URL, APP_HOST } from "@/lib/constants";
import { buildProposalDefaults, proposalContentFromRow } from "@/lib/proposal-defaults";

const editorInputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 12px",
  fontSize: 13.5,
  background: "var(--surface)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
};
const areaStyle: React.CSSProperties = {
  ...editorInputStyle,
  height: "auto",
  padding: 10,
  resize: "vertical",
  lineHeight: 1.5,
};

export default function NewProposalPage() {
  const router = useRouter();
  const params = useSearchParams();
  const prefillBusinessId = params.get("businessId");
  const editId = params.get("id"); // present → edit an existing proposal

  const [businesses, setBusinesses] = useState<SavedBusiness[]>([]);
  const [businessId, setBusinessId] = useState(prefillBusinessId ?? "");
  const [content, setContent] = useState<ProposalContent | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proposalId, setProposalId] = useState<string | null>(editId);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("DRAFT");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const hydrated = useRef(false); // guards against re-prefilling over edited copy

  // Load saved businesses once.
  useEffect(() => {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((d) => {
        const list: SavedBusiness[] = d.businesses ?? [];
        setBusinesses(list);
        if (!editId && !businessId && list.length > 0) setBusinessId(list[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Edit mode: load the existing proposal and assemble renderable content.
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/proposals/${editId}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        const p = d.proposal;
        setBusinessId(p.businessId);
        setContent(proposalContentFromRow(p));
        setPublicId(p.publicId ?? null);
        setStatus(p.status ?? "DRAFT");
        setProposalId(p.id);
        hydrated.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Proposal not found");
          router.push("/proposals");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // New mode: once a business is picked, prefill with audit-grounded defaults.
  useEffect(() => {
    if (editId || !businessId || hydrated.current) return;
    const biz = businesses.find((b) => b.id === businessId);
    let cancelled = false;
    setLoading(true);
    // Ask the server for defaults grounded in the business's stored audit.
    fetch("/api/generate/proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (cancelled) return;
        setContent(d.proposalData as ProposalContent);
      })
      .catch(() => {
        // Fall back to local defaults if the API is unavailable.
        if (!cancelled && biz) setContent(buildProposalDefaults(biz));
      })
      .finally(() => {
        if (!cancelled) {
          hydrated.current = true;
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, businesses]);

  const business = businesses.find((b) => b.id === businessId);

  // Regenerate the whole proposal from the selected business's audit. When the
  // business has no audit on file the server runs one inline, so this can take
  // up to a minute.
  const regenerate = async (bizId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: bizId }),
      });
      if (res.ok) {
        const d = await res.json();
        setContent(d.proposalData as ProposalContent);
        return;
      }
      const biz = businesses.find((b) => b.id === bizId);
      if (biz) setContent(buildProposalDefaults(biz));
    } catch {
      const biz = businesses.find((b) => b.id === bizId);
      if (biz) setContent(buildProposalDefaults(biz));
    } finally {
      setLoading(false);
    }
  };

  // Generic content updater.
  const set = <K extends keyof ProposalContent>(key: K, value: ProposalContent[K]) =>
    setContent((c) => (c ? { ...c, [key]: value } : c));

  const handleSave = async () => {
    if (!business || !content) return toast.error("Pick a business first");
    setSaving(true);
    try {
      const payload = { businessId, ...content };
      const res = await fetch(
        proposalId ? `/api/proposals/${proposalId}` : "/api/proposals",
        {
          method: proposalId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        return;
      }
      const saved = data.proposal;
      setProposalId(saved.id);
      setPublicId(saved.publicId ?? null);
      setStatus(saved.status ?? "DRAFT");
      hydrated.current = true;
      if (!proposalId) router.replace(`/proposals/new?id=${saved.id}`);
      setSent(true);
      toast.success("Proposal saved");
      setTimeout(() => setSent(false), 1800);
    } catch {
      toast.error("Failed to save proposal");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (!publicId) return toast.error("Save the proposal first");
    navigator.clipboard.writeText(`${APP_URL}/p/${publicId}`);
    toast.success("Public link copied");
  };

  const handleDelete = async () => {
    if (!proposalId) return;
    if (!confirm("Delete this proposal?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete");
        return;
      }
      toast.success("Proposal deleted");
      router.push("/proposals");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <TopBar title="Proposals" />
      <div style={{ padding: "32px 40px 48px", maxWidth: 1440, margin: "0 auto" }}>
        <header className="flex justify-between items-end" style={{ marginBottom: 24 }}>
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-sans), sans-serif",
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: "var(--text)",
              }}
            >
              Proposal Builder
            </h1>
            <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 14.5 }}>
              One bespoke conversion offer. Edit on the left, live client view on the right.
            </p>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            {proposalId && (
              <LgButton
                variant="ghost"
                icon="eye"
                onClick={() => publicId && window.open(`/p/${publicId}`, "_blank")}
                disabled={!publicId}
              >
                Preview
              </LgButton>
            )}
            <LgButton variant="secondary" icon="link" onClick={handleCopyLink} disabled={!publicId}>
              Copy public link
            </LgButton>
            <LgButton variant="primary" icon="mail" onClick={handleSave} disabled={saving || !business}>
              {sent ? "Saved!" : saving ? "Saving…" : proposalId ? "Save changes" : "Send to client"}
            </LgButton>
            {proposalId && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Delete proposal"
                style={{
                  width: 36,
                  height: 36,
                  display: "grid",
                  placeItems: "center",
                  background: "transparent",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  color: "var(--text-3)",
                  cursor: deleting ? "default" : "pointer",
                }}
              >
                <Trash2 size={15} strokeWidth={1.75} />
              </button>
            )}
          </div>
        </header>

        {sent && (
          <div
            className="flex items-center lg-fade-in"
            style={{
              marginBottom: 20,
              padding: "12px 16px",
              gap: 12,
              background: "var(--success-soft)",
              borderRadius: "var(--radius)",
              border: "1px solid color-mix(in oklch, var(--success) 25%, transparent)",
            }}
          >
            <Check size={16} strokeWidth={2.5} style={{ color: "var(--success)" }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>
              Proposal saved
            </span>
          </div>
        )}

        {loading ? (
          <LgCard>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Building proposal from the audit — if this business has no audit on file yet,
              we run one now, which can take up to a minute…
            </div>
          </LgCard>
        ) : !business || !content ? (
          <LgCard>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Save a business first to draft a proposal.
            </div>
          </LgCard>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "380px 1fr", gap: 24 }}>
            <div className="flex flex-col" style={{ gap: 16 }}>
              <EditorCard label="Business">
                <select
                  value={businessId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setBusinessId(id);
                    hydrated.current = true; // we manually regenerate below
                    void regenerate(id);
                  }}
                  style={editorInputStyle}
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.city ?? "—"}
                    </option>
                  ))}
                </select>
                <LgButton
                  variant="ghost"
                  size="sm"
                  onClick={() => void regenerate(businessId)}
                  style={{ marginTop: 8, justifyContent: "flex-start" }}
                >
                  Regenerate from audit
                </LgButton>
              </EditorCard>

              <EditorCard label="Title">
                <input value={content.title} onChange={(e) => set("title", e.target.value)} style={editorInputStyle} />
              </EditorCard>

              <EditorCard label="Prepared by">
                <input
                  value={content.agencyName}
                  onChange={(e) => set("agencyName", e.target.value)}
                  placeholder="Your agency name"
                  style={editorInputStyle}
                />
              </EditorCard>

              <EditorCard label="Investment (CAD)">
                <div className="flex" style={{ gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <SubLabel>One-time setup</SubLabel>
                    <input
                      type="number"
                      value={content.setupFee}
                      onChange={(e) => set("setupFee", Number(e.target.value) || 0)}
                      style={editorInputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <SubLabel>Monthly retainer</SubLabel>
                    <input
                      type="number"
                      value={content.monthlyPrice}
                      onChange={(e) => set("monthlyPrice", Number(e.target.value) || 0)}
                      style={editorInputStyle}
                    />
                  </div>
                </div>
              </EditorCard>

              <EditorCard label="The problem">
                <SubLabel>Summary</SubLabel>
                <textarea
                  value={content.problem.summary}
                  onChange={(e) => set("problem", { ...content.problem, summary: e.target.value })}
                  rows={3}
                  style={areaStyle}
                />
                <div style={{ height: 8 }} />
                <SubLabel>Basis</SubLabel>
                <input
                  value={content.problem.basis}
                  onChange={(e) => set("problem", { ...content.problem, basis: e.target.value })}
                  style={editorInputStyle}
                />
                <div style={{ height: 10 }} />
                <SubLabel>Diagnosed leaks</SubLabel>
                <div className="flex flex-col" style={{ gap: 10 }}>
                  {content.problem.leaks.map((l, i) => (
                    <RowCard key={i} onRemove={() =>
                      set("problem", { ...content.problem, leaks: content.problem.leaks.filter((_, j) => j !== i) })
                    }>
                      <input
                        value={l.title}
                        placeholder="Leak"
                        onChange={(e) => {
                          const leaks = [...content.problem.leaks];
                          leaks[i] = { ...l, title: e.target.value };
                          set("problem", { ...content.problem, leaks });
                        }}
                        style={editorInputStyle}
                      />
                      <input
                        value={l.monthlyCost}
                        placeholder="Monthly cost (e.g. $2,400–$3,800 / mo)"
                        onChange={(e) => {
                          const leaks = [...content.problem.leaks];
                          leaks[i] = { ...l, monthlyCost: e.target.value };
                          set("problem", { ...content.problem, leaks });
                        }}
                        style={{ ...editorInputStyle, marginTop: 6 }}
                      />
                      <textarea
                        value={l.detail}
                        placeholder="What's leaking and why it costs them"
                        rows={2}
                        onChange={(e) => {
                          const leaks = [...content.problem.leaks];
                          leaks[i] = { ...l, detail: e.target.value };
                          set("problem", { ...content.problem, leaks });
                        }}
                        style={{ ...areaStyle, marginTop: 6 }}
                      />
                    </RowCard>
                  ))}
                  <LgButton
                    variant="ghost"
                    size="sm"
                    icon="plus"
                    onClick={() =>
                      set("problem", {
                        ...content.problem,
                        leaks: [...content.problem.leaks, { title: "New leak", monthlyCost: "", detail: "" }],
                      })
                    }
                    style={{ justifyContent: "flex-start" }}
                  >
                    Add leak
                  </LgButton>
                </div>
              </EditorCard>

              <EditorCard label="What we deploy">
                <SubLabel>Solution overview</SubLabel>
                <textarea
                  value={content.packageOverview}
                  onChange={(e) => set("packageOverview", e.target.value)}
                  rows={3}
                  style={areaStyle}
                />
                <div style={{ height: 10 }} />
                <SubLabel>Components (tied to leaks)</SubLabel>
                <div className="flex flex-col" style={{ gap: 10 }}>
                  {content.deliverables.map((c, i) => (
                    <RowCard key={i} onRemove={() =>
                      set("deliverables", content.deliverables.filter((_, j) => j !== i))
                    }>
                      <input
                        value={c.name}
                        placeholder="Component name"
                        onChange={(e) => {
                          const d = [...content.deliverables];
                          d[i] = { ...c, name: e.target.value };
                          set("deliverables", d);
                        }}
                        style={editorInputStyle}
                      />
                      <input
                        value={c.addresses}
                        placeholder="Closes which leak?"
                        onChange={(e) => {
                          const d = [...content.deliverables];
                          d[i] = { ...c, addresses: e.target.value };
                          set("deliverables", d);
                        }}
                        style={{ ...editorInputStyle, marginTop: 6 }}
                      />
                      <textarea
                        value={c.detail}
                        placeholder="What we build / deploy / manage"
                        rows={2}
                        onChange={(e) => {
                          const d = [...content.deliverables];
                          d[i] = { ...c, detail: e.target.value };
                          set("deliverables", d);
                        }}
                        style={{ ...areaStyle, marginTop: 6 }}
                      />
                      <label className="flex items-center" style={{ gap: 6, marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                        <input
                          type="checkbox"
                          checked={c.isRetainer}
                          onChange={(e) => {
                            const d = [...content.deliverables];
                            d[i] = { ...c, isRetainer: e.target.checked };
                            set("deliverables", d);
                          }}
                        />
                        Runs continuously (retainer engine)
                      </label>
                    </RowCard>
                  ))}
                  <LgButton
                    variant="ghost"
                    size="sm"
                    icon="plus"
                    onClick={() =>
                      set("deliverables", [
                        ...content.deliverables,
                        { name: "New component", addresses: "", detail: "", isRetainer: false },
                      ])
                    }
                    style={{ justifyContent: "flex-start" }}
                  >
                    Add component
                  </LgButton>
                </div>
              </EditorCard>

              <EditorCard label="The return (ROI)">
                <SubLabel>Summary</SubLabel>
                <textarea
                  value={content.roi.summary}
                  onChange={(e) => set("roi", { ...content.roi, summary: e.target.value })}
                  rows={2}
                  style={areaStyle}
                />
                <div style={{ height: 8 }} />
                <SubLabel>Recovered (dollarized)</SubLabel>
                <input
                  value={content.roi.recovered}
                  onChange={(e) => set("roi", { ...content.roi, recovered: e.target.value })}
                  style={editorInputStyle}
                />
                <div style={{ height: 10 }} />
                <SubLabel>Points</SubLabel>
                <StringList
                  items={content.roi.points}
                  onChange={(points) => set("roi", { ...content.roi, points })}
                  placeholder="ROI point"
                />
              </EditorCard>

              <EditorCard label="Scope">
                <SubLabel>Included</SubLabel>
                <StringList
                  items={content.scope.included}
                  onChange={(included) => set("scope", { ...content.scope, included })}
                  placeholder="Included item"
                />
                <div style={{ height: 10 }} />
                <SubLabel>Not included</SubLabel>
                <StringList
                  items={content.scope.excluded}
                  onChange={(excluded) => set("scope", { ...content.scope, excluded })}
                  placeholder="Excluded item"
                />
              </EditorCard>

              <EditorCard label="Timeline">
                <div className="flex flex-col" style={{ gap: 10 }}>
                  {content.timeline.map((p, i) => (
                    <RowCard key={i} onRemove={() => set("timeline", content.timeline.filter((_, j) => j !== i))}>
                      <input
                        value={p.label}
                        placeholder="Phase label"
                        onChange={(e) => {
                          const t = [...content.timeline];
                          t[i] = { ...p, label: e.target.value };
                          set("timeline", t);
                        }}
                        style={editorInputStyle}
                      />
                      <textarea
                        value={p.detail}
                        placeholder="What happens in this phase"
                        rows={2}
                        onChange={(e) => {
                          const t = [...content.timeline];
                          t[i] = { ...p, detail: e.target.value };
                          set("timeline", t);
                        }}
                        style={{ ...areaStyle, marginTop: 6 }}
                      />
                    </RowCard>
                  ))}
                  <LgButton
                    variant="ghost"
                    size="sm"
                    icon="plus"
                    onClick={() => set("timeline", [...content.timeline, { label: "New phase", detail: "" }])}
                    style={{ justifyContent: "flex-start" }}
                  >
                    Add phase
                  </LgButton>
                </div>
              </EditorCard>

              <EditorCard label="Proof">
                <SubLabel>Note (shown when no testimonials)</SubLabel>
                <textarea
                  value={content.proof.note}
                  onChange={(e) => set("proof", { ...content.proof, note: e.target.value })}
                  rows={2}
                  style={areaStyle}
                />
                <div style={{ height: 10 }} />
                <SubLabel>Testimonials (never fabricate)</SubLabel>
                <div className="flex flex-col" style={{ gap: 10 }}>
                  {content.proof.testimonials.map((t, i) => (
                    <RowCard key={i} onRemove={() =>
                      set("proof", { ...content.proof, testimonials: content.proof.testimonials.filter((_, j) => j !== i) })
                    }>
                      <textarea
                        value={t.quote}
                        placeholder="Quote"
                        rows={2}
                        onChange={(e) => {
                          const ts = [...content.proof.testimonials];
                          ts[i] = { ...t, quote: e.target.value };
                          set("proof", { ...content.proof, testimonials: ts });
                        }}
                        style={areaStyle}
                      />
                      <input
                        value={t.attribution}
                        placeholder="Attribution"
                        onChange={(e) => {
                          const ts = [...content.proof.testimonials];
                          ts[i] = { ...t, attribution: e.target.value };
                          set("proof", { ...content.proof, testimonials: ts });
                        }}
                        style={{ ...editorInputStyle, marginTop: 6 }}
                      />
                    </RowCard>
                  ))}
                  <LgButton
                    variant="ghost"
                    size="sm"
                    icon="plus"
                    onClick={() =>
                      set("proof", {
                        ...content.proof,
                        testimonials: [...content.proof.testimonials, { quote: "", attribution: "" }],
                      })
                    }
                    style={{ justifyContent: "flex-start" }}
                  >
                    Add testimonial
                  </LgButton>
                </div>
              </EditorCard>

              <EditorCard label="Next step">
                <textarea
                  value={content.nextSteps}
                  onChange={(e) => set("nextSteps", e.target.value)}
                  rows={3}
                  style={areaStyle}
                />
              </EditorCard>

              <EditorCard label="FAQ">
                <div className="flex flex-col" style={{ gap: 10 }}>
                  {content.faq.map((f, i) => (
                    <RowCard key={i} onRemove={() => set("faq", content.faq.filter((_, j) => j !== i))}>
                      <input
                        value={f.q}
                        placeholder="Question"
                        onChange={(e) => {
                          const q = [...content.faq];
                          q[i] = { ...f, q: e.target.value };
                          set("faq", q);
                        }}
                        style={editorInputStyle}
                      />
                      <textarea
                        value={f.a}
                        placeholder="Answer"
                        rows={2}
                        onChange={(e) => {
                          const q = [...content.faq];
                          q[i] = { ...f, a: e.target.value };
                          set("faq", q);
                        }}
                        style={{ ...areaStyle, marginTop: 6 }}
                      />
                    </RowCard>
                  ))}
                  <LgButton
                    variant="ghost"
                    size="sm"
                    icon="plus"
                    onClick={() => set("faq", [...content.faq, { q: "New question", a: "" }])}
                    style={{ justifyContent: "flex-start" }}
                  >
                    Add question
                  </LgButton>
                </div>
              </EditorCard>

              <EditorCard label="Send to">
                <div className="flex flex-col" style={{ gap: 8 }}>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Recipient name"
                    style={editorInputStyle}
                  />
                  <input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Recipient email"
                    style={editorInputStyle}
                  />
                </div>
              </EditorCard>
            </div>

            <div className="relative">
              <div className="flex items-start justify-center" style={{ gap: 24 }}>
                <div style={{ flex: "0 1 820px", minWidth: 0 }}>
                  {/* Shows the SAME address the "Copy link" button copies —
                      configured host + the real publicId. Before the first save
                      there is no publicId yet, so the slot is shown as pending
                      rather than inventing an id the link won't resolve to. */}
                  <BrowserFrame
                    url={`${APP_HOST}/p/${publicId ?? "…"}`}
                  >
                    <PublicProposal business={business} content={content} />
                  </BrowserFrame>
                </div>
                <div style={{ flex: "0 0 280px" }}>
                  <MobileFrame>
                    <PublicProposal business={business} content={content} mobile />
                  </MobileFrame>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function EditorCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-subtle)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-subtle)", marginBottom: 5 }}>
      {children}
    </div>
  );
}

function RowCard({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div
      className="relative"
      style={{ border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 10 }}
    >
      <button
        onClick={onRemove}
        aria-label="Remove"
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          width: 24,
          height: 24,
          display: "grid",
          placeItems: "center",
          background: "transparent",
          border: "none",
          color: "var(--text-subtle)",
          cursor: "pointer",
          borderRadius: 6,
        }}
      >
        <Trash2 size={12} strokeWidth={1.75} />
      </button>
      {children}
    </div>
  );
}

function StringList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      {items.map((s, i) => (
        <div key={i} className="flex items-center" style={{ gap: 6 }}>
          <input
            value={s}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            style={{ ...editorInputStyle, flex: 1 }}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            title="Remove"
            style={{
              width: 28,
              height: 28,
              padding: 0,
              background: "transparent",
              border: "none",
              color: "var(--text-subtle)",
              cursor: "pointer",
              borderRadius: 6,
            }}
          >
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
        </div>
      ))}
      <LgButton
        variant="ghost"
        size="sm"
        icon="plus"
        onClick={() => onChange([...items, ""])}
        style={{ justifyContent: "flex-start" }}
      >
        Add
      </LgButton>
    </div>
  );
}
