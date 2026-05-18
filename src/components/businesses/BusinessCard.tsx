"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Phone,
  Globe,
  Star,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type { BusinessResult } from "@/types";

interface BusinessCardProps {
  business: BusinessResult;
  industry: string;
  city: string;
  isSaved?: boolean;
  onSaved?: (savedId: string) => void;
}

export function BusinessCard({ business, industry, city, isSaved, onSaved }: BusinessCardProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(isSaved ?? false);

  const handleSave = async () => {
    if (saved) return;
    setSaving(true);
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googlePlaceId: business.placeId,
          name: business.name,
          address: business.address,
          phone: business.phone,
          website: business.website,
          rating: business.rating,
          reviewCount: business.userRatingsTotal,
          latitude: business.location.lat,
          longitude: business.location.lng,
          mapsUrl: business.mapsUrl,
          industry,
          city,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        return;
      }
      setSaved(true);
      toast.success(`${business.name} saved to your businesses`);
      onSaved?.(data.business.id);
    } catch {
      toast.error("Failed to save business");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-5 group hover:border-blue-500/20 transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{business.name}</h3>
          {business.rating > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
              <span className="text-xs text-gray-400">
                {business.rating.toFixed(1)} ({business.userRatingsTotal} reviews)
              </span>
            </div>
          )}
        </div>
        <Button
          size="icon"
          variant={saved ? "blue" : "outline"}
          className="shrink-0 h-8 w-8"
          onClick={handleSave}
          disabled={saving || saved}
          aria-label={saved ? "Saved" : "Save business"}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="space-y-1.5 text-xs text-gray-400">
        {business.address && (
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{business.address}</span>
          </div>
        )}
        {business.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{business.phone}</span>
          </div>
        )}
        {business.website && (
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <a
              href={business.website}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:text-blue-400 transition-colors"
            >
              {business.website.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          </div>
        )}
      </div>

      {business.mapsUrl && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <a
            href={business.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-400 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            View on Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
