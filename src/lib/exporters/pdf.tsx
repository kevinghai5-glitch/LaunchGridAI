// PDF deliverable builder (File 2 — lead qualification system).
// Uses @react-pdf/renderer for real, paginated PDF output with headings and
// spacing — no headless browser, works in serverless/Node.

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { AssetPack, LeadQualificationFile, DeliverableFraming } from "@/types";

const ACCENT = "#1F5FFF";
const INK = "#15171C";
const MUTED = "#5B6472";
const SOFT = "#8A93A2";
const LINE = "#E7E9EE";
const ACCENT_SOFT = "#EEF3FF";

const s = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 54, paddingHorizontal: 52, fontSize: 10.5, color: INK, lineHeight: 1.5, fontFamily: "Helvetica" },
  eyebrow: { fontSize: 8.5, color: ACCENT, letterSpacing: 1.5, fontFamily: "Helvetica-Bold" },
  h1: { fontSize: 22, marginTop: 6, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 10, color: MUTED, marginTop: 4, marginBottom: 4 },
  badge: { fontSize: 8.5, color: MUTED, marginBottom: 14 },
  note: { backgroundColor: "#FFF8EC", borderColor: "#F5D9A8", borderWidth: 1, borderRadius: 6, padding: 8, fontSize: 8.5, color: "#7A4D05", marginBottom: 16 },
  secNum: { fontSize: 8.5, color: SOFT, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 13, marginTop: 16, marginBottom: 7, fontFamily: "Helvetica-Bold" },
  p: { marginBottom: 6 },
  label: { fontSize: 8, color: SOFT, letterSpacing: 0.7, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 },
  card: { backgroundColor: "#F6F7F9", borderColor: LINE, borderWidth: 1, borderRadius: 6, padding: 9, marginBottom: 7 },
  qTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  kv: { flexDirection: "row", marginBottom: 2 },
  kvKey: { width: 78, color: MUTED, fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  kvVal: { flex: 1, fontSize: 9 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  th: { backgroundColor: ACCENT_SOFT, color: "#1A3A8A", fontFamily: "Helvetica-Bold", fontSize: 8.5, padding: 6 },
  td: { padding: 6, fontSize: 9 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  dot: { width: 10, fontFamily: "Helvetica-Bold", color: ACCENT },
  num: { width: 16, fontFamily: "Helvetica-Bold", color: ACCENT, fontSize: 9 },
  footer: { position: "absolute", bottom: 26, left: 52, right: 52, textAlign: "center", color: SOFT, fontSize: 8 },
  frame: { backgroundColor: ACCENT_SOFT, borderLeftWidth: 3, borderLeftColor: ACCENT, borderRadius: 4, padding: 9, marginBottom: 7, fontSize: 9.5 },
});

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <View wrap={false}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Text style={s.h2}>{title}</Text>
        <Text style={s.secNum}>{num.toString().padStart(2, "0")}</Text>
      </View>
      {children}
    </View>
  );
}

