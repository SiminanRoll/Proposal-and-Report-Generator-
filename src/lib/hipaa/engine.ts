import { HIPAA_QUESTIONS, HIPAA_QUESTION_SET_VERSION } from "./questions";
import type {
  ExtractedFact,
  HipaaAnswer,
  HipaaAssessment,
  HipaaEvidenceSource,
  HipaaQuestionDefinition,
  HipaaResponse,
  HipaaSafeguardCategory,
  HipaaScoreSummary,
  Project,
} from "@/lib/projects/types";

export const HIPAA_DISCLAIMER = "This Security Safeguards Review is a technology-focused conversation based on the client\u2019s responses and available evidence for services covered by Advantage Technologies. It is not legal advice, a formal audit, a risk analysis, certification, or a guarantee of HIPAA, PCI DSS, or other compliance. Each organization and its qualified advisers retain responsibility for applicable requirements, policies, training, data, and regulatory decisions. Recording a declined or externally planned service does not waive any legal obligation.";

const CATEGORY_ORDER: HipaaSafeguardCategory[] = [
  "Administrative Safeguards",
  "Technical Safeguards",
  "Physical Safeguards",
  "Organizational Requirements",
];

function now(): string { return new Date().toISOString(); }
function fact(project: Project, key: string): ExtractedFact | undefined { return project.intelligence.facts.find((item) => item.key === key); }
function numeric(project: Project, key: string): number {
  const value = fact(project, key)?.value;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace(/,/g, "")) || 0;
  return 0;
}
function sourceEvidence(project: Project, keys: string[]): { evidence: string; date: string; source: HipaaEvidenceSource; confidence: HipaaAnswer["confidence"] } {
  const matches = keys.map((key) => fact(project, key)).filter(Boolean) as ExtractedFact[];
  if (!matches.length) return { evidence: "", date: "", source: "Not yet verified", confidence: "low" };
  return {
    evidence: matches.map((item) => `${item.label}: ${Array.isArray(item.value) ? item.value.join(", ") : String(item.value)} (${item.evidence})`).join("\n"),
    date: project.intelligence.lastRunAt || now(),
    source: "Imported technical report",
    confidence: matches.every((item) => item.confidence === "high") ? "high" : "medium",
  };
}

function baseAnswer(question: HipaaQuestionDefinition): HipaaAnswer {
  return {
    questionId: question.id,
    response: "not-yet-assessed",
    confidence: "low",
    verificationStatus: question.ownership === "advantage-prefill" ? "proposed" : "not-reviewed",
    evidenceSource: "Not yet verified",
    evidenceDate: "",
    evidenceAttachment: null,
    internalNotes: "",
    clientVisibleObservation: "",
    riskSeverity: "none",
    recommendedAction: "",
    responsibleParty: "",
    targetDate: "",
    completionStatus: "not-started",
    clientConfirmationStatus: "pending",
    clientConfirmer: "",
    confirmationDate: "",
    lastReviewedDate: "",
    includeInReport: true,
    deferred: false,
    deferredAt: "",
    deferredReason: "",
    serviceDisposition: "",
    dispositionRecordedAt: "",
  };
}

function prefillTechnicalAnswer(project: Project, question: HipaaQuestionDefinition): HipaaAnswer {
  const answer = baseAnswer(question);
  // Imported inventory can suggest which controls to discuss, but cannot verify service
  // scope, cloud encryption, restores, or all endpoints. Never auto-mark "Yes".
  if (question.id === "SEC-01") {
    const evidence = sourceEvidence(project, [
      "huntress.entitiesProtected", "huntress.eventsAnalyzed", "huntress.signalsDetected",
      "huntress.signalsInvestigated", "huntress.incidentsReported", "huntress.antivirusEvents",
      "huntress.malwareFilesBlocked",
    ]);
    if (evidence.evidence) {
      answer.evidenceSource = evidence.source;
      answer.evidenceDate = evidence.date;
      answer.internalNotes = evidence.evidence;
      answer.confidence = evidence.confidence;
      answer.verificationStatus = "proposed";
      answer.clientVisibleObservation = "Imported monitoring activity is available for review. The protected device scope still needs confirmation.";
    }
  }
  if (question.id === "SEC-05") {
    const evidence = sourceEvidence(project, ["scalepad.backupServers", "backup.endpointMissing"]);
    if (evidence.evidence) {
      answer.evidenceSource = evidence.source;
      answer.evidenceDate = evidence.date;
      answer.internalNotes = evidence.evidence;
      answer.confidence = evidence.confidence;
      answer.verificationStatus = "proposed";
      const count = numeric(project, "scalepad.backupServers");
      answer.clientVisibleObservation = count > 0
        ? `${count} backup-server ${count === 1 ? "record is" : "records are"} available. Confirm local copies, encrypted cloud copies, protected workloads, and exclusions.`
        : "Backup information is available; coverage and encryption require confirmation.";
    }
  }
  return answer;
}

