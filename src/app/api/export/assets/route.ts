import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildAssetZip, zipFilename } from "@/lib/exporters";
import type { AssetPack } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Bundle the latest generated Growth Asset Pack for a business into a ZIP of the
// five real deliverable files (.html, .pdf, .docx, .txt, .html).
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { businessId } = await req.json().catch(() => ({ businessId: undefined }));
    if (!businessId || typeof businessId !== "string") {
      return NextResponse.json({ error: "businessId is required" }, { status: 400 });
    }

    const latest = await prisma.generatedSystem.findFirst({
      where: { businessId, userId: session.user.id, type: "ASSETS" },
      orderBy: { createdAt: "desc" },
      include: { business: { select: { name: true } } },
    });

    if (!latest) {
      return NextResponse.json(
        { error: "No generated asset pack found. Generate the pack first." },
        { status: 404 }
      );
    }

    const pack = latest.content as unknown as AssetPack;
    if (!pack?.meta || !pack.file1) {
      return NextResponse.json(
        { error: "This pack predates the export format. Regenerate it, then export." },
        { status: 409 }
      );
    }

    const zip = await buildAssetZip(pack);
    const filename = zipFilename(pack);

    return new NextResponse(zip as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zip.length),
      },
    });
  } catch (error) {
    console.error("Export assets error:", error);
    return NextResponse.json({ error: "Failed to export deliverables" }, { status: 500 });
  }
}
