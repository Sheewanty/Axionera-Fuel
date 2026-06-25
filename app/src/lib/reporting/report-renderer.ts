import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import pptxgen from "pptxgenjs";
import type { ReportFacts, ReportMetric, ReportSection } from "@/lib/reporting/report-context";
import type { ReportNarrative } from "@/lib/reporting/report-narrative";
import type { ReportFormat } from "@/lib/reporting/report-templates";

const AX = {
  blue: "162750",
  gold: "966C44",
  white: "FFFFFF",
  grey: "64748B",
  border: "CBD5E1",
  surface: "F8FAFC",
  green: "15803D",
  amber: "D97706",
  red: "B91C1C",
};

export interface ReportArtifactMeta {
  format: ReportFormat;
  filePath: string;
  fileSize: number;
  checksum: string;
}

function reportRoot(): string {
  return process.env.REPORT_OUTPUT_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "generated-reports");
}

function safeFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "report";
}

function compact(value: string, max = 260): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function pdfColor(hex: string): string {
  return `#${hex}`;
}

async function artifactMeta(filePath: string, format: ReportFormat): Promise<ReportArtifactMeta> {
  const [stat, buffer] = await Promise.all([fsp.stat(filePath), fsp.readFile(filePath)]);
  return {
    format,
    filePath,
    fileSize: stat.size,
    checksum: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

function metricColor(status?: ReportMetric["status"]): string {
  if (status === "positive") return AX.green;
  if (status === "warning") return AX.amber;
  if (status === "critical") return AX.red;
  return AX.blue;
}

function drawPdfHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string): void {
  doc.rect(0, 0, doc.page.width, 42).fill(pdfColor(AX.blue));
  doc.fillColor(pdfColor(AX.gold)).font("Helvetica-Bold").fontSize(9).text("FUELSTATION OS", 42, 16, { characterSpacing: 1.1 });
  doc.fillColor(pdfColor(AX.blue)).font("Helvetica-Bold").fontSize(18).text(title, 42, 66, { width: 500 });
  doc.fillColor(pdfColor(AX.grey)).font("Helvetica").fontSize(9).text(subtitle, 42, 92, { width: 500 });
  doc.moveTo(42, 116).lineTo(doc.page.width - 42, 116).strokeColor(pdfColor(AX.border)).lineWidth(1).stroke();
  doc.y = 140;
}

function ensurePdfSpace(doc: PDFKit.PDFDocument, needed: number, title: string, subtitle: string): void {
  if (doc.y + needed < doc.page.height - doc.page.margins.bottom) return;
  doc.addPage();
  drawPdfHeader(doc, title, subtitle);
}

function drawPdfMetric(doc: PDFKit.PDFDocument, metric: ReportMetric, x: number, y: number, w: number): void {
  doc.roundedRect(x, y, w, 62, 5).fillAndStroke(pdfColor(AX.surface), pdfColor(AX.border));
  doc.fillColor(pdfColor(AX.grey)).font("Helvetica-Bold").fontSize(7).text(metric.label.toUpperCase(), x + 8, y + 9, { width: w - 16 });
  doc.fillColor(pdfColor(metricColor(metric.status))).font("Helvetica-Bold").fontSize(13).text(metric.value, x + 8, y + 25, { width: w - 16 });
  doc.fillColor(pdfColor(AX.grey)).font("Helvetica").fontSize(7).text(metric.note || "", x + 8, y + 45, { width: w - 16 });
}

function drawPdfMetrics(doc: PDFKit.PDFDocument, metrics: ReportMetric[], title: string, subtitle: string): void {
  ensurePdfSpace(doc, 150, title, subtitle);
  const startY = doc.y;
  const w = 156;
  metrics.slice(0, 6).forEach((metric, index) => {
    const x = 42 + (index % 3) * (w + 16);
    const y = startY + Math.floor(index / 3) * 76;
    drawPdfMetric(doc, metric, x, y, w);
  });
  doc.y = startY + Math.ceil(Math.min(metrics.length, 6) / 3) * 76 + 18;
}

function drawPdfBullets(doc: PDFKit.PDFDocument, bullets: string[], title: string, subtitle: string): void {
  for (const bullet of bullets.slice(0, 10)) {
    ensurePdfSpace(doc, 36, title, subtitle);
    const y = doc.y;
    doc.fillColor(pdfColor(AX.gold)).font("Helvetica-Bold").fontSize(9).text("-", 52, y);
    doc.fillColor(pdfColor(AX.blue)).font("Helvetica").fontSize(9).text(compact(bullet, 240), 66, y, { width: 460, lineGap: 2 });
    doc.moveDown(0.45);
  }
}

function drawPdfSection(doc: PDFKit.PDFDocument, section: ReportSection, reportTitle: string, subtitle: string): void {
  ensurePdfSpace(doc, 110, reportTitle, subtitle);
  doc.fillColor(pdfColor(AX.blue)).font("Helvetica-Bold").fontSize(13).text(section.title, { width: 500 });
  doc.moveDown(0.35);
  doc.fillColor(pdfColor(AX.blue)).font("Helvetica").fontSize(9.5).text(compact(section.body, 900), { width: 500, lineGap: 2 });
  doc.moveDown(0.45);
  drawPdfBullets(doc, section.bullets, reportTitle, subtitle);
  if (section.metrics.length) {
    doc.moveDown(0.3);
    drawPdfMetrics(doc, section.metrics, reportTitle, subtitle);
  }
}

async function renderPdf(reportId: string, tenantId: string, narrative: ReportNarrative, facts: ReportFacts): Promise<ReportArtifactMeta> {
  const outDir = path.join(reportRoot(), safeFilePart(tenantId), reportId);
  await fsp.mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, `${safeFilePart(narrative.title)}.pdf`);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 54, bottom: 48, left: 42, right: 42 },
      info: { Title: narrative.title, Author: "FuelStation OS" },
    });
    const stream = fs.createWriteStream(filePath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill(pdfColor(AX.blue));
    doc.rect(0, doc.page.height - 54, doc.page.width, 54).fill(pdfColor(AX.gold));
    doc.fillColor(pdfColor(AX.gold)).font("Helvetica-Bold").fontSize(10).text("FUELSTATION OS", 42, 34, { characterSpacing: 1.2 });
    doc.fillColor(pdfColor(AX.white)).font("Helvetica-Bold").fontSize(25).text(narrative.title, 42, 150, { width: 500 });
    doc.fillColor(pdfColor(AX.white)).font("Helvetica").fontSize(10).text(narrative.subtitle, 42, 218, { width: 500 });
    doc.fillColor(pdfColor(AX.white)).fontSize(8).text(`Generated ${new Date(facts.generatedAt).toLocaleString("en-GB")}`, 42, 246);

    doc.addPage();
    drawPdfHeader(doc, "Executive Summary", narrative.subtitle);
    doc.fillColor(pdfColor(AX.blue)).font("Helvetica").fontSize(10.5).text(narrative.executiveSummary, { width: 500, lineGap: 3 });
    doc.moveDown(0.8);
    drawPdfMetrics(doc, narrative.metrics, narrative.title, narrative.subtitle);

    doc.fillColor(pdfColor(AX.blue)).font("Helvetica-Bold").fontSize(13).text("Key Findings");
    doc.moveDown(0.3);
    drawPdfBullets(doc, narrative.keyFindings, narrative.title, narrative.subtitle);

    doc.moveDown(0.4);
    doc.fillColor(pdfColor(AX.blue)).font("Helvetica-Bold").fontSize(13).text("Recommendations");
    doc.moveDown(0.3);
    drawPdfBullets(doc, narrative.recommendations, narrative.title, narrative.subtitle);

    for (const section of narrative.sections.slice(0, 8)) {
      drawPdfSection(doc, section, narrative.title, narrative.subtitle);
    }

    doc.addPage();
    drawPdfHeader(doc, "Evidence Notes", narrative.subtitle);
    drawPdfBullets(doc, [...narrative.sourceNotes, ...narrative.evidenceWarnings], narrative.title, narrative.subtitle);

    doc.end();
  });

  return artifactMeta(filePath, "PDF");
}