/**
 * Previous 12-question and 31-question HIPAA answers are deliberately not converted
 * into Yes/No answers to new security questions. Different wording and scope make
 * automatic mappings unsafe. The raw prior answers stay in legacyAnswers.
 */
function migrateLegacyAnswers(_existingAnswers: HipaaAnswer[]): HipaaAnswer[] {
  return HIPAA_QUESTIONS.map((question) => baseAnswer(question));
}

export function emptyHipaaAssessment(project?: Project): HipaaAssessment {
  const answers = HIPAA_QUESTIONS.map((question) => project && question.ownership === "advantage-prefill" ? prefillTechnicalAnswer(project, question) : baseAnswer(question));
  return {
    questionSetVersion: HIPAA_QUESTION_SET_VERSION,
    enabled: false,
    status: "not-started",
    reportingPeriod: { start: "", end: "" },
    answers,
    clientConfirmation: { status: "pending", confirmer: "", confirmedAt: "", acceptedResponsibility: false },
    snapshots: [],
    includeDetailedAppendix: true,
    lastUpdatedAt: "",
  };
}

export function normalizeHipaaAssessment(project: Project): HipaaAssessment {
  const existing = project.hipaa;
  if (!existing?.answers?.length) return emptyHipaaAssessment(project);
  const migrating = existing.questionSetVersion !== HIPAA_QUESTION_SET_VERSION;
  const normalizedAnswers = migrating
    ? migrateLegacyAnswers(existing.answers)
    : HIPAA_QUESTIONS.map((question) => {
        const current = existing.answers.find((answer) => answer.questionId === question.id);
        return current ? { ...baseAnswer(question), ...current } : baseAnswer(question);
      });
  const refreshedAnswers = HIPAA_QUESTIONS.map((question) => {
    const current = normalizedAnswers.find((answer) => answer.questionId === question.id);
    if (current && current.response !== "not-yet-assessed") return current;
    if (current?.deferred) return current;
    if (question.ownership !== "advantage-prefill") return current ?? baseAnswer(question);
    const evidence = prefillTechnicalAnswer(project, question);
    return { ...evidence, ...current, internalNotes: current?.internalNotes || evidence.internalNotes, clientVisibleObservation: current?.clientVisibleObservation || evidence.clientVisibleObservation, evidenceSource: current?.evidenceSource !== "Not yet verified" ? current!.evidenceSource : evidence.evidenceSource, evidenceDate: current?.evidenceDate || evidence.evidenceDate };
  });
  return {
    ...emptyHipaaAssessment(),
    ...existing,
    questionSetVersion: HIPAA_QUESTION_SET_VERSION,
    status: migrating && existing.enabled ? "in-progress" : existing.status,
    answers: refreshedAnswers,
    clientConfirmation: migrating
      ? { status: "pending", confirmer: "", confirmedAt: "", acceptedResponsibility: false }
      : { ...emptyHipaaAssessment().clientConfirmation, ...existing.clientConfirmation },
    snapshots: Array.isArray(existing.snapshots) ? existing.snapshots : [],
    legacyAnswers: migrating ? [...(existing.legacyAnswers ?? []), ...existing.answers] : existing.legacyAnswers,
    legacyQuestionSetVersion: migrating ? existing.questionSetVersion || "unknown" : existing.legacyQuestionSetVersion,
    legacyClientConfirmation: migrating ? existing.clientConfirmation : existing.legacyClientConfirmation,
  };
}

