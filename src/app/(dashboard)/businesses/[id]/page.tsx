"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetPackView } from "@/components/businesses/AssetPackView";
import type { AssetPack } from "@/types";
import {
  MapPin,
  Phone,
  Globe,
  Star,
  Heart,
  HeartOff,
  ExternalLink,
  Sparkles,
  FileText,
  Loader2,
  ArrowLeft,
  Zap,
  Target,
  Lightbulb,
  Rocket,
} from "lucide-react";

interface BusinessWithSystems {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  industry: string | null;
  city: string | null;
  category: string | null;
  description: string | null;
  photoUrl: string | null;
  favorited: boolean;
  painPoint: string | null;
  outreachAngle: string | null;
  suggestedOffer: string | null;
  generatedSystems: Array<{ id: string; type: string; content: unknown; createdAt: string }>;
  proposals: Array<{ id: string; title: string; status: string; monthlyPrice: number; createdAt: string }>;
}

export default function BusinessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [business, setBusiness] = useState<BusinessWithSystems | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [generatingLead, setGeneratingLead] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [generatingAssets, setGeneratingAssets] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const autoGenTriggered = useRef(false);

  useEffect(() => {
    loadBusiness();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-trigger asset generation when arriving via "Generate Assets" (?generate=assets).
  useEffect(() => {
    if (
      !loading &&
      business &&
      !autoGenTriggered.current &&
      searchParams.get("generate") === "assets"
    ) {
      autoGenTriggered.current = true;
      router.replace(`/businesses/${id}`);
      handleGenerateAssets();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, business]);

  const loadBusiness = async () => {
    try {
      const res = await fetch(`/api/businesses/${id}`);
      if (!res.ok) {
        toast.error("Business not found");
        router.push("/businesses");
        return;
      }
      const data = await res.json();
      setBusiness(data.business);
    } catch {
      toast.error("Failed to load business");
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = async () => {
    if (!business) return;
    setFavoriting(true);
    try {
      const res = await fetch(`/api/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorited: !business.favorited }),
      });
      const data = await res.json();
      if (res.ok) {
        setBusiness(data.business);
        toast.success(data.business.favorited ? "Added to favorites" : "Removed from favorites");
      }
    } catch {
      toast.error("Failed to update favorite");
    } finally {
      setFavoriting(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    setGeneratingSuggestions(true);
    try {
      const res = await fetch("/api/generate/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to generate suggestions");
        return;
      }
      setBusiness((prev) => prev ? { ...prev, ...data.suggestions } : prev);
      toast.success("AI suggestions generated");
    } catch {
      toast.error("Failed to generate suggestions");
    } finally {
      setGeneratingSuggestions(false);
    }
  };

  const handleGenerateLead = async () => {
    setGeneratingLead(true);
    try {
      const res = await fetch("/api/generate/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to generate lead system");
        return;
      }
      toast.success("Lead system generated!");
      loadBusiness();
    } catch {
      toast.error("Failed to generate lead system");
    } finally {
      setGeneratingLead(false);
    }
  };

  const handleGenerateAssets = async () => {
    setGeneratingAssets(true);
    try {
      const res = await fetch("/api/generate/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to generate assets");
        return;
      }
      toast.success("Asset pack generated!");
      await loadBusiness();
    } catch {
      toast.error("Failed to generate assets");
    } finally {
      setGeneratingAssets(false);
    }
  };

  const handleGenerateContent = async () => {
    setGeneratingContent(true);
    try {
      const res = await fetch("/api/generate/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to generate content system");
        return;
      }
      toast.success("Content system generated!");
      loadBusiness();
    } catch {
      toast.error("Failed to generate content system");
    } finally {
      setGeneratingContent(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <TopBar title="Business Details" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!business) return null;

  const leadSystems = business.generatedSystems.filter((s) => s.type === "LEAD");
  const contentSystems = business.generatedSystems.filter((s) => s.type === "CONTENT");
  const assetSystems = business.generatedSystems.filter((s) => s.type === "ASSETS");
  const latestAssetPack = assetSystems[0]?.content as AssetPack | undefined;

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title={business.name} subtitle={`${business.industry ?? ""} · ${business.city ?? ""}`} />
      <div className="p-6 space-y-6">
        {/* Back */}
        <Button variant="ghost" size="sm" asChild className="text-gray-400">
          <Link href="/businesses">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Businesses
          </Link>
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Business info */}
          <div className="lg:col-span-1 space-y-4">
            <div className="glass-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{business.name}</h2>
                  <p className="text-sm text-gray-400">{business.industry}</p>
                </div>
                <Button
                  size="icon"
                  variant={business.favorited ? "blue" : "outline"}
                  className="h-8 w-8"
                  onClick={handleFavorite}
                  disabled={favoriting}
                  aria-label={business.favorited ? "Remove from favorites" : "Add to favorites"}
                >
                  {favoriting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : business.favorited ? (
                    <Heart className="h-4 w-4 fill-current" />
                  ) : (
                    <HeartOff className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="space-y-2 text-sm text-gray-400">
                {business.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-gray-500" />
                    <span>{business.address}</span>
                  </div>
                )}
                {business.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-gray-500" />
                    <a href={`tel:${business.phone}`} className="hover:text-blue-400">{business.phone}</a>
                  </div>
                )}
                {business.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 shrink-0 text-gray-500" />
                    <a href={business.website} target="_blank" rel="noopener noreferrer" className="truncate hover:text-blue-400">
                      {business.website.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  </div>
                )}
                {business.rating && (
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 shrink-0 text-yellow-400 fill-yellow-400" />
                    <span>{business.rating.toFixed(1)} ({business.reviewCount} reviews)</span>
                  </div>
                )}
                {business.mapsUrl && (
                  <a
                    href={business.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mt-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on Google Maps
                  </a>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white mb-2">Actions</h3>
              <Button
                variant="blue"
                className="w-full"
                onClick={handleGenerateAssets}
                disabled={generatingAssets}
              >
                {generatingAssets ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Rocket className="h-4 w-4 mr-2" />
                )}
                {assetSystems.length > 0 ? "Regenerate Assets" : "Generate Assets"}
              </Button>
              <p className="text-xs text-gray-500 -mt-1 mb-1">
                Full growth pack: landing page, lead capture, 7-day emails, SMS &amp; booking copy.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleGenerateLead}
                disabled={generatingLead}
              >
                {generatingLead ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Target className="h-4 w-4 mr-2" />
                )}
                Generate Lead System
                {leadSystems.length > 0 && (
                  <Badge variant="blue" className="ml-2 text-xs">{leadSystems.length}</Badge>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleGenerateContent}
                disabled={generatingContent}
              >
                {generatingContent ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Generate Content System
                {contentSystems.length > 0 && (
                  <Badge variant="blue" className="ml-2 text-xs">{contentSystems.length}</Badge>
                )}
              </Button>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href={`/proposals/new?businessId=${id}`}>
                  <FileText className="h-4 w-4 mr-2" />
                  Create Proposal
                </Link>
              </Button>
            </div>
          </div>

          {/* AI Suggestions + Systems */}
          <div className="lg:col-span-2 space-y-4">
            {/* AI Suggestions panel */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">AI-Generated Suggestions</h3>
                  <Badge variant="blue" className="text-xs">AI</Badge>
                </div>
                <Button
                  variant="blue-outline"
                  size="sm"
                  onClick={handleGenerateSuggestions}
                  disabled={generatingSuggestions}
                >
                  {generatingSuggestions ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  {business.painPoint ? "Regenerate" : "Generate"}
                </Button>
              </div>

              {business.painPoint ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="panel p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-3.5 w-3.5 text-red-400" />
                      <span className="text-xs font-medium text-gray-400">Pain Point</span>
                    </div>
                    <p className="text-sm text-white">{business.painPoint}</p>
                  </div>
                  <div className="panel p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="h-3.5 w-3.5 text-yellow-400" />
                      <span className="text-xs font-medium text-gray-400">Outreach Angle</span>
                    </div>
                    <p className="text-sm text-white">{business.outreachAngle}</p>
                  </div>
                  <div className="panel p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-3.5 w-3.5 text-green-400" />
                      <span className="text-xs font-medium text-gray-400">Suggested Offer</span>
                    </div>
                    <p className="text-sm text-white">{business.suggestedOffer}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Sparkles className="h-8 w-8 text-gray-700 mx-auto mb-3" />
                  <p className="text-sm">Click &quot;Generate&quot; to get AI-powered insights for this business</p>
                </div>
              )}
            </div>

            {/* Generated Asset Pack */}
            {(generatingAssets || latestAssetPack) && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Rocket className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Generated Asset Pack</h3>
                  {latestAssetPack && !generatingAssets && (
                    <span className="text-xs text-gray-500">
                      · {new Date(assetSystems[0].createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {generatingAssets ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400 mb-4" />
                    <p className="text-sm text-white">Analyzing {business.name}…</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Reading their website, services &amp; positioning, then writing custom assets.
                    </p>
                  </div>
                ) : latestAssetPack ? (
                  <AssetPackView pack={latestAssetPack} businessId={business.id} />
                ) : null}
              </div>
            )}

            {/* Generated Systems */}
            {business.generatedSystems.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Generated Systems</h3>
                <div className="space-y-3">
                  {business.generatedSystems.map((system) => (
                    <div key={system.id} className="panel p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {system.type === "LEAD" ? (
                          <Target className="h-4 w-4 text-blue-400" />
                        ) : system.type === "ASSETS" ? (
                          <Rocket className="h-4 w-4 text-blue-400" />
                        ) : (
                          <Zap className="h-4 w-4 text-blue-400" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-white">
                            {system.type === "LEAD"
                              ? "Lead Capture System"
                              : system.type === "ASSETS"
                              ? "Growth Asset Pack"
                              : "Content Calendar System"}
                          </div>
                          <div className="text-xs text-gray-500">
                            Generated {new Date(system.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Badge variant={system.type === "LEAD" ? "blue" : "green"}>
                        {system.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proposals */}
            {business.proposals.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Proposals</h3>
                <div className="space-y-3">
                  {business.proposals.map((p) => (
                    <Link
                      key={p.id}
                      href={`/proposals/${p.id}`}
                      className="panel p-4 flex items-center justify-between group hover:border-blue-500/20 transition-all"
                    >
                      <div>
                        <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">{p.title}</div>
                        <div className="text-xs text-gray-500">${p.monthlyPrice}/mo</div>
                      </div>
                      <Badge variant={p.status === "ACCEPTED" ? "green" : p.status === "SENT" ? "blue" : "gray"}>
                        {p.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
