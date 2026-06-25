import type { ReportFacts, ReportMetric, ReportSection } from "@/lib/reporting/report-context";

export interface ReportNarrative {
  title: string;
  subtitle: string;
  executiveSummary: string;
  keyFindings: string[];
  recommendations: string[];
  risks: string[];
  metrics: ReportMetric[];
  sections: ReportSection[];
  evidenceWarnings: string[];
  sourceNotes: string[];
}

export interface NarrativeResult {
  narrative: ReportNarrative;
  model: string;
  usedOpenAi: boolean;
  warning?: string;
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function compactFacts(facts: ReportFacts): string {
  return JSON.stringify({
    title: facts.title,
    subtitle: facts.subtitle,
    generatedAt: facts.generatedAt,
    totals: facts.totals,
    metrics: facts.metrics,
    sections: facts.sections,
    sourceCount: facts.sources.length,
  }).slice(0, 22000);
}

function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function safeJsonParse(raw: string): Partial<ReportNarrative> | null {
  const stripped = stripJsonFence(raw);
  try {
    return JSON.parse(stripped) as Partial<ReportNarrative>;
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1)) as Partial<ReportNarrative>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function buildFallbackNarrative(facts: ReportFacts): ReportNarrative {
  const bankingVariance = facts.totals.bankingVariance ?? 0;
  const tankVariance = facts.totals.tankVarianceLitres ?? 0;
  const warnings: string[] = [];

  if (facts.totals.sessionCount === 0) warnings.push("No daily sessions were found for this report period.");
  if (Math.abs(bankingVariance) > 0.01) warnings.push(`Banking variance requires review: ${bankingVariance}.`);
  if (Math.abs(tankVariance) > 0.01) warnings.push(`Tank variance requires review: ${tankVariance} litres.`);
  if ((facts.totals.waterDetections ?? 0) > 0) warnings.push("One or more water detections were recorded.");

  return {
    title: facts.title,
    subtitle: facts.subtitle,
    executiveSummary:
      facts.totals.sessionCount === 0
        ? "No operational records were available for the selected scope and period."
        : "This report was generated from tenant-scoped FuelStation OS operational records. All financial and stock figures are deterministic calculations from the database.",
    keyFindings: facts.metrics.map((metric) => `${metric.label}: ${metric.value}${metric.note ? ` (${metric.note})` : ""}`).slice(0, 6),
    recommendations: warnings.length
      ? ["Review the highlighted variances against source records before approving the period.", "Confirm supporting evidence for banking, tank dipping, and debtor payment entries."]
      : ["No critical deterministic exception was detected in the selected report scope."],
    risks: warnings.length ? warnings : ["Report quality depends on complete daily session, dipping, banking, and debtor entries."],
    metrics: facts.metrics,
    sections: facts.sections,
    evidenceWarnings: facts.sources.length === 0 ? ["No source daily sessions were available for the selected scope."] : [],
    sourceNotes: [`${facts.sources.length} daily session source record(s) used.`],
  };
}

export async function buildReportNarrative(facts: ReportFacts, includeAiCommentary: boolean): Promise<NarrativeResult> {
  const fallback = buildFallbackNarrative(facts);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_REPORT_MODEL;

  if (!includeAiCommentary || !apiKey || !model) {
    return {
      narrative: fallback,
      model: includeAiCommentary ? "deterministic-fallback-openai-not-configured" : "deterministic-fallback",
      usedOpenAi: false,
      warning: includeAiCommentary && (!apiKey || !model) ? "OpenAI reporting is not configured." : undefined,
    };
  }

  const prompt = `You are the FuelStation OS report composer.
Create concise owner-ready operational commentary from the supplied structured facts.
Do not invent figures, dates, stations, products, or causes.
Use the supplied metrics exactly for numbers. If evidence is missing, say so.
Return JSON only with this schema:
{
  "title": "report title",
  "subtitle": "company, station scope, and date range",
  "executiveSummary": "short paragraph",
  "keyFindings": ["finding"],
  "recommendations": ["recommendation"],
  "risks": ["risk"],
  "evidenceWarnings": ["warning"],
  "sourceNotes": ["source note"]
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: compactFacts(facts) },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI report request failed with HTTP ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const parsed = safeJsonParse(json.choices?.[0]?.message?.content ?? "");

    if (!parsed) throw new Error("OpenAI returned non-JSON report commentary.");

    return {
      narrative: {
        ...fallback,
        ...parsed,
        keyFindings: asArray(parsed.keyFindings).length ? asArray(parsed.keyFindings) : fallback.keyFindings,
        recommendations: asArray(parsed.recommendations).length ? asArray(parsed.recommendations) : fallback.recommendations,
        risks: asArray(parsed.risks).length ? asArray(parsed.risks) : fallback.risks,
        evidenceWarnings: asArray(parsed.evidenceWarnings),
        sourceNotes: asArray(parsed.sourceNotes).length ? asArray(parsed.sourceNotes) : fallback.sourceNotes,
        metrics: fallback.metrics,
        sections: fallback.sections,
      },
      model,
      usedOpenAi: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI report narrative failed.";
    return {
      narrative: {
        ...fallback,
        evidenceWarnings: [...fallback.evidenceWarnings, message],
      },
      model,
      usedOpenAi: false,
      warning: message,
    };
  }
}
