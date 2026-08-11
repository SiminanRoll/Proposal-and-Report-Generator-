import { createReviewOutcomeItem, normalizeReviewOutcome, REVIEW_DISPOSITION_OPTIONS } from "./model";
import type { ReviewDisposition, ReviewOutcome, ReviewOutcomeItem, ReviewOutcomeStatus } from "./types";

export interface TailoredReportPresentation {
  title: string;
  executiveSummary: string;
}

export interface AppliedTailoredReportPrompt {
  outcome: ReviewOutcome;
  presentation?: TailoredReportPresentation;
  appliedFields: string[];
  warnings: string[];
}

interface ParsedPrompt {
  status?: ReviewOutcomeStatus;
  reviewedAt?: string;
  reportTitle?: string;
  executiveSummary?: string;
  meetingSummary?: string;
  agreedNextStep?: string;
  items?: ReviewOutcomeItem[];
  warnings: string[];
}

const TOP_LEVEL_LABELS = [
  "plan status",
  "status",
  "review date",
  "reviewed at",
  "report title",
  "title",
  "executive summary",
  "summary framing",
  "meeting summary",
  "agreed next step",
  "next step",
];

const DECISION_LABELS = [
  "plan item",
  "title",
  "outcome",
  "disposition",
  "technical finding",
  "finding",
  "client-facing plan language",
  "client facing plan language",
  "client-facing plan",
  "client facing plan",
  "client-facing note",
  "client facing note",
  "responsible party",
  "owner",
  "target date or timing",
  "target timing",
  "target date",
  "timing",
  "internal note",
  "include in pdf",
  "include in report",
];

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function cleanPrompt(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json|text|markdown)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed)
    .replace(/^\s*TAILORED REPORT SUMMARY\s*\n/i, "")
    .trim();
}

function stringValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const result = String(value).trim();
  return result || undefined;
}

function booleanValue(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  const normalized = normalizeLabel(String(value ?? ""));
  if (["no", "false", "exclude", "excluded", "0"].includes(normalized)) return false;
  if (["yes", "true", "include", "included", "1"].includes(normalized)) return true;
  return fallback;
}

function statusValue(value: unknown): ReviewOutcomeStatus | undefined {
  const normalized = normalizeLabel(String(value ?? ""));
  if (["not reviewed", "not-reviewed", "none"].includes(normalized)) return "not-reviewed";
  if (["draft", "draft outcome", "working draft"].includes(normalized)) return "draft";
  if (["confirmed", "confirmed with client", "final", "agreed"].includes(normalized)) return "confirmed";
  return undefined;
}

function dispositionValue(value: unknown): ReviewDisposition {
  const normalized = normalizeLabel(String(value ?? ""));
  const direct = REVIEW_DISPOSITION_OPTIONS.find((option) => normalizeLabel(option.value) === normalized || normalizeLabel(option.label) === normalized);
  if (direct) return direct.value;

  const aliases: Array<[string[], ReviewDisposition]> = [
    [["replace", "advantage replacement", "advantage to replace"], "advantage-replace"],
    [["client purchased", "client already purchased", "client ordered", "client already ordered equipment"], "client-purchased"],
    [["install client purchased", "advantage install", "advantage to install client purchased equipment", "deploy client purchased"], "advantage-install-client-purchased"],
    [["upgrade", "upgrade only", "os upgrade"], "upgrade-only"],
    [["retire", "decommission", "retire and decommission"], "retire-decommission"],
    [["migrate and retire", "migration and retirement"], "migrate-retire"],
    [["monitor", "watch"], "monitor"],
    [["defer", "deferred", "future"], "deferred"],
    [["no action", "no action needed"], "no-action"],
    [["complete", "completed", "already completed"], "completed"],
    [["investigate", "needs further investigation", "follow up"], "investigate"],
  ];
  for (const [keys, disposition] of aliases) {
    if (keys.some((key) => normalized === normalizeLabel(key))) return disposition;
  }
  return "investigate";
}

