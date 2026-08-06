"use client";

// The leak calculator, as a page, per business.
//
// THIS PAGE IS SCREEN-SHARED TO THE PROSPECT. Every label, every note and every
// consequence line is written for their eyes. There are no operator
// instructions, no "their answers", no coaching text, and no severity language.
//
// It is CREAM AND SERIF, not the dark dashboard theme, for the same reason: the
// client is looking at it. The palette is declared locally in this file rather
// than pulled from the dashboard tokens, so the two never bleed into each other.
//
// The maths lives in src/lib/leak-calculator.ts and is computed live here while
// the operator types. Saving re-runs the same function on the server and freezes
// the result — that frozen figure is what the shareable page and the Diagnosis
// read, so the number a client is shown on the call is the number in their
// documents.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { offerPath, offerShareUrl, SHARE_URL_UNSET } from "@/lib/share-link";
import {
  LEAKS,
  CUSTOM_IMPACT_OPTIONS,
  computeAssessment,
  emptyInputs,
  cad,
  cadRange,
  type CalculatorInputs,
  type ComputedAssessment,
} from "@/lib/leak-calculator";
import type { ObservedFacts } from "@/lib/observed-facts";

// ── Palette — the client-facing brand, declared locally ─────────────────────
const C = {
  ink: "#111111",
  ink2: "#3A3A36",
  muted: "#6E6E68",
  gold: "#96794A",
  goldSoft: "#F7F2E8",
  goldLine: "#E3D6BE",
  paper: "#FFFFFF",
  panel: "#F7F5F0",
  line: "#E4E2DC",
  loss: "#954B3E",
  clean: "#41785B",
  serif: 'Charter, "Bitstream Charter", "Iowan Old Style", Georgia, serif',
  sans: 'ui-sans-serif, -apple-system, "Helvetica Neue", Arial, sans-serif',
};

const microLabel: React.CSSProperties = {
  fontFamily: C.sans, fontSize: 9.5, letterSpacing: "0.14em",
  textTransform: "uppercase", fontWeight: 700, color: C.muted,
  marginBottom: 5, display: "block",
};

const fieldStyle: React.CSSProperties = {
  fontFamily: C.serif, fontSize: 16, color: C.ink, background: C.paper,
  border: `1px solid ${C.line}`, borderRadius: 2, padding: "8px 10px", width: "100%",
};

