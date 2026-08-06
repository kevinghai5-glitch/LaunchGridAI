/** GET / PUT /api/leak-assessment/[businessId] — the saved leak calculator.
 *
 *  GET  → the saved inputs + the frozen computed result, or a blank sheet.
 *  PUT  → save the inputs, RECOMPUTE server-side, and freeze the result.
 *
 *  The computation happens HERE, not on the client, even though the page also
 *  computes live while the operator types. The figure a client is shown and the
 *  figure that reaches their documents must come from the same place, and that
 *  place is the server — otherwise a stale browser tab could persist a number
 *  nobody else can reproduce.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeAssessment,
  emptyInputs,
  LEAKS,
  CUSTOM_ROW_COUNT,
  DEFAULT_CLOSE_RATE_PCT,
  DEFAULT_OVERLAP_PCT,
  DEFAULT_CAP_PCT,
  type CalculatorInputs,
} from "@/lib/leak-calculator";
import { observedFactsFor, unknownObservedFacts } from "@/lib/observed-facts";

export const dynamic = "force-dynamic";

async function scopedBusiness(businessId: string, userId: string) {
  return prisma.business.findFirst({
    where: { id: businessId, userId, deletedAt: null },
    // workflowToggles + kickoffAt ride along because the Build Plan preview is
    // rendered from the same three facts this route already loads. One round
    // trip, one source — rather than a second endpoint that could disagree.
    select: { id: true, name: true, city: true, industry: true, workflowToggles: true, kickoffAt: true },
  });
}

/** The four measured values for the top of the page. Computed server-side off
 *  the snapshot columns the row already carries — only the small ObservedFacts
 *  object ships, never the multi-MB snapshots. */
async function observedFor(businessId: string, userId: string) {
  const host = await prisma.business.findFirst({
    where: { id: businessId, userId, deletedAt: null },
    select: {
      id: true, name: true, industry: true, category: true, city: true,
      phone: true, address: true, website: true, rating: true, reviewCount: true,
      ownerName: true, psiSnapshot: true, psiSnapshotAt: true,
      researchSnapshot: true, researchSnapshotAt: true,
      measuredFacts: true, measuredFactsAt: true,
    },
  });
  return host ? observedFactsFor(host) : unknownObservedFacts();
}

export async function GET(
  _req: Request,
  { params }: { params: { businessId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const business = await scopedBusiness(params.businessId, session.user.id);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const [row, observed] = await Promise.all([
    prisma.leakAssessment.findUnique({ where: { businessId: business.id } }),
    observedFor(business.id, session.user.id),
  ]);

  if (!row) {
    const inputs = emptyInputs();
    return NextResponse.json({
      business,
      observed,
      inputs,
      computed: computeAssessment(inputs),
      savedAt: null,
      // No row yet, so no share id. The page shows no link at all rather than
      // one that would 404 for whoever it was sent to.
      publicId: null,
    });
  }

  const inputs: CalculatorInputs = {
    monthlyEnquiries: row.monthlyEnquiries,
    avgJobValue: row.avgJobValue,
    answers: row.answers as unknown as Record<string, number | null>,
    customRows: row.customRows as unknown as CalculatorInputs["customRows"],
    closeRatePct: row.closeRatePct,
    overlapPct: row.overlapPct,
    capPct: row.capPct,
  };

  return NextResponse.json({
    business,
    observed,
    inputs,
    // The FROZEN result, exactly as it was when saved — not recomputed on read.
    computed: row.computed,
    savedAt: row.computedAt.toISOString(),
    publicId: row.publicId,
  });
}

/** Coerce whatever arrived into the shape the calculator accepts. Anything
 *  unrecognised becomes "unanswered" rather than an error: this saves on every
 *  keystroke during a live call, and a validation failure mid-sentence is worse
 *  than a dropped field. */
function sanitize(body: unknown): CalculatorInputs {
  const b = (body ?? {}) as Partial<CalculatorInputs>;
  const int = (v: unknown, fallback: number | null): number | null => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  };
  const pct = (v: unknown, fallback: number): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : fallback;
  };

  const answers: Record<string, number | null> = {};
  for (const leak of LEAKS) {
    const raw = (b.answers ?? {})[leak.id];
    const n = typeof raw === "number" ? raw : Number(raw);
    answers[leak.id] =
      Number.isInteger(n) && n >= 0 && n < leak.options.length ? n : null;
  }

  const customRows = Array.from({ length: CUSTOM_ROW_COUNT }, (_, i) => {
    const r = (b.customRows ?? [])[i];
    return {
      label: typeof r?.label === "string" ? r.label.slice(0, 120) : "",
      jobsPerMonth: Number.isFinite(Number(r?.jobsPerMonth)) ? Number(r?.jobsPerMonth) : 0,
    };
  });

  return {
    monthlyEnquiries: int(b.monthlyEnquiries, null),
    avgJobValue: int(b.avgJobValue, null),
    answers,
    customRows,
    closeRatePct: pct(b.closeRatePct, DEFAULT_CLOSE_RATE_PCT),
    overlapPct: pct(b.overlapPct, DEFAULT_OVERLAP_PCT),
    capPct: pct(b.capPct, DEFAULT_CAP_PCT),
  };
}

export async function PUT(
  req: Request,
  { params }: { params: { businessId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const business = await scopedBusiness(params.businessId, session.user.id);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const inputs = sanitize(await req.json().catch(() => null));
  const computed = computeAssessment(inputs);
  const computedAt = new Date();

  const data = {
    userId: session.user.id,
    monthlyEnquiries: inputs.monthlyEnquiries,
    avgJobValue: inputs.avgJobValue,
    answers: inputs.answers as unknown as object,
    customRows: inputs.customRows as unknown as object,
    closeRatePct: inputs.closeRatePct,
    overlapPct: inputs.overlapPct,
    capPct: inputs.capPct,
    computed: computed as unknown as object,
    computedAt,
  };

  // Returned so the first save can reveal the share link without a reload —
  // the assessment IS the offer page, so saving it is what publishes it.
  const row = await prisma.leakAssessment.upsert({
    where: { businessId: business.id },
    create: { businessId: business.id, ...data },
    update: data,
    select: { publicId: true },
  });

  return NextResponse.json({
    ok: true,
    computed,
    savedAt: computedAt.toISOString(),
    publicId: row.publicId,
  });
}