export function enableHipaaAssessment(project: Project): Project {
  const existing = normalizeHipaaAssessment(project);
  const freshTechnical = HIPAA_QUESTIONS.map((question) => {
    const current = existing.answers.find((item) => item.questionId === question.id);
    if (question.ownership === "advantage-prefill" && (!current || (current.response === "not-yet-assessed" && !current.deferred))) {
      const proposed = prefillTechnicalAnswer(project, question);
      return { ...proposed, ...current, internalNotes: current?.internalNotes || proposed.internalNotes, clientVisibleObservation: current?.clientVisibleObservation || proposed.clientVisibleObservation, evidenceDate: current?.evidenceDate || proposed.evidenceDate };
    }
    return current ?? baseAnswer(question);
  });
  return {
    ...project,
    hipaa: { ...existing, enabled: true, status: existing.status === "not-started" ? "in-progress" : existing.status, answers: freshTechnical, lastUpdatedAt: now() },
  };
}

export function hipaaQuestion(questionId: string): HipaaQuestionDefinition | undefined { return HIPAA_QUESTIONS.find((item) => item.id === questionId); }

export function answerRequirements(answer: HipaaAnswer): string[] {
  if (answer.response === "not-yet-assessed") return [answer.deferred ? "Deferred for follow-up." : "Choose an answer or leave this for the live review."];
  if (answer.questionId === "SEC-08" && answer.response === "yes" && !["advantage", "other-provider", "undecided"].includes(answer.serviceDisposition || "")) return ["Confirm whether training is provided by Advantage, another provider, or a provider not yet verified."];
  if (answer.questionId === "SEC-08" && answer.response === "no" && !["planned-advantage", "planned-elsewhere", "declined", "undecided"].includes(answer.serviceDisposition || "")) return ["Record whether training is planned, declined, or still undecided."];
  return [];
}

export function answerIsComplete(answer: HipaaAnswer): boolean {
  return answer.response !== "not-yet-assessed" && answerRequirements(answer).length === 0;
}
export function answerIsSessionResolved(answer: HipaaAnswer): boolean { return answerIsComplete(answer) || answer.deferred; }

export function withUpdatedHipaaAnswer(project: Project, questionId: string, patch: Partial<HipaaAnswer>): Project {
  const timestamp = now();
  const answers = project.hipaa.answers.map((answer) => {
    if (answer.questionId !== questionId) return answer;
    const response = patch.response ?? answer.response;
    const next: HipaaAnswer = {
      ...answer,
      ...patch,
      response,
      deferred: response === "not-yet-assessed" ? (patch.deferred ?? answer.deferred) : false,
      deferredAt: response === "not-yet-assessed" ? (patch.deferredAt ?? answer.deferredAt) : "",
      deferredReason: response === "not-yet-assessed" ? (patch.deferredReason ?? answer.deferredReason) : "",
      serviceDisposition: patch.serviceDisposition !== undefined ? patch.serviceDisposition : (response !== answer.response ? "" : answer.serviceDisposition),
      dispositionRecordedAt: patch.serviceDisposition !== undefined && patch.serviceDisposition !== answer.serviceDisposition ? timestamp : (response !== answer.response && patch.serviceDisposition === undefined ? "" : answer.dispositionRecordedAt),
      lastReviewedDate: timestamp,
      clientConfirmationStatus: "pending",
      clientConfirmer: "",
      confirmationDate: "",
    };
    const completionStatus: HipaaAnswer["completionStatus"] = answerIsComplete(next) ? "complete" : next.deferred ? "deferred" : next.response === "not-yet-assessed" ? "open" : "in-progress";
    return { ...next, completionStatus };
  });
  const sessionResolved = answers.every(answerIsSessionResolved);
  return {
    ...project,
    hipaa: {
      ...project.hipaa,
      answers,
      status: sessionResolved ? "ready-for-confirmation" : "in-progress",
      clientConfirmation: { status: "pending", confirmer: "", confirmedAt: "", acceptedResponsibility: false },
      lastUpdatedAt: timestamp,
    },
  };
}

