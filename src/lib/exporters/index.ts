// Export orchestrator: turns an AssetPack into the five real deliverable files
// and bundles them into a single ZIP.
//
// HTML-primary: all five deliverables ship as premium, standalone HTML — that's
// what the client opens and what makes the pack feel high-end. The editable
// PDF / DOCX / TXT versions of the relevant files are kept alongside in an
// "editable-copies" folder so the buyer can still edit/print them.

import JSZip from "jszip";
import type { AssetPack } from "@/types";
import {
  renderFile1Html,
  renderFile2Html,
  renderFile3Html,
  renderFile4Html,
  renderFile5Html,
} from "./html";
import { renderFile2Pdf } from "./pdf";
import { renderFile3Docx } from "./docx";
import { renderFile4Txt } from "./txt";

// Primary HTML deliverables — the polished files the client actually opens.
export const DELIVERABLE_FILENAMES = {
  file1: "landing-page-growth-audit.html",
  file2: "lead-qualification-system.html",
  file3: "email-nurture-system.html",
  file4: "sms-follow-up-system.html",
  file5: "booking-appointment-system.html",
} as const;

// Editable source copies kept alongside the HTML for buyers who want to tweak
// or print them.
const EDITABLE_FILENAMES = {
  file2: "editable-copies/lead-qualification-system.pdf",
  file3: "editable-copies/email-nurture-system.docx",
  file4: "editable-copies/sms-follow-up-system.txt",
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

  // Primary: all five as premium HTML.
  zip.file(DELIVERABLE_FILENAMES.file1, renderFile1Html(pack));
  zip.file(DELIVERABLE_FILENAMES.file2, renderFile2Html(pack));
  zip.file(DELIVERABLE_FILENAMES.file3, renderFile3Html(pack));
  zip.file(DELIVERABLE_FILENAMES.file4, renderFile4Html(pack));
  zip.file(DELIVERABLE_FILENAMES.file5, renderFile5Html(pack));

  // Editable copies for the files that have a richer source format.
  zip.file(EDITABLE_FILENAMES.file2, pdf);
  zip.file(EDITABLE_FILENAMES.file3, docx);
  zip.file(EDITABLE_FILENAMES.file4, renderFile4Txt(pack));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
