"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TopBar } from "@/components/dashboard/TopBar";
import { BusinessSearch } from "@/components/businesses/BusinessSearch";
import { BusinessCard } from "@/components/businesses/BusinessCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Star, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { BusinessResult, SavedBusiness } from "@/types";

export default function BusinessesPage() {
  const [searchResults, setSearchResults] = useState<BusinessResult[]>([]);
  const [searchMeta, setSearchMeta] = useState({ industry: "", city: "" });
  const [savedBusinesses, setSavedBusinesses] = useState<SavedBusiness[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [activeTab, setActiveTab] = useState<"search" | "saved">("search");

  useEffect(() => {
    loadSaved();
  }, []);

  const loadSaved = async () => {
    setLoadingSaved(true);
    try {
      const res = await fetch("/api/businesses");
      const data = await res.json();
      if (res.ok) setSavedBusinesses(data.businesses);
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleResults = (results: BusinessResult[], industry: string, city: string) => {
    setSearchResults(results);
    setSearchMeta({ industry, city });
    setActiveTab("search");
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/businesses/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSavedBusinesses((prev) => prev.filter((b) => b.id !== id));
        toast.success("Business removed");
      } else {
        toast.error("Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Businesses"
        subtitle="Find and manage your local business leads"
      />
      <div className="p-6 space-y-6">
        <BusinessSearch onResults={handleResults} />

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white/[0.03] rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("search")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "search"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Search Results
            {searchResults.length > 0 && (
              <span className="ml-2 text-xs opacity-70">({searchResults.length})</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("saved")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "saved"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Saved
            <span className="ml-2 text-xs opacity-70">({savedBusinesses.length})</span>
          </button>
        </div>

        {/* Search results */}
        {activeTab === "search" && (
          <div>
            {searchResults.length === 0 ? (
              <div className="text-center py-20">
                <Building2 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-gray-400 font-medium mb-1">Search for businesses above</h3>
                <p className="text-sm text-gray-600">Enter an industry and city to find real local businesses</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  Showing {searchResults.length} results for &quot;{searchMeta.industry} in {searchMeta.city}&quot;
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchResults.map((business) => (
                    <BusinessCard
                      key={business.placeId}
                      business={business}
                      industry={searchMeta.industry}
                      city={searchMeta.city}
                      onSaved={() => loadSaved()}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Saved businesses */}
        {activeTab === "saved" && (
          <div>
            {loadingSaved ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : savedBusinesses.length === 0 ? (
              <div className="text-center py-20">
                <Building2 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-gray-400 font-medium mb-1">No saved businesses yet</h3>
                <p className="text-sm text-gray-600">Search for businesses and click the bookmark icon to save them</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedBusinesses.map((business) => (
                  <div key={business.id} className="glass-card p-5 group hover:border-blue-500/20 transition-all duration-200">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Link href={`/businesses/${business.id}`} className="flex-1 min-w-0 hover:text-blue-400 transition-colors">
                        <h3 className="text-sm font-semibold text-white truncate group-hover:text-blue-300">{business.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {business.industry} · {business.city}
                        </p>
                      </Link>
                      <div className="flex items-center gap-1 shrink-0">
                        {business.favorited && (
                          <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-gray-600 hover:text-red-400"
                          onClick={() => handleDelete(business.id)}
                          aria-label="Delete business"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs text-gray-400 mb-3">
                      {business.address && <p className="truncate">{business.address}</p>}
                      {business.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                          <span>{business.rating.toFixed(1)} ({business.reviewCount} reviews)</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="blue" asChild className="flex-1 text-xs h-7">
                        <Link href={`/businesses/${business.id}`}>
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open
                        </Link>
                      </Button>
                      {business.painPoint && (
                        <Badge variant="blue" className="text-xs">AI</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
