"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ExternalLink,
  Send,
  Copy,
  Trash2,
  Loader2,
  CheckCircle2,
  Mail,
} from "lucide-react";
import { APP_URL } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import type { FullProposal } from "@/types";

export default function ProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [proposal, setProposal] = useState<FullProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadProposal();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadProposal = async () => {
    try {
      const res = await fetch(`/api/proposals/${id}`);
      if (!res.ok) {
        toast.error("Proposal not found");
        router.push("/proposals");
        return;
      }
      const data = await res.json();
      setProposal(data.proposal);
    } catch {
      toast.error("Failed to load proposal");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!proposal) return;
    navigator.clipboard.writeText(`${APP_URL}/p/${proposal.publicId}`);
    toast.success("Public link copied to clipboard");
  };

  const handleSend = async () => {
    if (!recipientEmail || !recipientName) {
      toast.error("Please fill in all fields");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/proposals/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail, recipientName }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send");
        return;
      }
      toast.success("Proposal sent via email!");
      setSendDialogOpen(false);
      loadProposal();
    } catch {
      toast.error("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this proposal?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/proposals/${id}`, { method: "DELETE" });
      toast.success("Proposal deleted");
      router.push("/proposals");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <TopBar title="Proposal" />
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      </div>
    );
  }

  if (!proposal) return null;

  const deliverables = Array.isArray(proposal.deliverables) ? proposal.deliverables : [];
  const benefits = Array.isArray(proposal.benefits) ? proposal.benefits : [];
  const systemsIncluded = Array.isArray(proposal.systemsIncluded) ? proposal.systemsIncluded : [];

  const statusColorMap: Record<string, "blue" | "green" | "gray" | "yellow" | "red"> = {
    DRAFT: "gray",
    SENT: "blue",
    VIEWED: "yellow",
    ACCEPTED: "green",
    REJECTED: "red",
  };

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title={proposal.title} subtitle={`For ${proposal.business.name}`} />
      <div className="p-6 max-w-4xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="ghost" size="sm" asChild className="text-gray-400">
            <Link href="/proposals">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusColorMap[proposal.status] ?? "gray"}>
              {proposal.status}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/p/${proposal.publicId}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview
              </a>
            </Button>
            <Button variant="blue" size="sm" onClick={() => setSendDialogOpen(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Proposal content */}
        <div className="glass-card p-8 space-y-8">
          {/* Header */}
          <div className="border-b border-white/10 pb-6">
            <h1 className="text-2xl font-bold text-white mb-2">{proposal.title}</h1>
            <p className="text-gray-400">Prepared for {proposal.business.name}</p>
            {systemsIncluded.length > 0 && (
              <div className="flex gap-2 mt-3">
                {systemsIncluded.map((s) => (
                  <Badge key={s} variant="blue">{s}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* Package overview */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Package Overview</h2>
            <p className="text-gray-200 leading-relaxed">{proposal.packageOverview}</p>
          </div>

          {/* Price */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
            <p className="text-sm text-gray-400 mb-1">Monthly Investment</p>
            <p className="text-4xl font-bold text-blue-400">{formatCurrency(proposal.monthlyPrice)}<span className="text-xl text-gray-400">/mo</span></p>
          </div>

          {/* Deliverables */}
          {deliverables.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Deliverables</h2>
              <ul className="space-y-2">
                {deliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-200">
                    <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Benefits */}
          {benefits.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Why It Works</h2>
              <ul className="space-y-2">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next steps */}
          {proposal.nextSteps && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Next Steps</h2>
              <p className="text-gray-300">{proposal.nextSteps}</p>
            </div>
          )}
        </div>

        {/* Send dialog */}
        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Proposal via Email</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Recipient Name</Label>
                <Input
                  placeholder="Business owner's name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Recipient Email</Label>
                <Input
                  type="email"
                  placeholder="owner@business.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
              {proposal.emailMessage && (
                <div className="panel p-3 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Email preview message:</p>
                  <p className="text-sm text-gray-300">{proposal.emailMessage}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
              <Button variant="blue" onClick={handleSend} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Send Proposal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
