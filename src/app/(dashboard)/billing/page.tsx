"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Check,
  Zap,
  Loader2,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { PLANS } from "@/lib/constants";

export default function BillingPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const isPro = session?.user?.plan === "pro";

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("🎉 You're now on Pro! Welcome to the full LaunchGrid experience.");
    } else if (searchParams.get("canceled") === "true") {
      toast.info("Checkout canceled.");
    }
  }, [searchParams]);

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to start checkout");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Failed to start checkout");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to open billing portal");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Billing" subtitle="Manage your LaunchGrid subscription" />
      <div className="p-6 max-w-3xl space-y-8">

        {/* Current plan */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Current Plan</h2>
                <p className="text-sm text-gray-400">
                  {isPro ? "Pro — Unlimited everything" : "Free — Limited features"}
                </p>
              </div>
            </div>
            <Badge variant={isPro ? "blue" : "gray"} className="text-sm px-3 py-1">
              {isPro ? "Pro" : "Free"}
            </Badge>
          </div>

          {isPro ? (
            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" onClick={handleManageBilling} disabled={portalLoading}>
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage Billing
              </Button>
            </div>
          ) : (
            <div className="panel rounded-xl p-4 mt-2">
              <p className="text-sm text-gray-400">
                Free plan: 10 businesses · 5 generations · 3 proposals
              </p>
            </div>
          )}
        </div>

        {/* Plans comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free */}
          <div className={`glass-card p-6 ${!isPro ? "border-blue-500/30" : ""}`}>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">{PLANS.free.name}</h3>
              <div className="text-3xl font-bold text-white mt-2">$0</div>
              <div className="text-gray-500 text-sm">forever free</div>
            </div>
            <ul className="space-y-2.5 mb-6">
              {PLANS.free.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-400">
                  <Check className="h-4 w-4 text-gray-600 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {!isPro && (
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <CheckCircle2 className="h-4 w-4" />
                Current plan
              </div>
            )}
          </div>

          {/* Pro */}
          <div className={`glass-card p-6 relative ${isPro ? "border-green-500/30" : "border-blue-500/40"}`}>
            {!isPro && (
              <div className="absolute -top-3 left-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold">
                  <Zap className="h-3 w-3" />
                  Recommended
                </span>
              </div>
            )}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white">{PLANS.pro.name}</h3>
              <div className="flex items-end gap-1 mt-2">
                <span className="text-3xl font-bold text-white">${PLANS.pro.price}</span>
                <span className="text-gray-400 mb-1">/month</span>
              </div>
              <div className="text-gray-500 text-sm">cancel anytime</div>
            </div>
            <ul className="space-y-2.5 mb-6">
              {PLANS.pro.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-200">
                  <Check className="h-4 w-4 text-blue-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {isPro ? (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Active subscription
              </div>
            ) : (
              <Button
                variant="blue"
                className="w-full"
                onClick={handleUpgrade}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Upgrade to Pro
              </Button>
            )}
          </div>
        </div>

        {!isPro && (
          <p className="text-center text-xs text-gray-600">
            One Pro client at $297/mo covers 6+ months of LaunchGrid. It pays for itself on day one.
          </p>
        )}
      </div>
    </div>
  );
}
