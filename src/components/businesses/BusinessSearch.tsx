"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Loader2 } from "lucide-react";
import type { BusinessResult } from "@/types";

interface BusinessSearchProps {
  onResults: (results: BusinessResult[], industry: string, city: string) => void;
}

export function BusinessSearch({ onResults }: BusinessSearchProps) {
  const [industry, setIndustry] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!industry.trim() || !city.trim()) {
      toast.error("Please enter both industry and city");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/businesses/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: industry.trim(), city: city.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Search failed");
        return;
      }
      onResults(data.results, industry.trim(), city.trim());
      if (data.results.length === 0) {
        toast.info("No businesses found. Try different terms.");
      } else {
        toast.success(`Found ${data.results.length} businesses`);
      }
    } catch {
      toast.error("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <h2 className="text-base font-semibold text-[color:var(--text)] mb-4">Find Local Businesses</h2>
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 space-y-1">
          <Label htmlFor="industry" className="text-xs">Industry</Label>
          <Input
            id="industry"
            placeholder="e.g. plumbers, dentists, lawyers"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label htmlFor="city" className="text-xs">City</Label>
          <Input
            id="city"
            placeholder="e.g. Dallas, Austin, Miami"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="blue" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