function addPptHeader(slide: pptxgen.Slide, title: string, subtitle: string): void {
  slide.background = { color: AX.white };
  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.54, fill: { color: AX.blue }, line: { color: AX.blue } });
  slide.addText("FUELSTATION OS", { x: 0.42, y: 0.16, w: 2.4, h: 0.2, fontFace: "Inter", fontSize: 8.5, bold: true, color: AX.white });
  slide.addText(title, { x: 0.42, y: 0.82, w: 8.8, h: 0.38, fontFace: "Inter", fontSize: 21, bold: true, color: AX.blue, margin: 0, fit: "shrink" });
  slide.addText(subtitle, { x: 0.42, y: 1.22, w: 8.8, h: 0.24, fontFace: "Inter", fontSize: 9, color: AX.grey, margin: 0, fit: "shrink" });
  slide.addShape("line", { x: 0.42, y: 1.58, w: 12.45, h: 0, line: { color: AX.border, width: 1 } });
}

function addPptMetric(slide: pptxgen.Slide, metric: ReportMetric, x: number, y: number, w: number, h: number): void {
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.08, fill: { color: AX.surface }, line: { color: AX.border, width: 1 } });
  slide.addText(metric.label.toUpperCase(), { x: x + 0.14, y: y + 0.12, w: w - 0.28, h: 0.18, fontFace: "Inter", fontSize: 7.2, bold: true, color: AX.grey, margin: 0, fit: "shrink" });
  slide.addText(metric.value, { x: x + 0.14, y: y + 0.35, w: w - 0.28, h: 0.28, fontFace: "Inter", fontSize: 13, bold: true, color: metricColor(metric.status), margin: 0, fit: "shrink" });
  slide.addText(metric.note || "", { x: x + 0.14, y: y + 0.72, w: w - 0.28, h: h - 0.82, fontFace: "Inter", fontSize: 7.2, color: AX.grey, margin: 0, fit: "shrink" });
}