function parseLabeledFields(block: string, labels: string[]): Map<string, string> {
  const recognized = new Set(labels.map(normalizeLabel));
  const values = new Map<string, string>();
  let activeLabel = "";
  let activeLines: string[] = [];

  function commit() {
    if (!activeLabel) return;
    const value = activeLines.join("\n").trim();
    if (value) values.set(activeLabel, value);
    activeLabel = "";
    activeLines = [];
  }

  for (const line of block.replace(/\r\n?/g, "\n").split("\n")) {
    const match = line.match(/^\s*([^:]{1,80}):\s*(.*)$/);
    const candidate = match ? normalizeLabel(match[1]) : "";
    if (match && recognized.has(candidate)) {
      commit();
      activeLabel = candidate;
      activeLines = match[2] ? [match[2]] : [];
      continue;
    }
    if (activeLabel) activeLines.push(line);
  }
  commit();
  return values;
}

function firstField(fields: Map<string, string>, names: string[]): string | undefined {
  for (const name of names) {
    const value = fields.get(normalizeLabel(name));
    if (value?.trim()) return value.trim();
  }
  return undefined;
}


const NATURAL_SECTION_LABELS = [
  "plan status",
  "status",
  "review date",
  "reviewed at",
  "report title",
  "title",
  "executive summary",
  "summary framing",
  "meeting summary",
  "agreed next step",
  "next step",
  "agreed decisions",
  "decisions",
];

function naturalHeading(line: string): string | undefined {
  const candidate = normalizeLabel(
    line
      .trim()
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*\*(.*?)\*\*$/, "$1")
      .replace(/:$/, ""),
  );
  return NATURAL_SECTION_LABELS.includes(candidate) ? candidate : undefined;
}

function parseNaturalSections(text: string): Map<string, string> {
  const values = new Map<string, string>();
  let activeLabel = "";
  let activeLines: string[] = [];

  function commit() {
    if (!activeLabel) return;
    const value = activeLines.join("\n").trim();
    if (value) values.set(activeLabel, value);
    activeLabel = "";
    activeLines = [];
  }

  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = naturalHeading(line);
    if (heading) {
      commit();
      activeLabel = heading;
      continue;
    }
    if (activeLabel) activeLines.push(line);
  }
  commit();
  return values;
}

function inferNaturalDisposition(title: string, detail: string): ReviewDisposition {
  const normalized = normalizeLabel(`${title} ${detail}`);
  if (/\b(migrate|migration)\b/.test(normalized) && /\b(retire|retirement|decommission)\b/.test(normalized)) return "migrate-retire";
  if (/\b(retire|retirement|decommission)\b/.test(normalized)) return "retire-decommission";
  if (/\b(install|deploy|deployment|setup|set up)\b/.test(normalized) && /\b(client purchased|client-purchased|already purchased|already ordered|ordered|new computers?|dell computers?|equipment)\b/.test(normalized)) return "advantage-install-client-purchased";
  if (/\b(client purchased|client-purchased|already purchased|already ordered|ordered equipment)\b/.test(normalized)) return "client-purchased";
  if (/\b(no action|nothing further)\b/.test(normalized)) return "no-action";
  if (/\b(already completed|completed already|is complete|has been completed)\b/.test(normalized)) return "completed";
  if (/\b(defer|deferred|later phase|future phase)\b/.test(normalized)) return "deferred";
  if (/\b(monitor|continue monitoring|watch)\b/.test(normalized)) return "monitor";
  if (/\b(upgrade|update operating system|os upgrade)\b/.test(normalized)) return "upgrade-only";
  if (/\b(replace|replacement|aging computers?|aging workstations?|lifecycle)\b/.test(normalized)) return "advantage-replace";
  return "investigate";
}

