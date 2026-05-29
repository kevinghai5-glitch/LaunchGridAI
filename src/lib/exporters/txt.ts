// Plain-text deliverable builder (File 4 — SMS follow-up system).
// Clean, copy-paste-ready formatting for pasting into HighLevel, Podium,
// SimpleTexting, Twilio, etc.

import type { AssetPack } from "@/types";

const RULE = "==================================================";
const THIN = "--------------------------------------------------";

export function renderFile4Txt(pack: AssetPack): string {
  const { meta, file4 } = pack;
  const lines: string[] = [];

  lines.push(RULE);
  lines.push("SMS FOLLOW-UP SYSTEM");
  lines.push(`${meta.businessName}${meta.city ? ` — ${meta.city}` : ""}`);
  lines.push(RULE);
  lines.push("");
  lines.push(
    "Copy each message into your SMS platform (HighLevel, Podium, SimpleTexting,"
  );
  lines.push("Twilio, etc.). Timing is measured from the lead opting in / inquiring.");
  lines.push("");

  const framing = file4.framing;
  if (framing?.overview) {
    lines.push("OVERVIEW");
    lines.push(framing.overview);
    lines.push("");
  }

  if (meta.assumptions.length) {
    lines.push("NOTE:");
    meta.assumptions.forEach((a) => lines.push(`  - ${a}`));
    lines.push("");
  }

  (file4.messages ?? []).forEach((m) => {
    lines.push(THIN);
    lines.push(`MESSAGE ${m.order}  |  SEND: ${m.timing}  |  ${m.charCount} chars`);
    lines.push(THIN);
    lines.push("");
    lines.push(m.message);
    lines.push("");
    lines.push(`Psychology : ${m.psychology}`);
    lines.push(`On reply   : ${m.replyStrategy}`);
    lines.push("");
  });

  if (framing?.implementationGuide?.length || framing?.expectedImpact) {
    lines.push(THIN);
    lines.push("IMPLEMENTATION GUIDE & EXPECTED IMPACT");
    lines.push(THIN);
    lines.push("");
    if (framing.implementationGuide?.length) {
      framing.implementationGuide.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
      lines.push("");
    }
    if (framing.expectedImpact) {
      lines.push(`Expected impact: ${framing.expectedImpact}`);
      lines.push("");
    }
  }

  lines.push(RULE);
  lines.push(`${meta.businessName} · ${new Date(meta.generatedAt).toLocaleDateString()}`);
  lines.push(RULE);

  return lines.join("\n");
}
