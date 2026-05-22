"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { LgBadge } from "@/components/ui/lg-badge";
import { PIPELINE_STAGES, type DealStage } from "@/lib/stages";
import type { Deal } from "@/types";

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<DealStage | null>(null);

  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/deals");
      const data = await res.json();
      if (res.ok) setDeals(data.deals);
    } finally {
      setLoading(false);
    }
  };

  const moveDeal = async (id: string, toStage: DealStage) => {
    const before = deals;
    setDeals((prev) =>
      prev.map((d) => (d.id === id ? { ...d, stage: toStage } : d))
    );
    setDragId(null);
    setOverStage(null);
    try {
      const res = await fetch(`/api/deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: toStage }),
      });
      if (!res.ok) {
        setDeals(before);
        toast.error("Failed to update stage");
      }
    } catch {
      setDeals(before);
      toast.error("Failed to update stage");
    }
  };

  const wonDeals = deals.filter((d) => d.stage === "WON");
  const inMotion = deals.filter(
    (d) =>
      d.stage !== "WON" && d.stage !== "SAVED" && d.stage !== "LOST"
  );
  const totalMRR = wonDeals.reduce((s, d) => s + d.monthlyValue, 0);
  const pipelineMRR = inMotion.reduce((s, d) => s + d.monthlyValue, 0);
  const annual = totalMRR * 12;

  return (
    <>
      <TopBar title="Pipeline" />
      <div
        style={{
          padding: "32px 40px 24px",
          maxWidth: 1600,
          margin: "0 auto",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          className="flex justify-between items-end"
          style={{ marginBottom: 20 }}
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
              Pipeline
            </h1>
            <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 14.5 }}>
              Drag deals across stages. Won deals add to MRR automatically.
            </p>
          </div>
          <div className="flex" style={{ gap: 8 }}>
            <LgButton variant="secondary" icon="filter">
              Filter
            </LgButton>
            <LgButton variant="primary" icon="plus">
              Add deal
            </LgButton>
          </div>
        </header>

        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <MRRStat
            label="Current MRR"
            value={totalMRR}
            sub={`${wonDeals.length} active clients`}
            accent
          />
          <MRRStat
            label="Pipeline MRR"
            value={pipelineMRR}
            sub={`${inMotion.length} deals in motion`}
          />
          <MRRStat
            label="Annual run rate"
            value={annual}
            sub="If pipeline closes"
          />
        </div>

        <div
          className="grid"
          style={{
            flex: 1,
            gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, minmax(220px, 1fr))`,
            gap: 12,
            minHeight: 480,
          }}
        >
          {PIPELINE_STAGES.map((s) => {
            const stageDeals = deals.filter((d) => d.stage === s.id);
            return (
              <KanbanColumn
                key={s.id}
                stage={s}
                deals={stageDeals}
                isDropTarget={overStage === s.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(s.id);
                }}
                onDragLeave={() =>
                  setOverStage((cur) => (cur === s.id ? null : cur))
                }
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) moveDeal(dragId, s.id);
                }}
                renderCard={(d) => (
                  <DealCard
                    key={d.id}
                    deal={d}
                    dragging={dragId === d.id}
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => setDragId(null)}
                  />
                )}
              />
            );
          })}
        </div>

        {!loading && deals.length === 0 && (
          <div
            className="text-center"
            style={{ padding: 40, color: "var(--text-muted)" }}
          >
            No deals yet. Send a proposal to start building your pipeline.
          </div>
        )}
      </div>
    </>
  );
}

function MRRStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  accent?: boolean;
}) {
  const display = useAnimatedNumber(value);
  return (
    <div
      className="relative overflow-hidden flex items-center justify-between"
      style={{
        background: "var(--surface)",
        border: accent ? "1.5px solid var(--accent)" : "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 20px",
      }}
    >
      {accent && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at right, var(--accent-soft), transparent 60%)",
            pointerEvents: "none",
          }}
        />
      )}
      <div className="relative" style={{ zIndex: 1 }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: accent ? "var(--accent)" : "var(--text-subtle)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "var(--font-sans), sans-serif",
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: "-0.028em",
            marginTop: 4,
            color: "var(--text)",
          }}
        >
          ${display.toLocaleString()}
          <span
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              fontWeight: 500,
              marginLeft: 4,
            }}
          >
            /mo
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {sub}
        </div>
      </div>
    </div>
  );
}

