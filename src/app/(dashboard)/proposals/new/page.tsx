"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Sparkles,
  Plus,
  X,
  ArrowLeft,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import type { SavedBusiness } from "@/types";
import { PRICING_PRESETS } from "@/lib/constants";

export default function NewProposalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillBusinessId = searchParams.get("businessId");

  const [businesses, setBusinesses] = useState<SavedBusiness[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState(prefillBusinessId ?? "");
  const [title, setTitle] = useState("");
  const [packageOverview, setPackageOverview] = useState("");
  const [deliverables, setDeliverables] = useState<string[]>(["", "", "", ""]);
  const [monthlyPrice, setMonthlyPrice] = useState<number>(497);
  const [benefits, setBenefits] = useState<string[]>(["", "", ""]);
  const [nextSteps, setNextSteps] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [systemsIncluded, setSystemsIncluded] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/businesses").then((r) => r.json()).then((d) => {
      setBusinesses(d.businesses ?? []);
    });
  }, []);

  const selectedBusiness = businesses.find((b) => b.id === selectedBusinessId);

  const handleAIGenerate = async () => {
    if (!selectedBusinessId) {
      toast.error("Please select a business first");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/generate/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: selectedBusinessId,
          monthlyPrice,
          systemsIncluded,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to generate");
        return;
      }
      const p = data.proposalData;
      setTitle(p.title);
      setPackageOverview(p.packageOverview);
      setDeliverables(p.deliverables ?? deliverables);
      setBenefits(p.benefits ?? benefits);
      setNextSteps(p.nextSteps ?? "");
      setEmailMessage(p.emailMessage ?? "");
      toast.success("Proposal generated with AI!");
    } catch {
      toast.error("Failed to generate proposal");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBusinessId) return toast.error("Select a business");
    if (!title) return toast.error("Title is required");
    setSaving(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: selectedBusinessId,
          title,
          packageOverview,
          deliverables: deliverables.filter(Boolean),
          monthlyPrice,
          benefits: benefits.filter(Boolean),
          nextSteps,
          emailMessage,
          systemsIncluded,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        return;
      }
      toast.success("Proposal saved!");
      router.push(`/proposals/${data.proposal.id}`);
    } catch {
      toast.error("Failed to save proposal");
    } finally {
      setSaving(false);
    }
  };

  const toggleSystem = (s: string) => {
    setSystemsIncluded((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const updateListItem = (
    list: string[],
    setList: (l: string[]) => void,
    idx: number,
    val: string
  ) => {
    const updated = [...list];
    updated[idx] = val;
    setList(updated);
  };

  const removeListItem = (
    list: string[],
    setList: (l: string[]) => void,
    idx: number
  ) => setList(list.filter((_, i) => i !== idx));

  const addListItem = (list: string[], setList: (l: string[]) => void) =>
    setList([...list, ""]);

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="New Proposal" subtitle="Build a professional client proposal" />
      <div className="p-6 max-w-5xl">
        <Button variant="ghost" size="sm" asChild className="mb-4 text-gray-400">
          <Link href="/proposals">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Form */}
          <div className="space-y-6">
            {/* Business selector */}
            <div className="glass-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white">Business</h2>
              <div className="space-y-2">
                <Label>Select Business</Label>
                <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a saved business…" />
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

              {/* Systems included */}
              <div className="space-y-2">
                <Label>Systems Included</Label>
                <div className="flex gap-2 flex-wrap">
                  {["Lead System", "Content System"].map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSystem(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                        systemsIncluded.includes(s)
                          ? "border-blue-500/50 bg-blue-500/15 text-blue-400"
                          : "border-white/10 text-gray-400 hover:border-blue-500/30"
                      }`}
                    >
                      {systemsIncluded.includes(s) && (
                        <CheckCircle2 className="inline h-3 w-3 mr-1" />
                      )}
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI generate button */}
              <Button
                variant="blue"
                size="sm"
                onClick={handleAIGenerate}
                disabled={generating || !selectedBusinessId}
                className="w-full"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate with AI
              </Button>
            </div>

            {/* Title & overview */}
            <div className="glass-card p-5 space-y-4">
              <div className="space-y-2">
                <Label>Proposal Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="AI-Powered Growth System for XYZ Business"
                />
              </div>
              <div className="space-y-2">
                <Label>Package Overview</Label>
                <Textarea
                  value={packageOverview}
                  onChange={(e) => setPackageOverview(e.target.value)}
                  placeholder="Describe what you're offering and why it matters…"
                  className="h-20"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="glass-card p-5">
              <Label className="mb-3 block">Monthly Price</Label>
              <div className="flex gap-2 mb-3">
                {PRICING_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setMonthlyPrice(p)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                      monthlyPrice === p
                        ? "border-blue-500 bg-blue-500/15 text-blue-400"
                        : "border-white/10 text-gray-400 hover:border-blue-500/30"
                    }`}
                  >
                    ${p}/mo
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-500" />
                <Input
                  type="number"
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(parseInt(e.target.value) || 0)}
                  className="flex-1"
                />
                <span className="text-sm text-gray-400">/mo</span>
              </div>
            </div>

            {/* Deliverables */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Deliverables</Label>
                <Button size="sm" variant="ghost" onClick={() => addListItem(deliverables, setDeliverables)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add
                </Button>
              </div>
              {deliverables.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={d}
                    onChange={(e) => updateListItem(deliverables, setDeliverables, i, e.target.value)}
                    placeholder={`Deliverable ${i + 1}`}
                  />
                  <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9 text-gray-500" onClick={() => removeListItem(deliverables, setDeliverables, i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Benefits */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Benefits</Label>
                <Button size="sm" variant="ghost" onClick={() => addListItem(benefits, setBenefits)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add
                </Button>
              </div>
              {benefits.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={b}
                    onChange={(e) => updateListItem(benefits, setBenefits, i, e.target.value)}
                    placeholder={`Benefit ${i + 1}`}
                  />
                  <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9 text-gray-500" onClick={() => removeListItem(benefits, setBenefits, i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="glass-card p-5 space-y-4">
              <div className="space-y-2">
                <Label>Next Steps</Label>
                <Textarea value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} placeholder="What should the client do next?" className="h-16" />
              </div>
              <div className="space-y-2">
                <Label>Email Message</Label>
                <Textarea value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} placeholder="Message to include when sending the proposal via email…" className="h-20" />
              </div>
            </div>

            <Button variant="blue" size="lg" className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Proposal
            </Button>
          </div>

          {/* Right: Preview */}
          <div className="hidden lg:block">
            <div className="sticky top-6">
              <div className="panel p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="blue">Preview</Badge>
                  <span className="text-xs text-gray-500">Live preview</span>
                </div>
                <h2 className="text-xl font-bold text-white">{title || "Proposal Title"}</h2>
                {selectedBusiness && (
                  <p className="text-sm text-gray-400">For {selectedBusiness.name}</p>
                )}
                {packageOverview && (
                  <p className="text-sm text-gray-300 leading-relaxed">{packageOverview}</p>
                )}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Monthly Investment</p>
                  <p className="text-3xl font-bold text-blue-400">${monthlyPrice}/mo</p>
                </div>
                {deliverables.some(Boolean) && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-2">DELIVERABLES</p>
                    <ul className="space-y-1.5">
                      {deliverables.filter(Boolean).map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                          <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {benefits.some(Boolean) && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-2">BENEFITS</p>
                    <ul className="space-y-1.5">
                      {benefits.filter(Boolean).map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {nextSteps && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">NEXT STEPS</p>
                    <p className="text-sm text-gray-300">{nextSteps}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
