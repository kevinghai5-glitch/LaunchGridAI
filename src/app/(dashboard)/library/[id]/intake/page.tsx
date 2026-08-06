"use client";

// Intake — one screen, three groups, thirteen inputs, one button.
//
// This replaces a three-tab drawer with roughly thirty controls and two thousand
// words of explanation. What it deliberately does NOT contain:
//
//   · the nine workflows that always install — a switch you must never touch is
//     worse than no switch, so they are one line of text, not nine controls
//   · any "didn't ask" state — the six questions are answered live on the call,
//     so the gap-hedging machinery has nothing left to hedge
//   · workflow descriptions — those belong in the client's Build Plan, not here
//
// The two numbers and six answers are PRE-FILLED from the calculator. This screen
// confirms them; it is not where they are first typed. Saving writes back to the
// same assessment, so a correction here is a correction to the money.

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Sparkles } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LEAKS } from "@/lib/leak-calculator";
import {
  DECIDABLE_WORKFLOWS,
  ALWAYS_INSTALLED_COUNT,
  OFF_WHEN,
  type BuildDecisions,
} from "@/lib/build-decisions";

interface Loaded {
  business: { id: string; name: string; city: string | null; industry: string | null };
  monthlyEnquiries: number | null;
  avgJobValue: number | null;
  answers: Record<string, number | null>;
  hasAssessment: boolean;
  decisions: BuildDecisions;
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="glass-card p-5" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 14 }}>
        <h2
          className="lg-mono"
          style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: "var(--text-4)", margin: 0 }}
        >
          {title}
        </h2>
        {hint && <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: "6px 0 0" }}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  fontSize: 14,
  color: "var(--text)",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  outline: "none",
  fontFamily: "inherit",
};

export default function IntakePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const businessId = params.id;

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/intake/${businessId}`, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const d = (await res.json()) as Loaded;
        if (alive) setData(d);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [businessId]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!data) return false;
    setSaving(true);
    try {
      const res = await fetch(`/api/intake/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyEnquiries: data.monthlyEnquiries,
          avgJobValue: data.avgJobValue,
          answers: data.answers,
          decisions: data.decisions,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast.error(e.error || "Could not save");
        return false;
      }
      return true;
    } catch {
      toast.error("Could not save");
      return false;
    } finally {
      setSaving(false);
    }
  }, [businessId, data]);

  // The one button: save what's on screen, then generate against it. Generating
  // from anything other than what the operator is looking at is how a document
  // ends up disagreeing with the screen it came from.
  const saveAndGenerate = async () => {
    if (!(await save())) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || "Generation failed");
        return;
      }
      toast.success("Documents generated");
      router.push(`/studio?businessId=${businessId}&restore=pack`);
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <>
        <TopBar title="Intake" />
        <div className="flex items-center justify-center" style={{ minHeight: "50vh" }}>
          <Loader2 className="animate-spin" style={{ color: "var(--text-4)" }} />
        </div>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <TopBar title="Intake" />
        <div style={{ padding: 40, color: "var(--text-3)" }}>Business not found.</div>
      </>
    );
  }

  const set = (patch: Partial<Loaded>) => setData((d) => (d ? { ...d, ...patch } : d));
  const busy = saving || generating;

  return (
    <>
      <TopBar title="Intake" subtitle={data.business.name} />
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: "28px 20px 80px" }}>
        <button
          type="button"
          onClick={() => router.push("/library")}
          className="flex items-center"
          style={{ gap: 6, fontSize: 12.5, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 18, fontFamily: "inherit" }}
        >
          <ArrowLeft size={14} /> Library
        </button>

        {/* ── 1 · their numbers — 2 inputs ─────────────────────────────────── */}
        <Group
          title="Their numbers"
          hint={data.hasAssessment ? "From the calculator. Confirm or correct." : "Not run on the call — enter them here."}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <label>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--text-4)", marginBottom: 5 }}>Enquiries / month</span>
              <input
                type="number" min={0} inputMode="numeric" style={inputStyle}
                value={data.monthlyEnquiries ?? ""}
                onChange={(e) => set({ monthlyEnquiries: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </label>
            <label>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--text-4)", marginBottom: 5 }}>Average job value</span>
              <input
                type="number" min={0} step={50} inputMode="numeric" style={inputStyle}
                value={data.avgJobValue ?? ""}
                onChange={(e) => set({ avgJobValue: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </label>
          </div>
        </Group>

        {/* ── 2 · what they told me — 6 dropdowns ──────────────────────────── */}
        <Group title="What they told me" hint="The six answers from the call. Changing one here changes the figures.">
          <div className="flex flex-col" style={{ gap: 12 }}>
            {LEAKS.map((leak) => (
              <label key={leak.id}>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--text-4)", marginBottom: 5 }}>{leak.label}</span>
                <select
                  style={inputStyle}
                  value={data.answers[leak.id] ?? ""}
                  onChange={(e) =>
                    set({ answers: { ...data.answers, [leak.id]: e.target.value === "" ? null : Number(e.target.value) } })
                  }
                >
                  <option value="">— not answered —</option>
                  {leak.options.map((o, i) => (
                    <option key={i} value={i}>{o.text}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </Group>

        {/* ── 3 · the five decisions — 5 switches ──────────────────────────── */}
        <Group
          title="The build"
          hint={`${ALWAYS_INSTALLED_COUNT} workflows install in every build and aren't decisions. These five are.`}
        >
          <div className="flex flex-col" style={{ gap: 2 }}>
            {DECIDABLE_WORKFLOWS.map((w) => {
              const on = data.decisions[w.id] !== false;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => set({ decisions: { ...data.decisions, [w.id]: !on } })}
                  className="flex items-center justify-between"
                  style={{
                    gap: 12, padding: "11px 2px", background: "none", border: "none",
                    borderBottom: "1px solid var(--line)", cursor: "pointer", textAlign: "left",
                    fontFamily: "inherit", width: "100%",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{w.name}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--text-4)", marginTop: 2 }}>
                      Off when: {OFF_WHEN[w.id] ?? "—"}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    style={{
                      flexShrink: 0, width: 40, height: 23, borderRadius: 999,
                      background: on ? "var(--accent)" : "rgba(255,255,255,0.09)",
                      border: `1px solid ${on ? "var(--accent)" : "var(--line-strong)"}`,
                      position: "relative", transition: "background var(--t), border-color var(--t)",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute", top: 2, left: on ? 19 : 2, width: 17, height: 17,
                        borderRadius: 999, background: "#fff", transition: "left var(--t)",
                      }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </Group>

        {/* ── the one button ───────────────────────────────────────────────── */}
        <div className="flex items-center" style={{ gap: 12, marginTop: 22 }}>
          <button
            type="button"
            onClick={saveAndGenerate}
            disabled={busy}
            className="flex items-center justify-center"
            style={{
              gap: 8, flex: 1, minHeight: 46, fontSize: 14, fontWeight: 650, borderRadius: 10,
              color: "#fff", background: "var(--accent)", border: "1px solid var(--accent)",
              cursor: busy ? "default" : "pointer", fontFamily: "inherit",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {generating ? <Loader2 size={15} className="animate-spin" /> : saving ? <Check size={15} /> : <Sparkles size={15} />}
            {generating ? "Generating…" : saving ? "Saving…" : "Save & generate"}
          </button>
        </div>
      </div>
    </>
  );
}
