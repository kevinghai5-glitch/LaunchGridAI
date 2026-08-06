/** GET / PUT /api/intake/[businessId] — the whole intake screen, in one call.
 *
 *  ONE SCREEN, ONE SAVE. This replaces three endpoints and three panels
 *  (/api/leak-gaps + IntakeGaps, /api/workflow-toggles + WorkflowPanel, and
 *  IntakeForm's PATCH). Thirteen inputs go out, thirteen come back.
 *
 *  The save writes to two places, because there are two facts of different kinds:
 *    · the two numbers and the six answers  → LeakAssessment (recomputed)
 *    · the five build decisions             → Business.workflowToggles
 *
 *  It recomputes the assessment on every save because a corrected answer at
 *  kickoff is a correction to the money. The calculator and this screen are two
 *  views of one record, not two records.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  computeAssessment,
  emptyInputs,
  LEAKS,
  type CalculatorInputs,
} from "@/lib/leak-calculator";
import { DECIDABLE_WORKFLOWS, readDecisions, type BuildDecisions } from "@/lib/build-decisions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { businessId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const business = await prisma.business.findFirst({
    where: { id: params.businessId, userId: session.user.id, deletedAt: null },
    select: { id: true, name: true, city: true, industry: true, workflowToggles: true },
  });
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const row = await prisma.leakAssessment.findUnique({
    where: { businessId: business.id },
  });

  const inputs: CalculatorInputs = row
    ? {
        monthlyEnquiries: row.monthlyEnquiries,
        avgJobValue: row.avgJobValue,
        answers: row.answers as unknown as Record<string, number | null>,
        customRows: row.customRows as unknown as CalculatorInputs["customRows"],
        closeRatePct: row.closeRatePct,
        overlapPct: row.overlapPct,
        capPct: row.capPct,
      }
    : emptyInputs();

  return NextResponse.json({
    business: { id: business.id, name: business.name, city: business.city, industry: business.industry },
    // Pre-filled from the calculator. This screen is CONFIRMATION, not entry.
    monthlyEnquiries: inputs.monthlyEnquiries,
    avgJobValue: inputs.avgJobValue,
    answers: inputs.answers,
    hasAssessment: Boolean(row),
    decisions: readDecisions(business.workflowToggles),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: { businessId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const business = await prisma.business.findFirst({
    where: { id: params.businessId, userId: session.user.id, deletedAt: null },
    select: { id: true, workflowToggles: true },
  });
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    monthlyEnquiries?: number | null;
    avgJobValue?: number | null;
    answers?: Record<string, number | null>;
    decisions?: Partial<BuildDecisions>;
  } | null;

  // ── The two numbers + six answers → the assessment ────────────────────────
  const existing = await prisma.leakAssessment.findUnique({
    where: { businessId: business.id },
  });
  const base: CalculatorInputs = existing
    ? {
        monthlyEnquiries: existing.monthlyEnquiries,
        avgJobValue: existing.avgJobValue,
        answers: existing.answers as unknown as Record<string, number | null>,
        customRows: existing.customRows as unknown as CalculatorInputs["customRows"],
        closeRatePct: existing.closeRatePct,
        overlapPct: existing.overlapPct,
        capPct: existing.capPct,
      }
    : emptyInputs();

  const int = (v: unknown, fallback: number | null): number | null => {
    if (v === null) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  };

  const answers = { ...base.answers };
  for (const leak of LEAKS) {
    if (!(leak.id in (body?.answers ?? {}))) continue;
    const raw = (body!.answers ?? {})[leak.id];
    const n = typeof raw === "number" ? raw : Number(raw);
    answers[leak.id] = Number.isInteger(n) && n >= 0 && n < leak.options.length ? n : null;
  }

  const inputs: CalculatorInputs = {
    ...base,
    monthlyEnquiries: int(body?.monthlyEnquiries, base.monthlyEnquiries),
    avgJobValue: int(body?.avgJobValue, base.avgJobValue),
    answers,
  };
  const computed = computeAssessment(inputs);
  const computedAt = new Date();

  // ── The five decisions → the business row ─────────────────────────────────
  // Only the five decidable workflows are writable here. The nine that always
  // install have no switch on the screen and no key in the payload; a stray one
  // arriving is dropped rather than honoured.
  const current = readDecisions(business.workflowToggles);
  const decisions: BuildDecisions = { ...current };
  for (const w of DECIDABLE_WORKFLOWS) {
    const v = body?.decisions?.[w.id];
    if (typeof v === "boolean") decisions[w.id] = v;
  }

  await prisma.$transaction([
    prisma.leakAssessment.upsert({
      where: { businessId: business.id },
      create: {
        businessId: business.id,
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
      },
      update: {
        monthlyEnquiries: inputs.monthlyEnquiries,
        avgJobValue: inputs.avgJobValue,
        answers: inputs.answers as unknown as object,
        computed: computed as unknown as object,
        computedAt,
      },
    }),
    prisma.business.update({
      where: { id: business.id },
      data: {
        workflowToggles: decisions as unknown as object,
        // NO MIRROR. This used to also write Business.monthlyLeadVolume and
        // avgClientValueCad so the generation path — which read those columns —
        // kept working mid-rebuild. /api/generate/assets now reads the assessment
        // directly, so the mirror is gone and the two numbers have exactly one
        // writable home. Two homes for one fact is how the calculator and a
        // delivered document come to quote a client different numbers.
      },
    }),
  ]);

  return NextResponse.json({ ok: true, computed, decisions, savedAt: computedAt.toISOString() });
}
