// Save endpoint — persists a generated AssetPack to the operator's Library.
// Generation itself no longer writes to the DB; nothing appears in the Library
// until the operator explicitly saves it here. Saving replaces any prior saved
// pack for the same business so the Library shows one entry per business.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AssetPack } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const businessId = body?.businessId;
  const assetPack = body?.assetPack as AssetPack | undefined;

  if (!businessId || typeof businessId !== "string") {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }
  if (!assetPack?.meta || !assetPack.file1) {
    return NextResponse.json({ error: "A complete asset pack is required" }, { status: 400 });
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
    select: { id: true },
  });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // One saved pack per business: clear prior saves, then store the latest.
  const [, system] = await prisma.$transaction([
    prisma.generatedSystem.deleteMany({
      where: { businessId: business.id, userId: session.user.id, type: "ASSETS" },
    }),
    prisma.generatedSystem.create({
      data: {
        businessId: business.id,
        userId: session.user.id,
        type: "ASSETS",
        content: assetPack as unknown as object,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, id: system.id, savedAt: system.createdAt });
}