function splitNaturalDecisionHeading(value: string): { title: string; detail?: string } {
  const unwrapped = value.replace(/^\*\*(.*?)\*\*$/, "$1").trim();
  const withoutDecisionLabel = unwrapped.replace(/^\s*(?:\*\*)?decision\s*:(?:\*\*)?\s*/i, "").trim();
  const inlineDetail = withoutDecisionLabel.match(/^([\s\S]*?)\s+(?:\*\*)?supporting\s+detail\s*:(?:\*\*)?\s*([\s\S]+)$/i);
  if (inlineDetail) {
    return { title: inlineDetail[1].trim(), detail: inlineDetail[2].trim() };
  }
  return { title: withoutDecisionLabel };
}

function stripNaturalSupportingDetailLabel(line: string): string {
  return line.replace(/^\s*(?:\*\*)?supporting\s+detail\s*:(?:\*\*)?\s*/i, "");
}

function parseNaturalDecisionList(block: string, warnings: string[]): ReviewOutcomeItem[] | undefined {
  const lines = block.replace(/\r\n?/g, "\n").split("\n");
  const decisions: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } | undefined;

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)[.)]\s+(.+?)\s*$/);
    if (match) {
      if (current) decisions.push(current);
      const parsedHeading = splitNaturalDecisionHeading(match[2]);
      current = {
        title: parsedHeading.title,
        lines: parsedHeading.detail ? [parsedHeading.detail] : [],
      };
      continue;
    }
    if (current) current.lines.push(stripNaturalSupportingDetailLabel(line));
  }
  if (current) decisions.push(current);
  if (!decisions.length) return undefined;

  return decisions.map((decision, index) => {
    const detail = decision.lines.join("\n").trim();
    const disposition = inferNaturalDisposition(decision.title, detail);
    const option = REVIEW_DISPOSITION_OPTIONS.find((candidate) => candidate.value === disposition);
    if (!detail) warnings.push(`Decision ${index + 1} did not include supporting detail.`);
    return createReviewOutcomeItem({
      title: decision.title || `Decision ${index + 1}`,
      technicalFinding: "",
      disposition,
      clientFacingNote: detail,
      responsibleParty: option?.defaultOwner ?? "",
      targetDate: option?.defaultTiming ?? "",
      internalNote: "",
      includeInReport: true,
    });
  });
}

function parseNaturalPrompt(text: string): ParsedPrompt | undefined {
  const fields = parseNaturalSections(text);
  if (!fields.size) return undefined;
  const warnings: string[] = [];
  const statusText = firstField(fields, ["plan status", "status"]);
  const status = statusText ? statusValue(statusText) : undefined;
  if (statusText && !status) warnings.push(`Plan status “${statusText}” was not recognized and was left unchanged.`);
  const decisionsBlock = firstField(fields, ["agreed decisions", "decisions"]);
  const items = decisionsBlock ? parseNaturalDecisionList(decisionsBlock, warnings) : undefined;

  return {
    status,
    reviewedAt: firstField(fields, ["review date", "reviewed at"]),
    reportTitle: firstField(fields, ["report title", "title"]),
    executiveSummary: firstField(fields, ["summary framing", "executive summary"]),
    meetingSummary: firstField(fields, ["meeting summary"]),
    agreedNextStep: firstField(fields, ["agreed next step", "next step"]),
    items,
    warnings,
  };
}

