// Google PageSpeed Insights integration.
//
// Pulls real Core Web Vitals + performance score for both mobile and desktop on
// the target business's website. We surface only the conversion-relevant signal
// (load speed, layout stability, interactivity, mobile-friendliness, top fixes)
// — not a full Lighthouse report. The goal is a short, sharp "Technical UX &
// Performance" section in the audit, not an SEO dashboard.
//
// Best-effort: returns null on any failure.

const PSI_BASE = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export type PsiStrategy = "mobile" | "desktop";

export interface PsiResult {
  strategy: PsiStrategy;
  performanceScore: number | null; // 0–100
  metrics: {
    lcpSeconds: number | null; // Largest Contentful Paint
    cls: number | null; // Cumulative Layout Shift
    inpMs: number | null; // Interaction to Next Paint
    fcpSeconds: number | null; // First Contentful Paint
    ttfbMs: number | null; // Server response time
    speedIndexSeconds: number | null;
  };
  topOpportunities: { title: string; estimatedSavingsMs: number | null }[];
}

export interface PsiBundle {
  available: boolean;
  url: string | null;
  mobile: PsiResult | null;
  desktop: PsiResult | null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface PsiAudit {
  id?: string;
  title?: string;
  score?: number | null;
  numericValue?: number;
  details?: { overallSavingsMs?: number };
}

async function runOne(url: string, strategy: PsiStrategy): Promise<PsiResult | null> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    const params = new URLSearchParams({
      url,
      strategy,
      key: apiKey,
      category: "performance",
    });
    const res = await fetch(`${PSI_BASE}?${params}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number | null } };
        audits?: Record<string, PsiAudit>;
      };
    };

    const audits = data.lighthouseResult?.audits ?? {};
    const score = data.lighthouseResult?.categories?.performance?.score;

    const lcpMs = num(audits["largest-contentful-paint"]?.numericValue);
    const fcpMs = num(audits["first-contentful-paint"]?.numericValue);
    const ttfbMs = num(audits["server-response-time"]?.numericValue);
    const speedIndexMs = num(audits["speed-index"]?.numericValue);
    const cls = num(audits["cumulative-layout-shift"]?.numericValue);
    const inpMs =
      num(audits["interaction-to-next-paint"]?.numericValue) ??
      num(audits["experimental-interaction-to-next-paint"]?.numericValue);

    const opportunityIds = [
      "render-blocking-resources",
      "uses-optimized-images",
      "uses-text-compression",
      "unminified-css",
      "unminified-javascript",
      "unused-css-rules",
      "unused-javascript",
      "modern-image-formats",
      "uses-responsive-images",
      "efficient-animated-content",
      "server-response-time",
      "redirects",
    ];

    const topOpportunities = opportunityIds
      .map((id) => audits[id])
      .filter((a): a is PsiAudit => Boolean(a))
      .filter((a) => (a.score ?? 1) < 0.9 && (a.details?.overallSavingsMs ?? 0) > 100)
      .map((a) => ({
        title: a.title ?? a.id ?? "Optimization",
        estimatedSavingsMs: a.details?.overallSavingsMs ?? null,
      }))
      .sort((a, b) => (b.estimatedSavingsMs ?? 0) - (a.estimatedSavingsMs ?? 0))
      .slice(0, 5);

    return {
      strategy,
      performanceScore: typeof score === "number" ? Math.round(score * 100) : null,
      metrics: {
        lcpSeconds: lcpMs != null ? Math.round((lcpMs / 1000) * 10) / 10 : null,
        cls: cls != null ? Math.round(cls * 100) / 100 : null,
        inpMs: inpMs != null ? Math.round(inpMs) : null,
        fcpSeconds: fcpMs != null ? Math.round((fcpMs / 1000) * 10) / 10 : null,
        ttfbMs: ttfbMs != null ? Math.round(ttfbMs) : null,
        speedIndexSeconds: speedIndexMs != null ? Math.round((speedIndexMs / 1000) * 10) / 10 : null,
      },
      topOpportunities,
    };
  } catch {
    return null;
  }
}

export async function runPageSpeed(
  website: string | null | undefined
): Promise<PsiBundle> {
  if (!website || !process.env.PAGESPEED_API_KEY) {
    return { available: false, url: null, mobile: null, desktop: null };
  }
  let normalized: string;
  try {
    normalized = new URL(website).toString();
  } catch {
    return { available: false, url: null, mobile: null, desktop: null };
  }

  const [mobile, desktop] = await Promise.all([
    runOne(normalized, "mobile"),
    runOne(normalized, "desktop"),
  ]);

  return {
    available: Boolean(mobile || desktop),
    url: normalized,
    mobile,
    desktop,
  };
}

// Build a compact, conversion-focused briefing for the prompt — NOT a full report.
export function psiToPromptBlock(psi: PsiBundle): string {
  if (!psi.available) {
    return "TECHNICAL UX & PERFORMANCE (REAL): unavailable — treat performance findings as strategic assumptions.";
  }

  const lines = ["TECHNICAL UX & PERFORMANCE (REAL — measured with Google PageSpeed Insights):"];
  for (const r of [psi.mobile, psi.desktop]) {
    if (!r) continue;
    const m = r.metrics;
    const bits: string[] = [];
    if (r.performanceScore != null) bits.push(`perf ${r.performanceScore}/100`);
    if (m.lcpSeconds != null) bits.push(`LCP ${m.lcpSeconds}s`);
    if (m.cls != null) bits.push(`CLS ${m.cls}`);
    if (m.inpMs != null) bits.push(`INP ${m.inpMs}ms`);
    if (m.fcpSeconds != null) bits.push(`FCP ${m.fcpSeconds}s`);
    if (m.ttfbMs != null) bits.push(`TTFB ${m.ttfbMs}ms`);
    lines.push(`- ${r.strategy.toUpperCase()}: ${bits.join(", ") || "n/a"}`);
    if (r.topOpportunities.length) {
      lines.push(
        `  Top fixes: ${r.topOpportunities
          .map((o) => `${o.title}${o.estimatedSavingsMs ? ` (~${Math.round(o.estimatedSavingsMs)}ms)` : ""}`)
          .join("; ")}`
      );
    }
  }
  lines.push(
    "Translate these into business impact (lost mobile conversions, bounce risk, perceived slowness, ad-spend efficiency). Never paste raw Lighthouse jargon — the deliverable is for a business owner."
  );
  return lines.join("\n");
}
