// Soft-delete every live COLD_AUDIT row — the data half of the cold audit's
// deletion (owner ruling, 2026-08-01).
//
// SOFT delete, and only ever soft: `deletedAt` is set, and the rows — content,
// publicId, createdAt, all of it — stay in the database forever. Nothing here
// (or anywhere else in this codebase) may hard-delete a row; that is an
// absolute law. Every read path already filters `deletedAt: null`, so after
// this runs the audits vanish from every surface while their history survives:
// nothing reads a COLD_AUDIT row any more (the proposal route that did was
// itself deleted on 2026-08-06), and any old
// /a/<publicId> teaser link a prospect still holds resolves to nothing (the
// route itself is deleted).
//
// Idempotent by construction: the WHERE clause only matches live rows, so a
// second run reports 0.
//
// Run with: node_modules/.bin/tsx scripts/soft-delete-cold-audits.ts
// (Prisma loads env itself; this script prints no env values.)

import { prisma } from "@/lib/prisma";

async function main(): Promise<void> {
  const result = await prisma.generatedSystem.updateMany({
    where: { type: "COLD_AUDIT", deletedAt: null },
    data: { deletedAt: new Date() },
  });
  console.log(
    `Soft-deleted ${result.count} COLD_AUDIT row(s) (deletedAt set; rows and content retained forever).`
  );
}

main()
  .catch((err) => {
    console.error("soft-delete-cold-audits failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