export function deferHipaaAnswer(project: Project, questionId: string, reason = "Skipped during client presentation"): Project {
  return withUpdatedHipaaAnswer(project, questionId, {
    response: "not-yet-assessed",
    deferred: true,
    deferredAt: now(),
    deferredReason: reason,
    completionStatus: "deferred",
    clientConfirmationStatus: "deferred",
  });
}

export function deferRemainingHipaaAnswers(project: Project, reason = "Skipped during client presentation"): Project {
  const timestamp = now();
  const answers = project.hipaa.answers.map((answer) => answerIsComplete(answer) || answer.deferred ? answer : {
    ...answer,
    response: "not-yet-assessed" as const,
    deferred: true,
    deferredAt: timestamp,
    deferredReason: reason,
    completionStatus: "deferred" as const,
    clientConfirmationStatus: "deferred" as const,
    lastReviewedDate: timestamp,
  });
  return {
    ...project,
    hipaa: {
      ...project.hipaa,
      answers,
      status: "ready-for-confirmation",
      clientConfirmation: { status: "pending", confirmer: "", confirmedAt: "", acceptedResponsibility: false },
      lastUpdatedAt: timestamp,
    },
  };
}

export function reopenHipaaAnswer(project: Project, questionId: string): Project {
  return withUpdatedHipaaAnswer(project, questionId, { deferred: false, deferredAt: "", deferredReason: "", clientConfirmationStatus: "pending" });
}

export function hipaaQuestionsForPresentation(project: Project): Array<{ question: HipaaQuestionDefinition; answer: HipaaAnswer }> {
  if (!project.hipaa.enabled) return [];
  return HIPAA_QUESTIONS.map((question) => ({ question, answer: project.hipaa.answers.find((item) => item.questionId === question.id) ?? baseAnswer(question) }))
    .filter(({ answer }) => !answerIsComplete(answer) && !answer.deferred);
}

function responsePoints(response: HipaaResponse): number | null {
  if (response === "yes") return 100;
  if (response === "partially") return 50;
  if (response === "no") return 0;
  return null;
}
function average(values: number[]): number { return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0; }
function percent(numerator: number, denominator: number): number { return denominator ? Math.round((numerator / denominator) * 100) : 0; }

export function scoreHipaaAssessment(assessment: HipaaAssessment): HipaaScoreSummary {
  const counts: Record<HipaaResponse, number> = { yes: 0, partially: 0, no: 0, "not-applicable": 0, "not-yet-assessed": 0 };
  const categoryPoints = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, [] as number[]])) as Record<HipaaSafeguardCategory, number[]>;
  const categoryAnswered = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0])) as Record<HipaaSafeguardCategory, number>;
  const categoryDenominator = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0])) as Record<HipaaSafeguardCategory, number>;
  const allPoints: number[] = [];
  let assessedQuestionCount = 0;
  let denominator = 0;
  let pointTotal = 0;

  for (const answer of assessment.answers) {
    counts[answer.response] += 1;
    const question = hipaaQuestion(answer.questionId);
    if (!question) continue;
    if (answer.response === "not-applicable") continue;
    denominator += 1;
    categoryDenominator[question.category] += 1;
    const points = responsePoints(answer.response);
    if (points !== null) {
      assessedQuestionCount += 1;
      pointTotal += points;
      allPoints.push(points);
      categoryPoints[question.category].push(points);
      categoryAnswered[question.category] += 1;
    }
  }

  const confirmedReadiness = average(allPoints);
  const completionPercentage = percent(assessedQuestionCount, denominator);
  const overall = denominator ? Math.round(pointTotal / denominator) : 0;
  const confirmedCategories = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, average(categoryPoints[category])])) as Record<HipaaSafeguardCategory, number>;
  const categoryCompletion = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, percent(categoryAnswered[category], categoryDenominator[category])])) as Record<HipaaSafeguardCategory, number>;
  const categories = Object.fromEntries(CATEGORY_ORDER.map((category) => {
    const total = categoryPoints[category].reduce((sum, value) => sum + value, 0);
    return [category, categoryDenominator[category] ? Math.round(total / categoryDenominator[category]) : 0];
  })) as Record<HipaaSafeguardCategory, number>;
  const notYetAssessedCount = counts["not-yet-assessed"];
  const label: HipaaScoreSummary["label"] = notYetAssessedCount > 0 ? "Incomplete Assessment" : overall >= 90 ? "Strong Readiness" : overall >= 75 ? "Good Progress" : overall >= 60 ? "Developing" : overall >= 40 ? "Needs Attention" : "Critical Gaps";
  return {
    overall,
    confirmedReadiness,
    completionPercentage,
    categories,
    confirmedCategories,
    categoryCompletion,
    counts,
    confirmedQuestionCount: assessment.answers.filter(answerIsComplete).length,
    assessedQuestionCount,
    applicableQuestionCount: denominator,
    notYetAssessedCount,
    label,
  };
}

