// DOCX deliverable builder (File 3 — 7-day email nurture sequence).
// Produces a true, editable .docx with structured headings, spacing, and styles
// using the `docx` library.

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from "docx";
import type { AssetPack } from "@/types";

const ACCENT = "1F5FFF";
const MUTED = "5B6472";

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    children: [new TextRun({ text, bold: true, size: 30, color: "15171C" })],
  });
}

function metaLine(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 19, color: MUTED, italics: true })],
  });
}

function label(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 40 },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 17, color: ACCENT }),
    ],
  });
}

function body(text: string): Paragraph[] {
  // Split author line breaks into separate paragraphs.
  return (text ?? "")
    .split(/\n+/)
    .filter((l) => l.trim().length > 0)
    .map(
      (l) =>
        new Paragraph({
          spacing: { after: 120, line: 300 },
          children: [new TextRun({ text: l, size: 22, color: "15171C" })],
        })
    );
}

function divider(): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "E7E9EE", space: 1 },
    },
    children: [],
  });
}

export async function renderFile3Docx(pack: AssetPack): Promise<Buffer> {
  const { meta, file3 } = pack;
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: "CLIENT ACQUISITION INFRASTRUCTURE",
          size: 16,
          color: ACCENT,
          bold: true,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 80 },
      children: [new TextRun({ text: "Email Nurture System", bold: true, size: 44 })],
    })
  );
  children.push(
    metaLine(
      `${meta.businessName}${meta.city ? ` · ${meta.city}` : ""}${
        meta.industry ? ` · ${meta.industry}` : ""
      }`
    )
  );
  children.push(metaLine(`7-day sequence · Data confidence: ${meta.dataConfidence.toUpperCase()}`));

  const framing = file3.framing;
  if (framing?.overview) {
    children.push(heading("Overview"));
    children.push(...body(framing.overview));
  }

  if (meta.assumptions.length) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 160 },
        shading: { type: "clear", fill: "FFF8EC" },
        children: [
          new TextRun({ text: "Methodology note. ", bold: true, size: 18, color: "7A4D05" }),
          new TextRun({ text: meta.assumptions.join(" "), size: 18, color: "7A4D05" }),
        ],
      })
    );
  }

  children.push(divider());

  (file3.emails ?? []).forEach((e, idx) => {
    children.push(heading(`Email ${e.day} — ${e.purpose}`));
    children.push(metaLine(`Send: ${e.timing}`));
    children.push(label("Subject line"));
    children.push(...body(e.subject));
    children.push(label("A/B subject line"));
    children.push(...body(e.subjectB));
    children.push(label("Preview text"));
    children.push(...body(e.previewText));
    children.push(label("Email body"));
    children.push(...body(e.body));
    children.push(label("Call to action"));
    children.push(...body(e.cta));
    if (idx < (file3.emails?.length ?? 0) - 1) children.push(divider());
  });

  if (framing?.implementationGuide?.length || framing?.expectedImpact) {
    children.push(divider());
    children.push(heading("Implementation Guide & Expected Impact"));
    if (framing.implementationGuide?.length) {
      children.push(label("Implementation guide"));
      framing.implementationGuide.forEach((step, i) =>
        children.push(...body(`${i + 1}. ${step}`))
      );
    }
    if (framing.expectedImpact) {
      children.push(label("Expected impact"));
      children.push(...body(framing.expectedImpact));
    }
  }

  children.push(divider());
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${meta.businessName} · ${new Date(meta.generatedAt).toLocaleDateString()}`,
          size: 16,
          color: MUTED,
        }),
      ],
    })
  );

  const doc = new Document({
    title: `Email Nurture System — ${meta.businessName}`,
    sections: [
      {
        properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
