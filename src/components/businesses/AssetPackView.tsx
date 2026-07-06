"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  Network,
  FileText,
  CalendarRange,
  Download,
  RefreshCw,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { DELIVERABLES, renderDeliverableHtml } from "@/lib/exporters/deliverables";
import type { AssetPack, DeliverableId } from "@/types";

const TAB_ICONS: Record<DeliverableId, typeof Activity> = {
  d1: Activity,
  d2: Network,
  d3: FileText,
  d4: CalendarRange,
};

const TABS = DELIVERABLES.map((d) => ({
  id: d.id,
  label: d.title,
  subtitle: d.subtitle,
  file: d.filename,
  icon: TAB_ICONS[d.id],
}));

export function AssetPackView({
  pack: initialPack,
  businessId,
  onUpdate,
  initialTab = "d1",
}: {
  pack: AssetPack;
  businessId: string;
  onUpdate?: (pack: AssetPack) => void;
  initialTab?: DeliverableId;
}) {
  const [pack, setPack] = useState<AssetPack>(initialPack);
  const [tab, setTab] = useState<DeliverableId>(initialTab);
  const [regenerating, setRegenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Older packs (pre-upgrade) won't have meta/file1. Render an empty doc in
  // that case; the guard below shows the upgrade notice instead.
  const usable = Boolean(pack?.meta && pack.file1);

  // The actual client-facing deliverable, rendered exactly as exported.
  const docHtml = useMemo(
    () => (usable ? renderDeliverableHtml(pack, tab) : ""),
    [pack, tab, usable]
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
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to regenerate");
        return;
      }
      setPack(data.assetPack);
      onUpdate?.(data.assetPack);
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

  const exportZip = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, assetPack: pack }),
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
      a.download = /filename="(.+?)"/.exec(cd)?.[1] ?? "growth-infrastructure.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Exported 4 deliverables");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const activeTab = TABS.find((t) => t.id === tab)!;

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
        <button
          onClick={exportZip}
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
    </div>
  );
}