function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <View>
      {items.map((it, i) => (
        <View style={s.bullet} key={i}>
          <Text style={s.dot}>•</Text>
          <Text style={{ flex: 1 }}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

function Numbered({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <View>
      {items.map((it, i) => (
        <View style={s.bullet} key={i}>
          <Text style={s.num}>{i + 1}.</Text>
          <Text style={{ flex: 1 }}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

function LeadDoc({ pack }: { pack: AssetPack }) {
  const f: LeadQualificationFile = pack.file2;
  const { meta } = pack;
  const framing: DeliverableFraming | undefined = f.framing;
  let n = 0;
  const next = () => ++n;
  return (
    <Document title={`Lead Qualification System — ${meta.businessName}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>CLIENT ACQUISITION INFRASTRUCTURE</Text>
        <Text style={s.h1}>Lead Qualification System</Text>
        <Text style={s.meta}>
          {meta.businessName}
          {meta.city ? ` · ${meta.city}` : ""}
          {meta.industry ? ` · ${meta.industry}` : ""}
        </Text>
        <Text style={s.badge}>Data confidence: {meta.dataConfidence.toUpperCase()}</Text>

        {meta.assumptions.length > 0 && (
          <Text style={s.note}>Methodology note. {meta.assumptions.join(" ")}</Text>
        )}

        {framing?.overview ? (
          <Section num={next()} title="Overview">
            <Text style={s.frame}>{framing.overview}</Text>
          </Section>
        ) : null}

        <Section num={next()} title="Intake Form">
          <Text style={[s.qTitle, { fontSize: 13 }]}>{f.formHeadline}</Text>
          <Text style={s.p}>{f.formSubheadline}</Text>
        </Section>

        <Section num={next()} title="Intake Questions">
          {(f.questions ?? []).map((q, i) => (
            <View style={s.card} key={i} wrap={false}>
              <Text style={s.qTitle}>
                {i + 1}. {q.question}
              </Text>
              <View style={s.kv}>
                <Text style={s.kvKey}>Input</Text>
                <Text style={s.kvVal}>{q.inputType}</Text>
              </View>
              {q.options?.length > 0 && (
                <View style={s.kv}>
                  <Text style={s.kvKey}>Options</Text>
                  <Text style={s.kvVal}>{q.options.join(" · ")}</Text>
                </View>
              )}
              <View style={s.kv}>
                <Text style={s.kvKey}>Purpose</Text>
                <Text style={s.kvVal}>{q.purpose}</Text>
              </View>
              <View style={s.kv}>
                <Text style={s.kvKey}>Scoring</Text>
                <Text style={s.kvVal}>{q.scoringImpact}</Text>
              </View>
            </View>
          ))}
        </Section>

        <Section num={next()} title="Lead Scoring Rubric">
          <Text style={s.label}>Rubric</Text>
          <Text style={s.p}>{f.leadScoring?.rubric}</Text>
          <Text style={s.label}>Hot lead</Text>
          <Text style={s.p}>{f.leadScoring?.hot}</Text>
          <Text style={s.label}>Warm lead</Text>
          <Text style={s.p}>{f.leadScoring?.warm}</Text>
          <Text style={s.label}>Cold / nurture lead</Text>
          <Text style={s.p}>{f.leadScoring?.cold}</Text>
        </Section>

        <Section num={next()} title="Routing Logic">
          <View style={[s.row, { borderTopWidth: 1, borderTopColor: LINE }]}>
            <Text style={[s.th, { width: 70 }]}>Tier</Text>
            <Text style={[s.th, { flex: 1 }]}>Action</Text>
            <Text style={[s.th, { width: 110 }]}>Timing</Text>
          </View>
          {(f.routingLogic ?? []).map((r, i) => (
            <View style={s.row} key={i}>
              <Text style={[s.td, { width: 70, fontFamily: "Helvetica-Bold" }]}>{r.tier}</Text>
              <Text style={[s.td, { flex: 1 }]}>{r.action}</Text>
              <Text style={[s.td, { width: 110 }]}>{r.timing}</Text>
            </View>
          ))}
        </Section>

        <Section num={next()} title="Automation Workflow">
          <Numbered items={f.automationWorkflow} />
        </Section>

        <Section num={next()} title="Thank-You Page">
          <Text style={s.p}>{f.thankYouPage}</Text>
        </Section>

        <Section num={next()} title="CRM Field Recommendations">
          <Bullets items={f.crmFields} />
        </Section>

        <Section num={next()} title="Follow-Up Timing">
          <Text style={s.p}>{f.followUpTiming}</Text>
        </Section>

        <Section num={next()} title="Implementation Instructions">
          <Numbered items={f.implementation} />
        </Section>

        {framing?.implementationGuide?.length || framing?.expectedImpact ? (
          <Section num={next()} title="Implementation Guide & Expected Impact">
            {framing.implementationGuide?.length ? (
              <>
                <Text style={s.label}>Implementation guide</Text>
                <Numbered items={framing.implementationGuide} />
              </>
            ) : null}
            {framing.expectedImpact ? (
              <>
                <Text style={s.label}>Expected impact</Text>
                <Text style={s.frame}>{framing.expectedImpact}</Text>
              </>
            ) : null}
          </Section>
        ) : null}

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `${meta.businessName}  ·  Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

export async function renderFile2Pdf(pack: AssetPack): Promise<Buffer> {
  return renderToBuffer(<LeadDoc pack={pack} />);
}
