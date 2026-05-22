"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Trash2, GripVertical, Check } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { LgCard } from "@/components/ui/lg-card";
import { PublicProposal, BrowserFrame, MobileFrame } from "@/components/proposals/PublicProposal";
import type { SavedBusiness } from "@/types";
import { PRICING_PRESETS } from "@/lib/constants";

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

export default function NewProposalPage() {
  const router = useRouter();
  const params = useSearchParams();
  const prefillId = params.get("businessId");

  const [businesses, setBusinesses] = useState<SavedBusiness[]>([]);
  const [businessId, setBusinessId] = useState(prefillId ?? "");
  const [title, setTitle] = useState("");
  const [overview, setOverview] = useState("");
  const [price, setPrice] = useState<number>(497);
  const [deliverables, setDeliverables] = useState<string[]>([
    "Custom-written lead capture funnel",
    "Qualification questions for higher-intent leads",
    "5-day automated SMS + email follow-up",
    "Monthly performance review & optimization",
    "Dedicated Slack/text channel for support",
  ]);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then((d) => {
        const list: SavedBusiness[] = d.businesses ?? [];
        setBusinesses(list);
        if (!businessId && list.length > 0) setBusinessId(list[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const business = businesses.find((b) => b.id === businessId);

  useEffect(() => {
    if (!business) return;
    if (!title)
      setTitle(`Monthly AI Lead System — ${business.name}`);
    if (!overview)
      setOverview(
        `A complete, done-for-you Lead Capture System custom-built for ${business.name}. Designed to bring in qualified ${(business.industry ?? "business").toLowerCase()} inquiries every month from ${business.city?.split(",")[0] ?? "your city"} — without you lifting a finger.`
      );
    if (!contactEmail && business.website)
      setContactEmail(`owner@${business.website}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  const updateDel = (i: number, v: string) => {
    const next = [...deliverables];
    next[i] = v;
    setDeliverables(next);
  };
  const addDel = () => setDeliverables([...deliverables, "New deliverable"]);
  const removeDel = (i: number) => setDeliverables(deliverables.filter((_, j) => j !== i));

  const handleSave = async () => {
    if (!business) return toast.error("Pick a business first");
    setSaving(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          title,
          packageOverview: overview,
          deliverables: deliverables.filter(Boolean),
          monthlyPrice: price,
          benefits: [],
          nextSteps: "Accept this proposal · Book a 20-min kickoff · Delivery in 5 days",
          emailMessage: "",
          systemsIncluded: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        return;
      }
      setSent(true);
      toast.success("Proposal saved");
      setTimeout(() => {
        router.push(`/proposals/${data.proposal.id}`);
      }, 1800);
    } catch {
      toast.error("Failed to save proposal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="Proposals" />
      <div style={{ padding: "32px 40px 48px", maxWidth: 1440, margin: "0 auto" }}>
        <header
          className="flex justify-between items-end"
          style={{ marginBottom: 24 }}
        >
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
              Edit on the left. Live preview on the right — exactly what the business owner will
              see.
            </p>
          </div>
          <div className="flex" style={{ gap: 8 }}>
            <LgButton variant="secondary" icon="link">
              Copy public link
            </LgButton>
            <LgButton
              variant="primary"
              icon="mail"
              onClick={handleSave}
              disabled={saving || sent || !business}
            >
              {sent ? "Sent!" : saving ? "Saving…" : "Send to client"}
            </LgButton>
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
              Proposal saved · Deal added to pipeline
            </span>
          </div>
        )}

        {!business ? (
          <LgCard>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
              Save a business first to draft a proposal.
            </div>
          </LgCard>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "360px 1fr", gap: 24 }}>
            <div className="flex flex-col" style={{ gap: 16 }}>
              <EditorCard label="Business">
                <select
                  value={businessId}
                  onChange={(e) => {
                    setBusinessId(e.target.value);
                    setTitle("");
                    setOverview("");
                    setContactEmail("");
                  }}
                  style={editorInputStyle}
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.city ?? "—"}
                    </option>
                  ))}
                </select>
              </EditorCard>

              <EditorCard label="Title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={editorInputStyle}
                />
              </EditorCard>

              <EditorCard label="Pricing">
                <div className="flex" style={{ gap: 6 }}>
                  {PRICING_PRESETS.map((p) => {
                    const active = price === p;
                    return (
                      <button
                        key={p}
                        onClick={() => setPrice(p)}
                        style={{
                          flex: 1,
                          padding: "10px 0",
                          fontSize: 14,
                          fontWeight: 700,
                          fontFamily: "inherit",
                          background: active ? "var(--accent)" : "var(--surface)",
                          color: active ? "var(--accent-text)" : "var(--text)",
                          border: `1px solid ${active ? "var(--accent)" : "var(--border-strong)"}`,
                          borderRadius: "var(--radius)",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        ${p}
                        <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.75 }}>/mo</span>
                      </button>
                    );
                  })}
                </div>
              </EditorCard>

              <EditorCard label="Overview">
                <textarea
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  rows={5}
                  style={{
                    ...editorInputStyle,
                    height: "auto",
                    padding: 12,
                    resize: "vertical",
                    lineHeight: 1.5,
                  }}
                />
              </EditorCard>

              <EditorCard label={`Deliverables (${deliverables.length})`}>
                <div className="flex flex-col" style={{ gap: 6 }}>
                  {deliverables.map((d, i) => (
                    <div key={i} className="flex items-center" style={{ gap: 6 }}>
                      <GripVertical
                        size={14}
                        strokeWidth={1.75}
                        style={{ color: "var(--text-subtle)", cursor: "grab" }}
                      />
                      <input
                        value={d}
                        onChange={(e) => updateDel(i, e.target.value)}
                        style={{ ...editorInputStyle, flex: 1 }}
                      />
                      <button
                        onClick={() => removeDel(i)}
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
                    onClick={addDel}
                    style={{ marginTop: 2, justifyContent: "flex-start" }}
                  >
                    Add deliverable
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
              <div
                className="flex items-start justify-center"
                style={{ gap: 24 }}
              >
                <div style={{ flex: "0 1 760px", minWidth: 0 }}>
                  <BrowserFrame
                    url={`launchgrid.ai/p/${business.name.toLowerCase().split(" ")[0]}-${business.id.slice(0, 6)}`}
                  >
                    <PublicProposal
                      business={business}
                      title={title}
                      overview={overview}
                      price={price}
                      deliverables={deliverables.filter(Boolean)}
                    />
                  </BrowserFrame>
                </div>
                <div style={{ flex: "0 0 280px" }}>
                  <MobileFrame>
                    <PublicProposal
                      business={business}
                      title={title}
                      overview={overview}
                      price={price}
                      deliverables={deliverables.filter(Boolean)}
                      mobile
                    />
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

function EditorCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