/** Render `**bold**` emphasis without a markdown dependency. */
function Emphasis({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) =>
        i % 2 === 1 ? <b key={i} style={{ fontWeight: 700 }}>{part}</b> : <span key={i}>{part}</span>
      )}
    </>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 3, marginBottom: 22 }}>
      <div
        className="flex flex-wrap items-baseline justify-between"
        style={{ borderBottom: `1px solid ${C.line}`, padding: "13px 18px", gap: 14 }}
      >
        <h2 style={{ fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.17em", textTransform: "uppercase", fontWeight: 700, color: C.gold, margin: 0 }}>
          {title}
        </h2>
        {note && <span style={{ fontSize: 13, fontStyle: "italic", color: C.muted }}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

// ── The four measured values ────────────────────────────────────────────────
// Values only. No dollar figures, no severity labels, no ranking. They are proof
// we looked before the call, not a diagnosis — putting a number on them needs
// figures only the owner has, which is what the rest of the page is for.
function measuredText(f: ObservedFacts) {
  const speed = [
    f.mobileSpeed.score != null ? `${f.mobileSpeed.score}/100` : null,
    f.mobileSpeed.loadSeconds != null ? `${f.mobileSpeed.loadSeconds}s` : null,
  ].filter(Boolean).join(" · ");
  const reviews = f.reviews.count == null
    ? ""
    : f.reviews.localAvg != null
      ? `${f.reviews.count} · local median ${f.reviews.localAvg}`
      : `${f.reviews.count}`;
  const presence = (s: string) => (s === "found" ? "found" : s === "none" ? "none found" : "");
  return [
    { k: "Mobile speed", v: speed },
    { k: "Google reviews", v: reviews },
    { k: "Booking link", v: presence(f.bookingLink.state) },
    { k: "Click-to-call", v: presence(f.clickToCall.state) },
  ];
}

export default function CalculatorPage() {
  const params = useParams<{ id: string }>();
  const businessId = params.id;

  const [inputs, setInputs] = useState<CalculatorInputs>(() => emptyInputs());
  const [observed, setObserved] = useState<ObservedFacts | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [market, setMarket] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Share id of this assessment. Null until the first save — there is no
  // client link to copy before there is a saved assessment to link to.
  const [publicId, setPublicId] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [showFix, setShowFix] = useState(false);
  const dirty = useRef(false);

  // Live figure while typing. Saving re-runs the identical function server-side.
  const computed: ComputedAssessment = useMemo(() => computeAssessment(inputs), [inputs]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/leak-assessment/${businessId}`, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (!alive) return;
        setInputs(data.inputs);
        setObserved(data.observed ?? null);
        setBusinessName(data.business?.name ?? "");
        setMarket([data.business?.city, data.business?.industry].filter(Boolean).join(" · "));
        setSavedAt(data.savedAt ?? null);
        setPublicId(data.publicId ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [businessId]);

  const patch = useCallback((next: Partial<CalculatorInputs>) => {
    dirty.current = true;
    setInputs((prev) => ({ ...prev, ...next }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/leak-assessment/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not save");
        return;
      }
      dirty.current = false;
      setSavedAt(data.savedAt ?? new Date().toISOString());
      if (data.publicId) setPublicId(data.publicId);
      toast.success("Saved");
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  }, [businessId, inputs]);

  // Autosave, quietly, a beat after typing stops — a figure changed on a call
  // and then lost because nobody pressed a button is the whole problem this page
  // was built to end.
  useEffect(() => {
    if (loading || !dirty.current) return;
    const t = setTimeout(() => { void save(); }, 1200);
    return () => clearTimeout(t);
  }, [inputs, loading, save]);

  const runMeasure = async () => {
    setMeasuring(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/measure`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't measure this business");
        return;
      }
      if (data.observedFacts) setObserved(data.observedFacts as ObservedFacts);
      toast.success("Measured");
    } catch {
      toast.error("Couldn't measure this business");
    } finally {
      setMeasuring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "60vh", background: C.panel }}>
        <Loader2 className="animate-spin" style={{ color: C.gold }} />
      </div>
    );
  }

  const measured = observed ? measuredText(observed) : [];

  return (
    <div style={{ background: C.panel, minHeight: "100vh", fontFamily: C.serif, color: C.ink2, fontSize: 16, lineHeight: 1.5 }}>
      {/* masthead */}
      <header style={{ background: C.paper, borderBottom: `1px solid ${C.line}`, borderTop: `3px solid ${C.gold}`, padding: "22px 0 20px" }}>
        <div style={{ maxWidth: 1020, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ fontFamily: C.sans, fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase", fontWeight: 700, color: C.gold, marginBottom: 7 }}>
            ReclaimedHQ · Conversion Recovery
          </div>
          <h1 style={{ fontSize: 27, lineHeight: 1.1, margin: 0, color: C.ink, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Where the leads are going
            <span style={{ display: "block", fontSize: 14, fontWeight: 400, fontStyle: "italic", color: C.muted, marginTop: 6 }}>
              Built live, from your numbers — not industry averages.
            </span>
          </h1>
          {(businessName || market) && (
            <div style={{ marginTop: 12, fontSize: 13.5, color: C.muted }}>
              {businessName}{market ? ` · ${market}` : ""}
            </div>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "26px 20px 220px" }}>
        {/* ── what we measured ───────────────────────────────────────────── */}
        <Card title="What I measured from outside" note="Public data, pulled this week.">
          <div style={{ padding: "16px 18px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 11 }}>
              {measured.map((m) => (
                <div key={m.k}>
                  <span style={microLabel}>{m.k}</span>
                  <div style={{ ...fieldStyle, background: C.panel, color: m.v ? C.ink : C.muted }}>
                    {m.v || "not measured yet"}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center" style={{ gap: 12, marginTop: 12 }}>
              <button
                type="button"
                onClick={runMeasure}
                disabled={measuring}
                className="flex items-center"
                style={{
                  gap: 6, fontFamily: C.sans, fontSize: 12, fontWeight: 600, padding: "8px 12px",
                  borderRadius: 2, cursor: measuring ? "default" : "pointer", background: C.paper,
                  color: C.ink2, border: `1px solid ${C.line}`,
                }}
              >
                {measuring ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {measuring ? "Checking…" : "Fetch measured values"}
              </button>
              <p style={{ fontSize: 13.5, color: C.muted, fontStyle: "italic", margin: 0, flex: 1, minWidth: 240 }}>
                Four checks, run from the outside. No dollar figures on these — putting a number on them needs
                figures only you have.
              </p>
            </div>
          </div>
        </Card>

        {/* ── the seam ───────────────────────────────────────────────────── */}
        <div style={{ margin: "0 0 22px", padding: "15px 18px", background: C.goldSoft, border: `1px solid ${C.goldLine}`, borderLeft: `3px solid ${C.gold}`, borderRadius: 3 }}>
          <span style={{ fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.17em", textTransform: "uppercase", fontWeight: 700, color: C.gold, display: "block", marginBottom: 6 }}>
            The half a scan can&apos;t see
          </span>
          <p style={{ margin: 0, fontSize: 15, color: C.ink, lineHeight: 1.5 }}>
            Everything above is the outside, and the outside is the smaller half. What follows is what happens
            after someone reaches out to you.
          </p>
        </div>

        {/* ── their two numbers ──────────────────────────────────────────── */}
        <Card title="Your numbers" note="Everything below is built from these two.">
          <div className="flex flex-wrap items-end" style={{ padding: "16px 18px", gap: 22 }}>
            <label style={{ display: "block" }}>
              <span style={microLabel}>Enquiries / month</span>
              <input
                type="number" min={0} step={1} inputMode="numeric"
                value={inputs.monthlyEnquiries ?? ""}
                onChange={(e) => patch({ monthlyEnquiries: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="e.g. 60"
                style={{ ...fieldStyle, width: 132, fontVariantNumeric: "tabular-nums" }}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={microLabel}>Average job value</span>
              <input
                type="number" min={0} step={50} inputMode="numeric"
                value={inputs.avgJobValue ?? ""}
                onChange={(e) => patch({ avgJobValue: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="e.g. 3000"
                style={{ ...fieldStyle, width: 132, fontVariantNumeric: "tabular-nums" }}
              />
            </label>
            <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic", flex: 1, minWidth: 220, margin: 0 }}>
              Calls, forms and messages all in. A rough figure is fine.
            </p>
          </div>
        </Card>

        {/* ── the six ────────────────────────────────────────────────────── */}
        <Card title="Where leads are getting lost" note="Six questions. Your answers, priced on your numbers.">
          <div>
            {LEAKS.map((leak, i) => {
              const row = computed.rows[i];
              return (
                <div
                  key={leak.id}
                  style={{
                    borderBottom: i === LEAKS.length - 1 ? "none" : `1px solid ${C.line}`,
                    padding: "15px 18px", display: "grid",
                    gridTemplateColumns: "26px 1fr 190px", gap: 16, alignItems: "start",
                  }}
                >
                  <div style={{ fontFamily: C.sans, fontSize: 11, fontWeight: 700, color: C.gold, paddingTop: 3, fontVariantNumeric: "tabular-nums" }}>
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <p style={{ fontSize: 16, color: C.ink, margin: "0 0 9px" }}>
                      <Emphasis text={leak.question} />
                    </p>
                    <select
                      value={inputs.answers[leak.id] ?? ""}
                      onChange={(e) =>
                        patch({ answers: { ...inputs.answers, [leak.id]: e.target.value === "" ? null : Number(e.target.value) } })
                      }
                      aria-label={leak.label}
                      style={{ ...fieldStyle, maxWidth: 520 }}
                    >
                      <option value="">— select —</option>
                      {leak.options.map((o, j) => (
                        <option key={j} value={j}>{o.text}</option>
                      ))}
                    </select>
                    {row.consequence && (
                      <p style={{ fontSize: 14, color: C.ink2, margin: "9px 0 0" }}>{row.consequence}</p>
                    )}
                    {showFix && (
                      <div style={{ margin: "9px 0 0", padding: "8px 11px", background: C.goldSoft, borderLeft: `2px solid ${C.gold}`, fontSize: 14 }}>
                        <span style={{ fontFamily: C.sans, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, color: C.gold, display: "block", marginBottom: 3 }}>
                          What we install
                        </span>
                        {leak.fix}
                      </div>
                    )}
                  </div>
                  <Amount row={row} />
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── custom rows ────────────────────────────────────────────────── */}
        <Card title="Anything else" note="Something the six didn't cover? Add it here.">
          <div>
            {inputs.customRows.map((row, i) => (
              <div
                key={i}
                style={{
                  borderBottom: i === inputs.customRows.length - 1 ? "none" : `1px solid ${C.line}`,
                  padding: "15px 18px", display: "grid",
                  gridTemplateColumns: "26px 1fr 190px", gap: 16, alignItems: "start",
                }}
              >
                <div style={{ fontFamily: C.sans, fontSize: 11, fontWeight: 700, color: C.gold, paddingTop: 3 }}>+</div>
                <div className="flex flex-wrap items-center" style={{ gap: 9 }}>
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => {
                      const next = [...inputs.customRows];
                      next[i] = { ...next[i], label: e.target.value };
                      patch({ customRows: next });
                    }}
                    placeholder="Describe it"
                    style={{ ...fieldStyle, width: 330 }}
                  />
                  <select
                    value={row.jobsPerMonth}
                    onChange={(e) => {
                      const next = [...inputs.customRows];
                      next[i] = { ...next[i], jobsPerMonth: Number(e.target.value) };
                      patch({ customRows: next });
                    }}
                    aria-label="Rough impact"
                    style={{ ...fieldStyle, width: 250 }}
                  >
                    {CUSTOM_IMPACT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <Amount row={computed.customRows[i]} />
              </div>
            ))}
          </div>
        </Card>

        {/* ── the assumptions, collapsed ─────────────────────────────────── */}
        <section style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 3, marginBottom: 22 }}>
          <details>
            <summary style={{ cursor: "pointer", padding: "12px 18px", fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700, color: C.muted }}>
              The assumptions behind these numbers
            </summary>
            <div style={{ padding: "2px 18px 18px" }}>
              <div className="flex flex-wrap" style={{ gap: 20, marginBottom: 12 }}>
                <label style={{ display: "block", width: 150 }}>
                  <span style={microLabel}>Close rate</span>
                  <input type="number" min={1} max={100} step={1} value={inputs.closeRatePct}
                    onChange={(e) => patch({ closeRatePct: Number(e.target.value) })}
                    style={{ ...fieldStyle, fontVariantNumeric: "tabular-nums" }} />
                </label>
                <label style={{ display: "block", width: 150 }}>
                  <span style={microLabel}>Overlap discount</span>
                  <input type="number" min={0} max={100} step={5} value={inputs.overlapPct}
                    onChange={(e) => patch({ overlapPct: Number(e.target.value) })}
                    style={{ ...fieldStyle, fontVariantNumeric: "tabular-nums" }} />
                </label>
                <label style={{ display: "block", width: 150 }}>
                  <span style={microLabel}>Revenue cap</span>
                  <input type="number" min={5} max={100} step={5} value={inputs.capPct}
                    onChange={(e) => patch({ capPct: Number(e.target.value) })}
                    style={{ ...fieldStyle, fontVariantNumeric: "tabular-nums" }} />
                </label>
              </div>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, margin: "0 0 10px" }}>
                <b style={{ color: C.ink2, fontWeight: 400, fontStyle: "italic" }}>Close rate</b> — of well-handled
                enquiries that become jobs. <b style={{ color: C.ink2, fontWeight: 400, fontStyle: "italic" }}>Overlap
                discount</b> — cut from the total because one lost lead can appear in more than one row (an 8pm
                missed call is two rows). <b style={{ color: C.ink2, fontWeight: 400, fontStyle: "italic" }}>Revenue
                cap</b> — the total is compressed if it would exceed this share of estimated monthly revenue. The
                figure is deliberately conservative. All three are assumptions, and all three are yours to change.
              </p>
              <ul style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, margin: 0, paddingLeft: 18 }}>
                <li style={{ marginBottom: 5 }}>Roughly a quarter of calls to local service businesses go unanswered, and most people who reach voicemail don&apos;t call back — they call the next result. <i>(CallRail, industry call-tracking data)</i></li>
                <li style={{ marginBottom: 5 }}>Speed to first response is the single largest lever on lead conversion; minutes beat hours by a wide margin. <i>(Lead-response research, MIT / InsideSales)</i></li>
                <li style={{ marginBottom: 5 }}>Most businesses stop after one follow-up attempt, while most closed deals take five or more touches. <i>(Aggregate sales-activity research)</i></li>
                <li style={{ marginBottom: 5 }}>Reminder sequences cut no-shows materially versus no reminders at all. <i>(Appointment-reminder studies, healthcare &amp; services)</i></li>
              </ul>
              <p style={{ fontSize: 13, color: C.muted, margin: "10px 0 0" }}>
                Every figure on this page is a hedged range built from these bands. It is an estimate, and it says so.
              </p>
            </div>
          </details>
        </section>

        <p style={{ textAlign: "center", fontSize: 13.5, color: C.muted, fontStyle: "italic" }}>
          {savedAt ? `Saved against this business — ${new Date(savedAt).toLocaleString("en-CA")}` : "Saves automatically as you answer."}
        </p>
      </div>

      {/* ── the sticky total ───────────────────────────────────────────────── */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: C.paper, borderTop: `3px solid ${C.gold}`, boxShadow: "0 -3px 18px rgba(0,0,0,.07)", zIndex: 20 }}>
        <div
          className="flex flex-wrap items-center justify-between"
          style={{ maxWidth: 1020, margin: "0 auto", padding: "14px 20px", gap: 26 }}
        >
          <div>
            <div className="flex flex-wrap items-baseline" style={{ gap: 13 }}>
              <span style={{ fontSize: 36, fontWeight: 700, color: computed.allClean ? C.clean : C.loss, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {computed.totalHigh > 0 ? cadRange(computed.totalLow, computed.totalHigh) : cad(0)}
              </span>
              <span style={{ fontFamily: C.sans, fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>
                per month
              </span>
              {computed.totalHigh > 0 && (
                <span style={{ fontSize: 14, color: C.muted, fontVariantNumeric: "tabular-nums" }}>
                  ≈ {cadRange(computed.annualLow, computed.annualHigh)} a year
                </span>
              )}
            </div>
            {computed.capped && (
              <div style={{ fontFamily: C.sans, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: "#8A6317", marginTop: 5 }}>
                Conservatively capped
              </div>
            )}
            {/* The all-clean outcome, said plainly. Not an error, not an empty
                page — a real and useful answer to the six questions. */}
            {computed.allClean && (
              <div className="flex items-center" style={{ gap: 6, fontFamily: C.sans, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, color: C.clean, marginTop: 5 }}>
                <Check size={13} strokeWidth={2.4} /> Every area came back covered
              </div>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: C.muted, maxWidth: 470, lineHeight: 1.45, margin: 0 }}>
            {computed.derivation}
          </p>
          <div className="flex flex-wrap" style={{ gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowFix((v) => !v)}
              style={{
                fontFamily: C.sans, fontSize: 12, fontWeight: 600, padding: "9px 13px", borderRadius: 2,
                cursor: "pointer", background: showFix ? C.gold : C.paper, color: showFix ? "#fff" : C.ink2,
                border: `1px solid ${showFix ? C.gold : C.line}`,
              }}
            >
              {showFix ? "Hide what we install" : "Show what we install"}
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="flex items-center"
              style={{
                gap: 6, fontFamily: C.sans, fontSize: 12, fontWeight: 600, padding: "9px 13px", borderRadius: 2,
                cursor: saving ? "default" : "pointer", background: C.ink, color: "#fff", border: `1px solid ${C.ink}`,
              }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              {saving ? "Saving…" : "Save"}
            </button>
            <ShareControls publicId={publicId} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The client link. THIS IS THE WHOLE PUBLISH STEP: saving the calculator is
 *  what creates the offer page, so there is no "generate" and no editor — one
 *  button that copies the URL and one that opens it.
 *
 *  Hidden entirely before the first save. A copy button that yields a link to
 *  nothing is worse than no button, because it looks like it worked.
 *
 *  If no public host is configured the copy REFUSES and names the variable, for
 *  the reason in src/lib/share-link.ts: a localhost URL is indistinguishable
 *  from a working one until it is already in a client's inbox. */
function ShareControls({ publicId }: { publicId: string | null }) {
  if (!publicId) return null;
  const shareUrl = offerShareUrl(publicId);
  const copy = () => {
    if (!shareUrl) {
      toast.error(SHARE_URL_UNSET);
      return;
    }
    navigator.clipboard.writeText(shareUrl);
    toast.success("Client link copied");
  };
  const base: React.CSSProperties = {
    fontFamily: C.sans, fontSize: 12, fontWeight: 600, padding: "9px 13px", borderRadius: 2,
    cursor: "pointer", background: C.paper, color: C.ink2, border: `1px solid ${C.line}`,
  };
  return (
    <>
      <button type="button" onClick={copy} style={base}>
        Copy client link
      </button>
      <a
        href={offerPath(publicId)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...base, textDecoration: "none", display: "inline-block" }}
      >
        Open offer page
      </a>
    </>
  );
}

/** The figure beside a row. Clean answers read "no leak" in green — a covered
 *  area is an answer, not a zero. */
function Amount({ row }: { row: { clean: boolean; assumed: boolean; monthlyLow: number | null; monthlyHigh: number | null } | undefined }) {
  if (!row) return <div />;
  const idle = row.monthlyLow === null && !row.clean;
  return (
    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
      <span
        style={{
          fontSize: row.clean || idle ? 15 : 19,
          color: row.clean ? C.clean : idle ? "#BFBDB6" : C.loss,
          fontWeight: idle ? 400 : 700,
          display: "block",
          letterSpacing: "-0.01em",
        }}
      >
        {row.clean ? "no leak" : idle ? "—" : cadRange(row.monthlyLow!, row.monthlyHigh!)}
        {row.assumed && !row.clean && (
          <span style={{ display: "inline-block", fontFamily: C.sans, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: "#8A6317", background: "#FAF6EB", border: `1px solid ${C.goldLine}`, borderRadius: 2, padding: "1px 5px", marginLeft: 7, verticalAlign: 1 }}>
            assumed
          </span>
        )}
      </span>
      <span style={{ fontFamily: C.sans, fontSize: 9, letterSpacing: "0.13em", textTransform: "uppercase", color: C.muted, display: "block", marginTop: 3 }}>
        per month
      </span>
    </div>
  );
}
