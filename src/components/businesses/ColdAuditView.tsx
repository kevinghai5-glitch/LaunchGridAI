"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  Copy,
  Check,
  Pencil,
  MessageSquare,
} from "lucide-react";
import { renderColdAuditHtml } from "@/lib/exporters/cold-audit-html";
import type { ColdAuditReport } from "@/types";

// Plain-text version of the audit — what you'd paste into an email or DM when
// sending the cold open. Mirrors the HTML deliverable's content order.
function toPlainText(r: ColdAuditReport): string {
  const lines: string[] = [];
  lines.push(r.headline);
  lines.push("");
  if (r.intro) {
    lines.push(r.intro);
    lines.push("");
  }
  lines.push("What I noticed:");
  lines.push("");
  (r.findings ?? []).forEach((f, i) => {
    lines.push(`${i + 1}. ${f.title}`);
    lines.push(f.problem);
    lines.push(`What it's costing you: ${f.whyItCosts}`);
    lines.push("");
  });
  if (r.closingCta?.message) {
    lines.push(r.closingCta.message);
  }
  return lines.join("\n").trim();
}

export function ColdAuditView({
  report: initialReport,
}: {
  report: ColdAuditReport;
  businessId: string;
}) {
  const [report, setReport] = useState<ColdAuditReport>(initialReport);
  const [editing, setEditing] = useState(false);
  const [ctaDraft, setCtaDraft] = useState(report.closingCta?.message ?? "");
  const [copied, setCopied] = useState(false);

  const docHtml = useMemo(() => renderColdAuditHtml(report), [report]);

  const saveCta = () => {
    setReport((r) => ({
      ...r,
      closingCta: { ...r.closingCta, message: ctaDraft.trim() },
    }));
    setEditing(false);
    toast.success("Closing updated");
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("Audit copied — paste it into your email or DM");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const downloadHtml = () => {
    const blob = new Blob([docHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = report.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);
    a.download = `${slug || "business"}-quick-audit.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  const openFull = () => {
    const blob = new Blob([docHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const btn = (active = false): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    padding: "7px 13px",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    color: active ? "var(--accent)" : "var(--text-3)",
    background: active ? "var(--accent-soft)" : "transparent",
    border: `1px solid ${active ? "oklch(0.55 0.18 248 / 0.35)" : "var(--line)"}`,
  });

  return (
    <div>
      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <span style={{ fontSize: 11.5, color: "var(--text-subtle)" }}>
          Free value to send before you pitch ·{" "}
          <span style={{ color: "var(--text-3)" }}>cold-open audit</span>
        </span>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEditing((v) => !v)} style={btn(editing)}>
            <Pencil size={13} strokeWidth={2} />
            Edit closing
          </button>
          <button onClick={copyText} style={btn()}>
            {copied ? (
              <Check size={13} strokeWidth={2.5} />
            ) : (
              <Copy size={13} strokeWidth={2} />
            )}
            Copy as text
          </button>
          <button onClick={downloadHtml} style={btn()}>
            <Download size={13} strokeWidth={2} />
            Download (.html)
          </button>
          <button onClick={openFull} style={btn()}>
            <ExternalLink size={13} strokeWidth={2} />
            Open
          </button>
        </div>
      </div>

      {/* Editable closing CTA */}
      {editing && (
        <div
          style={{
            marginBottom: 16,
            padding: "16px 18px",
            border: "1px solid var(--line-strong)",
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div
            className="flex items-center"
            style={{ gap: 7, marginBottom: 10 }}
          >
            <MessageSquare size={13} strokeWidth={2} style={{ color: "var(--accent)" }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-subtle)",
              }}
            >
              Your soft close
            </span>
            {report.closingCta?.tiedToFinding && (
              <span style={{ fontSize: 11, color: "var(--text-subtle)" }}>
                · tied to: {report.closingCta.tiedToFinding}
              </span>
            )}
          </div>
          <textarea
            value={ctaDraft}
            onChange={(e) => setCtaDraft(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              resize: "vertical",
              padding: "11px 13px",
              fontSize: 13.5,
              lineHeight: 1.5,
              fontFamily: "inherit",
              color: "var(--text)",
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: 9,
            }}
          />
          <div className="flex justify-end" style={{ gap: 8, marginTop: 10 }}>
            <button
              onClick={() => {
                setCtaDraft(report.closingCta?.message ?? "");
                setEditing(false);
              }}
              style={btn()}
            >
              Cancel
            </button>
            <button onClick={saveCta} style={btn(true)}>
              <Check size={13} strokeWidth={2.5} />
              Save closing
            </button>
          </div>
        </div>
      )}

      {/* Live preview of the actual deliverable */}
      <div
        style={{
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid var(--line-strong)",
          boxShadow: "0 24px 60px -28px rgba(0,0,0,0.6)",
          background: "#0b0d12",
        }}
      >
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
            quick-audit · {report.businessName}
          </div>
        </div>
        <iframe
          title={`Cold-open audit — ${report.businessName}`}
          srcDoc={docHtml}
          sandbox="allow-same-origin allow-scripts allow-popups"
          style={{
            display: "block",
            width: "100%",
            height: "72vh",
            minHeight: 560,
            border: "none",
            background: "#f4f5f8",
          }}
        />
      </div>
    </div>
  );
}
