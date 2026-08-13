"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  Network,
  FileText,
  Download,
  RefreshCw,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  DELIVERABLES,
  renderDeliverableHtml,
  deliverableContext,
  emptyDeliverableContext,
  type DeliverableContext,
} from "@/lib/exporters/deliverables";
import { readComputed } from "@/lib/client-offer";
import {
  PackGateDialog,
  PackOverrideMarker,
  parsePackGateFailure,
  type PackGateBoundary,
  type PackGateFailure,
  type PackOverridePayload,
} from "./PackOverrideDialog";
import type {
  AssetPack,
  DeliverableId,
  PackGovernance,
  PackValidationCheck,
} from "@/types";

const TAB_ICONS: Record<DeliverableId, typeof Activity> = {
  "diagnosis": Activity,
  "build-plan": Network,
  "asset-pack": FileText,
};

const TABS = DELIVERABLES.map((d) => ({
  id: d.id,
  label: d.title,
  subtitle: d.subtitle,
  file: d.filename,
  icon: TAB_ICONS[d.id],
  // Shown on the tab. The Asset Pack is not in the client bundle and the
  // operator needs to see that on the tab, not discover it from a ZIP listing.
  internal: d.audience === "internal",
}));

export function AssetPackView({
  pack: initialPack,
  businessId,
  onUpdate,
  initialTab = "diagnosis",
  governance: hostOverride,
}: {
  pack: AssetPack;
  businessId: string;
  onUpdate?: (pack: AssetPack) => void;
  initialTab?: DeliverableId;
  /** An override the HOST just recorded — Studio's "Save to library" forcing a
   *  save is the case. The pack object here was handed over before the server
   *  stamped it, so without this the marker would not appear until that pack is
   *  next loaded out of the database. */
  governance?: PackGovernance | null;
}) {
  const [pack, setPack] = useState<AssetPack>(initialPack);
  const [tab, setTab] = useState<DeliverableId>(
    DELIVERABLES.some((d) => d.id === initialTab) ? initialTab : DELIVERABLES[0].id
  );
  const [regenerating, setRegenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  // The governance gate's full report, when one blocked. Rendering it is what
  // replaced `toast.error(data.error)`: a toast shows one truncated line for a
  // report that can carry a dozen distinct law failures.
  const [gate, setGate] = useState<{
    boundary: PackGateBoundary;
    failure: PackGateFailure;
  } | null>(null);
  // A forced export in THIS session. The route hands back a ZIP, not a pack, so
  // the browser's copy never learns it was stamped — this keeps the marker
  // truthful on screen until the pack is next loaded from the database (where
  // the same fact lives in `pack.governance`). Held separately rather than
  // spliced into `pack` so a local UI marker can never ride along into a save.
  const [sessionOverride, setSessionOverride] = useState<PackGovernance | null>(null);
  // What the operator waived, kept only from "confirm" until the server answers,
  // so the marker above can be built from the checks they actually saw.
  const waivedRef = useRef<{ reason: string; checks: PackValidationCheck[] } | null>(null);

  // Older packs (pre-upgrade) won't have meta/file1. Render an empty doc in
  // that case; the guard below shows the upgrade notice instead.
  const usable = Boolean(pack?.meta && pack.file1);

  // ── THE LIVE CONTEXT ──────────────────────────────────────────────────────
  // The two client documents are NOT rendered from the pack alone. The Diagnosis
  // reads the frozen assessment and the Build Plan reads the build decisions and
  // the kickoff date — all three live on the business row, not in the pack, and
  // deliberately so: a copy baked in at generation would keep showing the old
  // total after the calculator was corrected.
  //
  // Until it arrives the preview renders with an EMPTY context, which is the
  // honest default (no assessment, kickoff unbooked, everything installed) rather
  // than a guess that would flicker into something different a moment later.
  const [ctx, setCtx] = useState<DeliverableContext>(() => emptyDeliverableContext());
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/leak-assessment/${businessId}`, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = await res.json();
        if (!alive) return;
        setCtx(
          deliverableContext({
            assessment: readComputed(data.computed),
            workflowToggles: data.business?.workflowToggles ?? null,
            kickoffAt: data.business?.kickoffAt ? new Date(data.business.kickoffAt) : null,
          })
        );
      } catch {
        // Leave the empty context in place. A preview that renders "no assessment
        // on file" is honest; one that invents figures because a fetch failed is not.
      }
    })();
    return () => {
      alive = false;
    };
  }, [businessId]);

  // The actual client-facing deliverable, rendered exactly as exported.
  const docHtml = useMemo(
    () => (usable ? renderDeliverableHtml(pack, tab, ctx) : ""),
    [pack, tab, usable, ctx]
  );

  if (!usable) {
    return (
      <div className="panel p-5 text-sm text-gray-400">
        This asset pack was generated in an earlier format. Regenerate it from Studio to
        unlock the upgraded deliverables and exports.
      </div>
    );
  }

  const regenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/generate/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      // Early errors (auth / validation / not-found) come back as plain JSON.
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to regenerate");
        return;
      }

      // Full-pack generation answers with newline-delimited JSON — progress
      // frames, then one {type:"done", assetPack}. This used to call res.json(),
      // which cannot parse a body of many concatenated objects, so the button
      // threw on every run and reported a generic failure. Read the frames.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fresh: AssetPack | null = null;
      let streamError: string | null = null;
      let streamFailure: PackGateFailure | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let msg: { type?: string; error?: string; assetPack?: AssetPack };
          try {
            msg = JSON.parse(trimmed);
          } catch {
            continue;
          }
          if (msg.type === "error") {
            streamError = msg.error ?? "Failed to regenerate";
            // Generation has NO override — a pack that fails its laws here is
            // regenerated, never forced. But the reason is still a multi-check
            // report, so it gets read in full instead of squeezed into a toast.
            streamFailure = parsePackGateFailure(msg);
          } else if (msg.type === "done") {
            fresh = msg.assetPack ?? null;
          }
        }
      }

      if (streamFailure) {
        setGate({ boundary: "generate", failure: streamFailure });
        return;
      }
      if (streamError || !fresh) {
        toast.error(streamError || "Failed to regenerate");
        return;
      }
      setPack(fresh);
      // A fresh pack is a different pack: any override marker on screen belonged
      // to the old one and would be a lie about this one.
      setSessionOverride(null);
      onUpdate?.(fresh);
      toast.success("Deliverables regenerated");
    } catch {
      toast.error("Failed to regenerate");
    } finally {
      setRegenerating(false);
    }
  };

  const openFull = () => {
    const blob = new Blob([docHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const exportZip = async (override?: PackOverridePayload) => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          assetPack: pack,
          ...(override ? { override } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // 422 is the governance gate. It carries every failing check with its
        // stable id, and those ids are what an override has to echo back — so
        // this is both the report and the only place the override can start.
        const failure = res.status === 422 ? parsePackGateFailure(data) : null;
        if (failure) {
          setGate({ boundary: "export", failure });
          return;
        }
        setGate(null);
        toast.error(data.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") ?? "";
      a.download = /filename="(.+?)"/.exec(cd)?.[1] ?? "growth-infrastructure.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setGate(null);

      // The route says on the response itself whether this was a forced export,
      // so a pack that went out over a known violation never reports back as a
      // plain success.
      const forced = res.headers.get("X-Pack-Override") === "forced";
      const waived = waivedRef.current;
      waivedRef.current = null;
      if (forced && waived) {
        setSessionOverride({
          overridden: true,
          reason: waived.reason,
          checks: waived.checks,
          at: new Date().toISOString(),
          boundary: "export",
        });
      }
      if (forced) {
        // "Recorded: false" means the paper trail could not reach the database
        // because this pack has never been saved — the ZIP's archive comment and
        // the server log are then the only copies. That is worth saying out loud.
        const recorded = res.headers.get("X-Pack-Override-Recorded") === "true";
        toast.warning("Exported with an override on the record", {
          description: recorded
            ? "The ZIP went out over checks that were failing. Your reason and those checks are stored on this pack."
            : "The ZIP went out over checks that were failing. This pack has never been saved, so the record lives only in the archive comment and the server log — save it to keep the trail.",
          duration: 12000,
        });
      } else {
        toast.success("Exported 4 deliverables");
      }
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const confirmExportOverride = (payload: PackOverridePayload) => {
    // Hold on to exactly what was on screen, so the marker afterwards reports
    // the checks the operator actually read rather than a re-derived guess.
    waivedRef.current = {
      reason: payload.reason,
      checks: gate?.failure.checks ?? [],
    };
    void exportZip(payload);
  };

  // NO NON-NULL ASSERTION. `tab` can hold an id that no longer exists — a stale
  // deep link, a bookmark, a saved value from before the documents were renamed —
  // and `TABS.find(...)!` turned that into a white-screen crash on
  // `activeTab.subtitle`. Falling back to the first tab keeps the pack readable;
  // the id is validated upstream too, and this is the backstop.
  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];
  // Three sources, all true when set; the freshest wins, because that is the one
  // the operator just caused. `pack.governance` is the persisted record and the
  // only one that survives a reload.
  const governance = sessionOverride ?? hostOverride ?? pack.governance;

  return (
    <div>
      {/* File switcher + global actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  color: active ? "var(--accent)" : "var(--text-3)",
                  background: active ? "var(--accent-soft)" : "transparent",
                  border: `1px solid ${active ? "oklch(0.55 0.18 248 / 0.35)" : "var(--line)"}`,
                  transition: "color .15s ease, border-color .15s ease, background .15s ease",
                }}
              >
                <Icon size={13} strokeWidth={1.9} />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
          {/* Internal marker — sits beside Export because that is where it
              matters: this pack already went out (or was saved) over a check
              that was failing. Never rendered into anything a client opens. */}
          {governance && <PackOverrideMarker governance={governance} />}
          <button
            onClick={() => exportZip()}
            disabled={exporting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 8,
              padding: "7px 13px",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: exporting ? "default" : "pointer",
              color: "var(--accent)",
              background: "var(--accent-soft)",
              border: "1px solid oklch(0.55 0.18 248 / 0.35)",
              opacity: exporting ? 0.6 : 1,
            }}
          >
            {exporting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Download size={13} strokeWidth={2} />
            )}
            Export all (.zip)
          </button>
        </div>
      </div>

      {/* Live preview note + full-pack regenerate */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span style={{ fontSize: 11.5, color: "var(--text-subtle)" }}>
          Live preview of the deliverable your client receives ·{" "}
          <span style={{ color: "var(--text-3)" }}>{activeTab.subtitle}</span>
        </span>
        <button
          onClick={regenerate}
          disabled={regenerating}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            fontWeight: 600,
            fontFamily: "inherit",
            color: "var(--text-3)",
            background: "transparent",
            border: "none",
            cursor: regenerating ? "default" : "pointer",
            opacity: regenerating ? 0.6 : 1,
          }}
        >
          {regenerating ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} strokeWidth={2} />
          )}
          Regenerate pack
        </button>
      </div>

      {/* Document preview — actual rendered deliverable in a faux browser frame */}
      <div
        style={{
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid var(--line-strong)",
          boxShadow: "0 24px 60px -28px rgba(0,0,0,0.6)",
          background: "#0b0d12",
        }}
      >
        {/* faux browser chrome */}
        <div
          className="flex items-center"
          style={{
            gap: 10,
            padding: "10px 14px",
            borderBottom: "1px solid var(--line)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div className="flex items-center" style={{ gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: "#ff5f57" }} />
            <span style={{ width: 10, height: 10, borderRadius: 99, background: "#febc2e" }} />
            <span style={{ width: 10, height: 10, borderRadius: 99, background: "#28c840" }} />
          </div>
          <div
            className="flex-1 text-center"
            style={{
              fontSize: 11.5,
              color: "var(--text-subtle)",
              fontFamily: "var(--font-mono, monospace)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeTab.file}
          </div>
          <button
            onClick={openFull}
            title="Open full document in a new tab"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "inherit",
              color: "var(--text-3)",
              background: "transparent",
              border: "1px solid var(--line)",
              borderRadius: 7,
              padding: "4px 9px",
              cursor: "pointer",
            }}
          >
            <ExternalLink size={12} strokeWidth={2} />
            Open
          </button>
        </div>
        <iframe
          key={tab}
          title={`Deliverable preview — ${activeTab.label}`}
          srcDoc={docHtml}
          sandbox="allow-same-origin allow-scripts allow-popups"
          style={{
            display: "block",
            width: "100%",
            height: "72vh",
            minHeight: 560,
            border: "none",
            background: "#07090d",
          }}
        />
      </div>

      {gate && (
        <PackGateDialog
          boundary={gate.boundary}
          failure={gate.failure}
          busy={exporting}
          onClose={() => {
            setGate(null);
            waivedRef.current = null;
          }}
          // Export can be forced; generation cannot, so it gets no confirm half
          // and the dialog renders read-only.
          onConfirm={gate.boundary === "export" ? confirmExportOverride : undefined}
        />
      )}
    </div>
  );
}