function useAnimatedNumber(target: number) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const dur = 600;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
}

function KanbanColumn({
  stage,
  deals,
  isDropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
  renderCard,
}: {
  stage: { id: DealStage; label: string };
  deals: Deal[];
  isDropTarget: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  renderCard: (d: Deal) => React.ReactNode;
}) {
  const stageMRR = deals.reduce((s, d) => s + d.monthlyValue, 0);
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="flex flex-col"
      style={{
        background: isDropTarget ? "var(--accent-soft)" : "var(--sidebar)",
        border: isDropTarget
          ? "1.5px dashed var(--accent)"
          : "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 12,
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <div
        className="flex justify-between items-center"
        style={{ marginBottom: 12, padding: "0 4px" }}
      >
        <div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background:
                  stage.id === "WON"
                    ? "var(--success)"
                    : stage.id === "SAVED"
                    ? "var(--text-subtle)"
                    : "var(--accent)",
              }}
            />
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "-0.005em",
                color: "var(--text)",
              }}
            >
              {stage.label}
            </span>
            <span
              style={{
                fontSize: 11.5,
                color: "var(--text-subtle)",
                fontFamily: "var(--font-mono), monospace",
              }}
            >
              {deals.length}
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 2,
              marginLeft: 16,
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            ${stageMRR.toLocaleString()}/mo
          </div>
        </div>
        <button
          aria-label="Add deal to stage"
          style={{
            width: 24,
            height: 24,
            padding: 0,
            background: "transparent",
            border: "none",
            color: "var(--text-subtle)",
            cursor: "pointer",
            borderRadius: 5,
          }}
        >
          <Plus size={14} strokeWidth={1.75} />
        </button>
      </div>
      <div
        className="flex flex-col"
        style={{ gap: 8, flex: 1 }}
      >
        {deals.map(renderCard)}
        {deals.length === 0 && (
          <div
            className="grid place-items-center"
            style={{
              flex: 1,
              minHeight: 80,
              border: "1.5px dashed var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text-subtle)",
              fontSize: 12,
              fontStyle: "italic",
            }}
          >
            Drop deals here
          </div>
        )}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  deal: Deal;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="relative"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 12,
        boxShadow: dragging ? "var(--shadow-lg)" : "var(--shadow-sm)",
        cursor: "grab",
        opacity: dragging ? 0.85 : 1,
        transform: dragging ? "rotate(-2deg) scale(1.02)" : "none",
        transition:
          "box-shadow 0.18s, transform 0.18s cubic-bezier(0.2, 0.7, 0.3, 1), border-color 0.18s",
      }}
      onMouseEnter={(e) => {
        if (!dragging) {
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
          (e.currentTarget as HTMLElement).style.borderColor =
            "color-mix(in oklch, var(--accent) 25%, var(--border))";
        }
      }}
      onMouseLeave={(e) => {
        if (!dragging) {
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)";
          (e.currentTarget as HTMLElement).style.transform = "none";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        }
      }}
    >
      <div
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          letterSpacing: "-0.005em",
          lineHeight: 1.3,
          marginBottom: 6,
          color: "var(--text)",
        }}
      >
        {deal.business?.name ?? "—"}
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: "var(--text-muted)",
          marginBottom: 10,
        }}
      >
        {deal.business?.city ?? "—"}
      </div>
      <div className="flex justify-between items-center">
        <LgBadge tone={deal.stage === "WON" ? "success" : "accent"}>
          ${deal.monthlyValue}/mo
        </LgBadge>
        {deal.notes && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-subtle)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 100,
            }}
          >
            {deal.notes}
          </div>
        )}
      </div>
    </div>
  );
}