function parseDecisionBlock(block: string, index: number, warnings: string[]): ReviewOutcomeItem | undefined {
  const fields = parseLabeledFields(block, DECISION_LABELS);
  const title = firstField(fields, ["plan item", "title"]);
  const technicalFinding = firstField(fields, ["technical finding", "finding"]);
  const clientFacingNote = firstField(fields, ["client-facing plan language", "client facing plan language", "client-facing plan", "client facing plan", "client-facing note", "client facing note"]);
  const outcomeText = firstField(fields, ["outcome", "disposition"]);

  if (!title && !technicalFinding && !clientFacingNote && !outcomeText) {
    warnings.push(`Decision ${index + 1} did not contain recognized fields and was skipped.`);
    return undefined;
  }

  const disposition = dispositionValue(outcomeText);
  if (outcomeText && disposition === "investigate" && !["investigate", "needs further investigation", "follow up"].includes(normalizeLabel(outcomeText))) {
    warnings.push(`Decision ${index + 1} used an unfamiliar outcome (“${outcomeText}”), so it was set to Needs further investigation.`);
  }

  return createReviewOutcomeItem({
    title: title ?? `Decision ${index + 1}`,
    technicalFinding: technicalFinding ?? "",
    disposition,
    clientFacingNote: clientFacingNote ?? "",
    responsibleParty: firstField(fields, ["responsible party", "owner"]) ?? "",
    targetDate: firstField(fields, ["target date or timing", "target timing", "target date", "timing"]) ?? "",
    internalNote: firstField(fields, ["internal note"]) ?? "",
    includeInReport: booleanValue(firstField(fields, ["include in pdf", "include in report"]), true),
  });
}

function parseLabeledPrompt(text: string): ParsedPrompt {
  const warnings: string[] = [];
  const decisionPattern = /(?:^|\n)\s*DECISION(?:\s+\d+)?\s*\n([\s\S]*?)(?=(?:\n\s*END DECISION\s*(?:\n|$))|(?:\n\s*DECISION(?:\s+\d+)?\s*\n)|$)/gi;
  const decisionBlocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = decisionPattern.exec(text))) decisionBlocks.push(match[1]);
  const firstDecision = text.search(/(?:^|\n)\s*DECISION(?:\s+\d+)?\s*\n/i);
  const topBlock = firstDecision >= 0 ? text.slice(0, firstDecision) : text;
  const fields = parseLabeledFields(topBlock, TOP_LEVEL_LABELS);
  const statusText = firstField(fields, ["plan status", "status"]);
  const status = statusText ? statusValue(statusText) : undefined;
  if (statusText && !status) warnings.push(`Plan status “${statusText}” was not recognized and was left unchanged.`);

  return {
    status,
    reviewedAt: firstField(fields, ["review date", "reviewed at"]),
    reportTitle: firstField(fields, ["report title", "title"]),
    executiveSummary: firstField(fields, ["summary framing", "executive summary"]),
    meetingSummary: firstField(fields, ["meeting summary"]),
    agreedNextStep: firstField(fields, ["agreed next step", "next step"]),
    items: decisionBlocks.length ? decisionBlocks.map((block, index) => parseDecisionBlock(block, index, warnings)).filter((item): item is ReviewOutcomeItem => Boolean(item)) : undefined,
    warnings,
  };
}

function objectValue(source: Record<string, unknown>, names: string[]): unknown {
  const entries = new Map(Object.entries(source).map(([key, value]) => [normalizeLabel(key), value]));
  for (const name of names) {
    if (entries.has(normalizeLabel(name))) return entries.get(normalizeLabel(name));
  }
  return undefined;
}