function addPptBullets(slide: pptxgen.Slide, bullets: string[], x: number, y: number, w: number, h: number): void {
  const values = bullets.slice(0, 7).map((item) => ({
    text: compact(item, 145),
    options: { bullet: { indent: 12 }, hanging: 4 },
  }));

  if (values.length === 0) {
    slide.addText("No notes recorded.", { x, y, w, h, fontFace: "Inter", fontSize: 9, color: AX.grey, margin: 0 });
    return;
  }

  slide.addText(values, { x, y, w, h, fontFace: "Inter", fontSize: 9.5, color: AX.blue, fit: "shrink", valign: "top" });
}

async function renderPptx(reportId: string, tenantId: string, narrative: ReportNarrative, facts: ReportFacts): Promise<ReportArtifactMeta> {
  const outDir = path.join(reportRoot(), safeFilePart(tenantId), reportId);
  await fsp.mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, `${safeFilePart(narrative.title)}.pptx`);

  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "FuelStation OS";
  pptx.company = "Axionera Global Limited";
  pptx.subject = narrative.title;
  pptx.title = narrative.title;
  pptx.theme = { headFontFace: "Inter", bodyFontFace: "Inter" };

  const cover = pptx.addSlide();
  cover.background = { color: AX.blue };
  cover.addShape("rect", { x: 0, y: 6.82, w: 13.333, h: 0.68, fill: { color: AX.gold }, line: { color: AX.gold } });
  cover.addText("FUELSTATION OS", { x: 0.68, y: 0.72, w: 2.8, h: 0.28, fontFace: "Inter", fontSize: 9, bold: true, color: AX.gold, margin: 0 });
  cover.addText(narrative.title, { x: 0.68, y: 2.05, w: 8.6, h: 1.05, fontFace: "Inter", fontSize: 31, bold: true, color: AX.white, margin: 0, fit: "shrink" });
  cover.addText(narrative.subtitle, { x: 0.7, y: 3.28, w: 8.3, h: 0.35, fontFace: "Inter", fontSize: 12, color: AX.white, margin: 0, fit: "shrink" });
  cover.addText(`Generated ${new Date(facts.generatedAt).toLocaleString("en-GB")}`, { x: 0.7, y: 5.95, w: 4.8, h: 0.24, fontFace: "Inter", fontSize: 8.5, color: AX.white, margin: 0 });

  const summary = pptx.addSlide();
  addPptHeader(summary, "Executive Summary", narrative.subtitle);
  summary.addText(compact(narrative.executiveSummary, 1000), { x: 0.58, y: 1.92, w: 5.9, h: 1.35, fontFace: "Inter", fontSize: 12.5, color: AX.blue, margin: 0, valign: "top", fit: "shrink" });
  summary.addText("Key Findings", { x: 7.05, y: 1.9, w: 2.4, h: 0.25, fontFace: "Inter", fontSize: 12, bold: true, color: AX.blue, margin: 0 });
  addPptBullets(summary, narrative.keyFindings, 7.06, 2.28, 5.55, 2.1);
  narrative.metrics.slice(0, 6).forEach((metric, index) => addPptMetric(summary, metric, 0.58 + (index % 3) * 4.06, 4.36 + Math.floor(index / 3) * 1.04, 3.62, 0.88));

  for (const [index, section] of narrative.sections.slice(0, 8).entries()) {
    const slide = pptx.addSlide();
    addPptHeader(slide, section.title || `Section ${index + 1}`, narrative.subtitle);
    slide.addText(compact(section.body, 900), { x: 0.58, y: 1.86, w: 5.55, h: 1.25, fontFace: "Inter", fontSize: 11.2, color: AX.blue, margin: 0, fit: "shrink", valign: "top" });
    addPptBullets(slide, section.bullets, 6.48, 1.86, 5.9, 2.25);
    section.metrics.slice(0, 4).forEach((metric, metricIndex) => addPptMetric(slide, metric, 0.58 + metricIndex * 3.03, 4.55, 2.72, 0.95));
  }

  const evidence = pptx.addSlide();
  addPptHeader(evidence, "Evidence Notes", narrative.subtitle);
  addPptBullets(evidence, [...narrative.sourceNotes, ...narrative.evidenceWarnings], 0.7, 1.9, 11.7, 4.3);

  await pptx.writeFile({ fileName: filePath });
  return artifactMeta(filePath, "PPTX");
}

export async function renderReportArtifacts(input: {
  reportId: string;
  tenantId: string;
  narrative: ReportNarrative;
  facts: ReportFacts;
  formats: ReportFormat[];
}): Promise<ReportArtifactMeta[]> {
  const artifacts: ReportArtifactMeta[] = [];
  for (const format of input.formats) {
    if (format === "PDF") artifacts.push(await renderPdf(input.reportId, input.tenantId, input.narrative, input.facts));
    if (format === "PPTX") artifacts.push(await renderPptx(input.reportId, input.tenantId, input.narrative, input.facts));
  }
  return artifacts;
}
