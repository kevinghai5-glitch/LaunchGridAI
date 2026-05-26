"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { TopBar } from "@/components/dashboard/TopBar";
import { LgButton } from "@/components/ui/lg-button";
import { KpiCard } from "@/components/dashboard/os";
import { PIPELINE_STAGES, type DealStage } from "@/lib/stages";
import type { Deal } from "@/types";

const STAGE_WEIGHT: Record<string, number> = {
  SAVED: 0.1,
  SYSTEMS_GENERATED: 0.25,
  PROPOSAL_SENT: 0.4,
  FOLLOW_UP: 0.6,
  WON: 1.0,
};

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
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage: toStage } : d)));
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
  const inMotion = deals.filter((d) => d.stage !== "WON" && d.stage !== "SAVED" && d.stage !== "LOST");
  const totalMRR = wonDeals.reduce((s, d) => s + d.monthlyValue, 0);
  const pipelineMRR = inMotion.reduce((s, d) => s + d.monthlyValue, 0);
  const forecast = deals.reduce((s, d) => s + d.monthlyValue * (STAGE_WEIGHT[d.stage] ?? 0.1), 0);

  return (
    <>
      <TopBar title="Pipeline" subtitle="Active deals" />
      <div style={{ padding: "40px 56px 80px", maxWidth: 1500, margin: "0 auto" }}>
        {/* Editorial header */}
        <div className="rise" style={{ marginBottom: 32 }}>
          <h1
            className="lg-display"
            style={{ margin: 0, fontSize: 32, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--text)" }}
          >
            Pipeline
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--text-3)", marginTop: 6 }}>
            {deals.length} deals · ${totalMRR.toLocaleString()} active MRR · ${pipelineMRR.toLocaleString()} in motion
          </div>
        </div>

        {/* KPI row */}
        <div className="rise grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 28 }}>
          <KpiCard label="Active MRR" value={`$${totalMRR.toLocaleString()}`} sub={`${wonDeals.length} retainers · auto-renew`} color="money" />
          <KpiCard label="In pipeline" value={`$${pipelineMRR.toLocaleString()}`} sub={`${inMotion.length} deals warming`} />
          <KpiCard label="Weighted forecast" value={`$${Math.round(forecast).toLocaleString()}`} sub="By stage probability" />
        </div>

        {/* Filter strip */}
        <div className="flex items-center" style={{ gap: 4, marginBottom: 18 }}>
          <LgButton variant="ghost" size="sm">All deals</LgButton>
          <LgButton variant="ghost" size="sm">Mine</LgButton>
          <LgButton variant="ghost" size="sm">Closing soon</LgButton>
          <LgButton variant="ghost" size="sm">Stalled</LgButton>
          <span style={{ flex: 1 }} />
          <LgButton variant="secondary" size="sm" icon="plus">Add deal</LgButton>
        </div>

        {/* Kanban */}
        <div
          className="grid items-start"
          style={{ gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, minmax(0, 1fr))`, gap: 14 }}
        >
          {PIPELINE_STAGES.map((s) => {
            const stageDeals = deals.filter((d) => d.stage === s.id);
            const mrr = stageDeals.reduce((acc, d) => acc + d.monthlyValue, 0);
            const isOver = overStage === s.id;
            return (
              <div
                key={s.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverStage(s.id);
                }}
                onDragLeave={() => setOverStage((cur) => (cur === s.id ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) moveDeal(dragId, s.id);
                }}
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {/* column header */}
                <div style={{ padding: "4px 4px 12px" }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>{s.label}</span>
                    <span className="lg-mono tnum" style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                      {stageDeals.length}
                    </span>
                  </div>
                  <div
                    className="lg-display tnum"
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      letterSpacing: "-0.02em",
                      color: s.id === "WON" ? "var(--money)" : "var(--text)",
                    }}
                  >
                    ${mrr.toLocaleString()}
                    <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 400 }}>/mo</span>
                  </div>
                </div>

                {/* cards */}
                <div
                  className="rise"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    minHeight: 60,
                    padding: isOver ? 6 : 0,
                    borderRadius: 12,
                    border: isOver ? "1px dashed var(--accent)" : "1px solid transparent",
                    background: isOver ? "var(--accent-soft)" : "transparent",
                    transition: "background var(--t), border-color var(--t)",
                  }}
                >
                  {stageDeals.length === 0 && !isOver ? (
                    <div
                      style={{
                        padding: "20px 14px",
                        border: "1px dashed var(--line-strong)",
                        borderRadius: 12,
                        fontSize: 11.5,
                        color: "var(--text-4)",
                        textAlign: "center",
                      }}
                    >
                      Empty
                    </div>
                  ) : (
                    stageDeals.map((d) => (
                      <DealCard
                        key={d.id}
                        deal={d}
                        stageId={s.id}
                        dragging={dragId === d.id}
                        onDragStart={() => setDragId(d.id)}
                        onDragEnd={() => setDragId(null)}
                      />
                    ))
                  )}
                  <button
                    className="flex items-center"
                    style={{
                      gap: 6,
                      padding: "8px 12px",
                      fontSize: 11.5,
                      color: "var(--text-4)",
                      background: "transparent",
                      border: "1px dashed var(--line)",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <Plus size={11} strokeWidth={1.75} /> Add to {s.label.toLowerCase()}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!loading && deals.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 13.5 }}>
            No deals yet. Send a proposal to start building your pipeline.
          </div>
        )}
      </div>
    </>
  );
}

function DealCard({
  deal,
  stageId,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  deal: Deal;
  stageId: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const contact = deal.notes?.trim();
  const initials = deal.business?.name
    ? deal.business.name.split(" ").map((w) => w[0]).slice(0, 2).join("")
    : "—";
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="surface hover-lift"
      style={{
        padding: "14px 16px",
        cursor: "grab",
        opacity: dragging ? 0.85 : 1,
        transform: dragging ? "rotate(-1.5deg) scale(1.02)" : "none",
        transition: "transform 0.18s cubic-bezier(0.2,0.7,0.3,1), opacity 0.18s, background var(--t)",
      }}
    >
      <div
        className="lg-display"
        style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: "-0.012em", color: "var(--text)" }}
      >
        {deal.business?.name ?? "—"}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 3 }}>
        {deal.business?.city ?? "—"}
      </div>
      <div className="flex items-baseline justify-between" style={{ marginTop: 14 }}>
        <span
          className="lg-display tnum"
          style={{
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: "-0.015em",
            color: stageId === "WON" ? "var(--money)" : "var(--text)",
          }}
        >
          ${deal.monthlyValue}
          <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 400 }}>/mo</span>
        </span>
      </div>
      {contact && (
        <div
          className="flex items-center"
          style={{ gap: 7, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}
        >
          <div
            className="grid place-items-center"
            style={{
              width: 18,
              height: 18,
              borderRadius: 99,
              background: "oklch(0.40 0.05 250)",
              color: "white",
              fontSize: 8.5,
              fontWeight: 600,
            }}
          >
            {initials}
          </div>
          <span
            style={{
              fontSize: 11.5,
              color: "var(--text-2)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {contact}
          </span>
        </div>
      )}
    </div>
  );
}