function parseJsonPrompt(text: string): ParsedPrompt | undefined {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { return undefined; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const root = value as Record<string, unknown>;
  const reviewCandidate = objectValue(root, ["reviewOutcome", "review outcome"]);
  const review = reviewCandidate && typeof reviewCandidate === "object" && !Array.isArray(reviewCandidate) ? reviewCandidate as Record<string, unknown> : root;
  const decisionsValue = objectValue(review, ["decisions", "items", "roadmap items"]);
  const warnings: string[] = [];
  const items = Array.isArray(decisionsValue)
    ? decisionsValue.map((raw, index) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
          warnings.push(`Decision ${index + 1} was not an object and was skipped.`);
          return undefined;
        }
        const item = raw as Record<string, unknown>;
        const outcomeText = objectValue(item, ["outcome", "disposition"]);
        return createReviewOutcomeItem({
          title: stringValue(objectValue(item, ["planItem", "plan item", "title"])) ?? `Decision ${index + 1}`,
          technicalFinding: stringValue(objectValue(item, ["technicalFinding", "technical finding", "finding"])) ?? "",
          disposition: dispositionValue(outcomeText),
          clientFacingNote: stringValue(objectValue(item, ["clientFacingPlan", "client-facing plan", "clientFacingNote", "client-facing note"])) ?? "",
          responsibleParty: stringValue(objectValue(item, ["responsibleParty", "responsible party", "owner"])) ?? "",
          targetDate: stringValue(objectValue(item, ["targetTiming", "target timing", "targetDate", "target date", "timing"])) ?? "",
          internalNote: stringValue(objectValue(item, ["internalNote", "internal note"])) ?? "",
          includeInReport: booleanValue(objectValue(item, ["includeInPdf", "include in pdf", "includeInReport", "include in report"]), true),
        });
      }).filter((item): item is ReviewOutcomeItem => Boolean(item))
    : undefined;

  const statusText = objectValue(review, ["planStatus", "plan status", "status"]);
  const status = statusValue(statusText);
  if (statusText !== undefined && !status) warnings.push(`Plan status “${String(statusText)}” was not recognized and was left unchanged.`);

  return {
    status,
    reviewedAt: stringValue(objectValue(review, ["reviewDate", "review date", "reviewedAt", "reviewed at"])),
    reportTitle: stringValue(objectValue(review, ["reportTitle", "report title", "title"])),
    executiveSummary: stringValue(objectValue(review, ["summaryFraming", "summary framing", "executiveSummary", "executive summary"])),
    meetingSummary: stringValue(objectValue(review, ["meetingSummary", "meeting summary"])),
    agreedNextStep: stringValue(objectValue(review, ["agreedNextStep", "agreed next step", "nextStep", "next step"])),
    items,
    warnings,
  };
}

export function applyTailoredReportPrompt(
  text: string,
  currentOutcome: ReviewOutcome,
  currentPresentation?: TailoredReportPresentation,
): AppliedTailoredReportPrompt {
  const cleaned = cleanPrompt(text);
  if (!cleaned) throw new Error("Paste a tailored report summary before applying it.");
  const parsed = parseJsonPrompt(cleaned) ?? parseNaturalPrompt(cleaned) ?? parseLabeledPrompt(cleaned);
  const appliedFields: string[] = [];
  const patch: Partial<ReviewOutcome> = {};

  const assign = <K extends keyof ReviewOutcome>(key: K, value: ReviewOutcome[K] | undefined, label: string) => {
    if (value === undefined) return;
    patch[key] = value;
    appliedFields.push(label);
  };

  assign("status", parsed.status, "plan status");
  assign("reviewedAt", parsed.reviewedAt, "review date");
  assign("reportTitle", parsed.reportTitle, "report title");
  const summaryFraming = parsed.executiveSummary ?? parsed.meetingSummary;
  assign("executiveSummary", summaryFraming, "summary framing");
  assign("meetingSummary", parsed.meetingSummary, "meeting summary");
  assign("agreedNextStep", parsed.agreedNextStep, "agreed next step");
  assign("items", parsed.items, "agreed decisions");

  if (!appliedFields.length) {
    throw new Error("No recognized tailored-report fields were found. Use headings such as Meeting Summary, Agreed Next Step, and Agreed Decisions, or use the labeled Client Compass format.");
  }

  if (!patch.status && currentOutcome.status === "not-reviewed") patch.status = "draft";
  const outcome = normalizeReviewOutcome({ ...currentOutcome, ...patch });
  const presentation = currentPresentation
    ? {
        title: parsed.reportTitle ?? currentPresentation.title,
        executiveSummary: summaryFraming ?? currentPresentation.executiveSummary,
      }
    : undefined;

  return { outcome, presentation, appliedFields, warnings: parsed.warnings };
}