export function confirmHipaaAssessment(project: Project, confirmer: string): Project {
  const cleanName = confirmer.trim();
  if (!cleanName) throw new Error("Enter the client confirmer's name.");
  if (!project.hipaa.clientConfirmation.acceptedResponsibility) throw new Error("Confirm that the client reviewed the assessment and accepts responsibility for client-provided information.");
  const unresolved = project.hipaa.answers.filter((answer) => !answerIsSessionResolved(answer));
  if (unresolved.length) throw new Error(`${unresolved.length} security question${unresolved.length === 1 ? " still needs" : "s still need"} an answer or Skip for now selection.`);
  const timestamp = now();
  const answers = project.hipaa.answers.map((answer) => answer.deferred ? {
    ...answer,
    clientConfirmationStatus: "deferred" as const,
  } : {
    ...answer,
    clientConfirmationStatus: "confirmed" as const,
    clientConfirmer: cleanName,
    confirmationDate: timestamp,
    verificationStatus: "client-confirmed" as const,
  });
  const score = scoreHipaaAssessment({ ...project.hipaa, answers });
  const assessment: HipaaAssessment = {
    ...project.hipaa,
    answers,
    status: score.notYetAssessedCount ? "confirmed-incomplete" : "confirmed",
    clientConfirmation: { status: "confirmed", confirmer: cleanName, confirmedAt: timestamp, acceptedResponsibility: true },
    lastUpdatedAt: timestamp,
  };
  const snapshot = {
    id: `hipaa_snapshot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: timestamp,
    reportingPeriod: { ...assessment.reportingPeriod },
    scores: scoreHipaaAssessment(assessment),
    answers: assessment.answers.map((answer) => ({ ...answer, evidenceAttachment: answer.evidenceAttachment ? { ...answer.evidenceAttachment } : null })),
    confirmedBy: cleanName,
  };
  return { ...project, hipaa: { ...assessment, snapshots: [...assessment.snapshots, snapshot] } };
}

export function hipaaTopGaps(project: Project, limit = 5): Array<{ question: HipaaQuestionDefinition; answer: HipaaAnswer }> {
  if (!project.hipaa.enabled) return [];
  const rank: Record<HipaaResponse, number> = { no: 4, partially: 3, "not-yet-assessed": 2, yes: 0, "not-applicable": 0 };
  return project.hipaa.answers
    .map((answer) => ({ answer, question: hipaaQuestion(answer.questionId) }))
    .filter((item): item is { answer: HipaaAnswer; question: HipaaQuestionDefinition } => Boolean(item.question) && rank[item.answer.response] > 0 && item.answer.includeInReport)
    .sort((a, b) => rank[b.answer.response] - rank[a.answer.response])
    .slice(0, limit);
}

export function hipaaAssessmentReady(project: Project): boolean {
  return project.hipaa.enabled && (project.hipaa.status === "confirmed" || project.hipaa.status === "confirmed-incomplete");
}
