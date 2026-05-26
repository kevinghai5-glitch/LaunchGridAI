// Export orchestrator: turns an AssetPack into the five real deliverable files
// and bundles them into a single ZIP.

import JSZip from "jszip";
import type { AssetPack } from "@/types";
import { renderFile1Html, renderFile5Html } from "./html";
import { renderFile2Pdf } from "./pdf";
import { renderFile3Docx } from "./docx";
import { renderFile4Txt } from "./txt";

export const DELIVERABLE_FILENAMES = {
  file1: "landing-page-growth-audit.html",
  file2: "lead-qualification-system.pdf",
  file3: "email-nurture-system.docx",
  file4: "sms-follow-up-system.txt",
  file5: "booking-appointment-system.html",
} as const;

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "business"
  );
}

export function zipFilename(pack: AssetPack): string {
  return `${slug(pack.meta.businessName)}-acquisition-pack.zip`;
}

export async function buildAssetZip(pack: AssetPack): Promise<Buffer> {
  const [pdf, docx] = await Promise.all([renderFile2Pdf(pack), renderFile3Docx(pack)]);

  const zip = new JSZip();
  zip.file(DELIVERABLE_FILENAMES.file1, renderFile1Html(pack));
  zip.file(DELIVERABLE_FILENAMES.file2, pdf);
  zip.file(DELIVERABLE_FILENAMES.file3, docx);
  zip.file(DELIVERABLE_FILENAMES.file4, renderFile4Txt(pack));
  zip.file(DELIVERABLE_FILENAMES.file5, renderFile5Html(pack));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
