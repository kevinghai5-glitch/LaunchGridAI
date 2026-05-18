"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  DollarSign,
  Building2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { DEAL_STAGES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import type { Deal, SavedBusiness } from "@/types";

const stageColorMap: Record<string, string> = {
  SAVED: "bg-slate-500/10 border-slate-500/20 text-slate-400",
  SYSTEMS_GENERATED: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  PROPOSAL_SENT: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
  FOLLOW_UP: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  WON: "bg-green-500/10 border-green-500/20 text-green-400",
  LOST: "bg-red-500/10 border-red-500/20 text-red-400",
};

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [businesses, setBusinesses] = useState<SavedBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newBusinessId, setNewBusinessId] = useState("");
  const [newMonthlyValue, setNewMonthlyValue] = useState<number>(497);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadDeals();
    fetch("/api/businesses").then((r) => r.json()).then((d) => {
      setBusinesses(d.businesses ?? []);
    });
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

  const handleAddDeal = async () => {
    if (!newBusinessId) return toast.error("Select a business");
    setAdding(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: newBusinessId,
          stage: "SAVED",
          monthlyValue: newMonthlyValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || "Failed to add deal");
      setDeals((prev) => [data.deal, ...prev]);
      setAddDialogOpen(false);
      setNewBusinessId("");
      toast.success("Deal added to pipeline");
    } finally {
      setAdding(false);
    }
  };

  const handleStageChange = async (dealId: string, stage: string) => {
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const data = await res.json();
      if (res.ok) {
        setDeals((prev) => prev.map((d) => (d.id === dealId ? data.deal : d)));
        toast.success("Stage updated");
      }
    } catch {
      toast.error("Failed to update stage");
    }
  };

  const handleValueChange = async (dealId: string, value: number) => {
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyValue: value }),
      });
      const data = await res.json();
      if (res.ok) {
        setDeals((prev) => prev.map((d) => (d.id === dealId ? data.deal : d)));
      }
    } catch {
      toast.error("Failed to update value");
    }
  };

  const handleDelete = async (dealId: string) => {
    try {
      await fetch(`/api/deals/${dealId}`, { method: "DELETE" });
      setDeals((prev) => prev.filter((d) => d.id !== dealId));
      toast.success("Deal removed");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const mrr = deals
    .filter((d) => d.stage === "WON")
    .reduce((sum, d) => sum + d.monthlyValue, 0);

  const dealsByStage = DEAL_STAGES.reduce<Record<string, Deal[]>>(
    (acc, stage) => {
      acc[stage.key] = deals.filter((d) => d.stage === stage.key);
      return acc;
    },
    {}
  );

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Deals Pipeline" subtitle="Track your clients through the sales process" />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="panel px-4 py-2 flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-green-400" />
              <span className="text-green-400 font-semibold">{formatCurrency(mrr)}/mo MRR</span>
            </div>
            <span className="text-sm text-gray-500">{deals.length} total deals</span>
          </div>
          <Button variant="blue" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Deal
          </Button>
        </div>

        {/* Kanban columns */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {DEAL_STAGES.map((stageConfig) => {
              const stageName = stageConfig.key;
              const stageDeals = dealsByStage[stageName] ?? [];
              return (
                <div key={stageName} className="flex flex-col gap-3">
                  {/* Column header */}
                  <div className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between ${stageColorMap[stageName]}`}>
                    <span>{stageConfig.label}</span>
                    <span className="opacity-70">{stageDeals.length}</span>
                  </div>

                  {/* Deal cards */}
                  <div className="space-y-2 min-h-[100px]">
                    {stageDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onStageChange={handleStageChange}
                        onValueChange={handleValueChange}
                        onDelete={handleDelete}
                      />
                    ))}
                    {stageDeals.length === 0 && (
                      <div className="text-xs text-gray-700 text-center py-4">Empty</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {deals.length === 0 && !loading && (
          <div className="text-center py-20">
            <Building2 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-gray-400 font-medium mb-2">No deals in your pipeline</h3>
            <p className="text-sm text-gray-500 mb-6">Add deals to track your sales progress and estimate MRR.</p>
            <Button variant="blue" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Deal
            </Button>
          </div>
        )}
      </div>

      {/* Add deal dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Deal to Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Business</Label>
              <Select value={newBusinessId} onValueChange={setNewBusinessId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a business…" />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} — {b.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monthly Value ($)</Label>
              <Input
                type="number"
                value={newMonthlyValue}
                onChange={(e) => setNewMonthlyValue(parseInt(e.target.value) || 0)}
                placeholder="497"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button variant="blue" onClick={handleAddDeal} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DealCardProps {
  deal: Deal;
  onStageChange: (id: string, stage: string) => void;
  onValueChange: (id: string, value: number) => void;
  onDelete: (id: string) => void;
}

function DealCard({ deal, onStageChange, onValueChange, onDelete }: DealCardProps) {
  const [notes, setNotes] = useState(deal.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [value, setValue] = useState(deal.monthlyValue);

  const saveNotes = async () => {
    try {
      await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setEditingNotes(false);
    } catch {
      toast.error("Failed to save notes");
    }
  };

  return (
    <div className="glass-card p-3 space-y-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-white text-sm truncate">{deal.business.name}</div>
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 text-gray-600 hover:text-red-400 shrink-0"
          onClick={() => onDelete(deal.id)}
          aria-label="Delete deal"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Monthly value */}
      <div className="flex items-center gap-1">
        <DollarSign className="h-3 w-3 text-gray-500" />
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(parseInt(e.target.value) || 0)}
          onBlur={() => onValueChange(deal.id, value)}
          className="w-full bg-transparent text-green-400 font-semibold text-xs outline-none"
          aria-label="Monthly value"
        />
        <span className="text-gray-600">/mo</span>
      </div>

      {/* Stage selector */}
      <Select value={deal.stage} onValueChange={(v) => onStageChange(deal.id, v)}>
        <SelectTrigger className="h-7 text-xs py-0 px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEAL_STAGES.map((s) => (
            <SelectItem key={s.key} value={s.key} className="text-xs">
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Notes */}
      {editingNotes ? (
        <div className="space-y-1">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-16 text-xs"
            placeholder="Add notes…"
          />
          <Button size="sm" variant="blue" className="h-6 text-xs w-full" onClick={saveNotes}>
            Save
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setEditingNotes(true)}
          className="text-gray-600 hover:text-gray-400 transition-colors text-left w-full truncate"
        >
          {notes || "Add notes…"}
        </button>
      )}
    </div>
  );
}
