import { HIPAA_QUESTIONS } from "./questions";
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

export const HIPAA_DISCLAIMER = "This readiness assessment is based on information provided by the client and controls observed within systems managed by Advantage Technologies. It is not legal advice, a formal audit, certification, or guarantee of HIPAA compliance. The client remains responsible for evaluating and maintaining compliance across its complete environment.";

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
  };
}

function prefillTechnicalAnswer(project: Project, question: HipaaQuestionDefinition): HipaaAnswer {
  const answer = baseAnswer(question);
  const apply = (response: HipaaResponse, keys: string[], observation: string, recommendedAction = "") => {
    const evidence = sourceEvidence(project, keys);
    answer.response = response;
    answer.confidence = evidence.confidence;
    answer.verificationStatus = evidence.evidence ? "proposed" : "not-reviewed";
    answer.evidenceSource = evidence.source;
    answer.evidenceDate = evidence.date;
    answer.internalNotes = evidence.evidence;
    answer.clientVisibleObservation = observation;
    answer.recommendedAction = recommendedAction;
    answer.riskSeverity = response === "no" ? "high" : response === "partially" ? "moderate" : "none";
    answer.completionStatus = response === "not-yet-assessed" ? "open" : "in-progress";
    answer.lastReviewedDate = evidence.evidence ? now() : "";
  };

  if (question.id === "HIPAA-25") {
    const protectedEntities = numeric(project, "huntress.entitiesProtected");
    const total = numeric(project, "environment.totalComputers") || numeric(project, "scalepad.totalAssets");
    if (protectedEntities > 0) apply("yes", ["huntress.entitiesProtected", "huntress.antivirusEvents", "huntress.malwareFilesBlocked"], `${protectedEntities} managed entities were shown as protected by the imported security report.`);
    else if (total > 0) apply("not-yet-assessed", ["environment.totalComputers", "scalepad.totalAssets"], `${total} assets were identified, but centrally managed endpoint-protection coverage still requires verification.`);
  }
  if (question.id === "HIPAA-26") {
    const events = numeric(project, "huntress.eventsAnalyzed");
    if (events > 0) apply("yes", ["huntress.eventsAnalyzed", "huntress.signalsDetected", "huntress.incidentsReported"], `Continuous security monitoring analyzed ${events.toLocaleString("en-US")} events during the reporting period.`);
  }
  if (question.id === "HIPAA-27") {
    const events = numeric(project, "huntress.eventsAnalyzed");
    if (events > 0) apply("yes", ["huntress.eventsAnalyzed", "huntress.signalsDetected", "huntress.signalsInvestigated"], `Security-event data was collected and reviewed, with ${numeric(project, "huntress.signalsDetected")} signals identified for triage.`);
  }
  if (question.id === "HIPAA-28") {
    const accounts = numeric(project, "environment.enabledLocalAccounts");
    if (accounts > 0) apply("not-yet-assessed", ["environment.enabledLocalAccounts"], `${accounts} enabled local accounts were identified. Named-user coverage and shared-account exceptions still require review.`);
  }
  if (question.id === "HIPAA-29") {
    const accounts = numeric(project, "environment.enabledLocalAccounts");
    if (accounts > 0) apply("not-yet-assessed", ["environment.enabledLocalAccounts"], "The assessment identified active accounts, but password standards and multifactor-authentication coverage were not verified by the imported source.");
  }
  if (question.id === "HIPAA-30") apply("not-yet-assessed", [], "Temporary, vendor, emergency, and remote-support account controls require a joint account review.");
  if (question.id === "HIPAA-31") {
    const missing = numeric(project, "backup.endpointMissing");
    const backupFact = fact(project, "backup.endpointMissing");
    if (backupFact) {
      apply(
        missing > 0 ? "partially" : "not-yet-assessed",
        ["backup.endpointMissing"],
        missing > 0 ? `${missing} devices were identified without endpoint backup in the imported assessment. Centralized server or cloud protection may exist separately and must be confirmed.` : "No endpoint-backup gap was identified in the imported source, but successful backup monitoring and recovery testing still require verification.",
        "Confirm the complete backup design, last successful jobs, offsite protection, encryption, and most recent recovery test.",
      );
    }
  }
  answer.completionStatus = answerIsComplete(answer) ? "complete" : answer.response === "not-yet-assessed" ? "open" : "in-progress";
  return answer;
}

export function emptyHipaaAssessment(project?: Project): HipaaAssessment {
  const answers = HIPAA_QUESTIONS.map((question) => project && question.ownership === "advantage-prefill" ? prefillTechnicalAnswer(project, question) : baseAnswer(question));
  return {
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
  const normalizedAnswers = HIPAA_QUESTIONS.map((question) => {
    const current = existing.answers.find((answer) => answer.questionId === question.id);
    return current ? { ...baseAnswer(question), ...current } : baseAnswer(question);
  });
  return {
    ...emptyHipaaAssessment(),
    ...existing,
    answers: normalizedAnswers,
    clientConfirmation: { ...emptyHipaaAssessment().clientConfirmation, ...existing.clientConfirmation },
    snapshots: Array.isArray(existing.snapshots) ? existing.snapshots : [],
  };
}

export function enableHipaaAssessment(project: Project): Project {
  const existing = normalizeHipaaAssessment(project);
  const freshTechnical = HIPAA_QUESTIONS.map((question) => {
    const current = existing.answers.find((item) => item.questionId === question.id);
    if (question.ownership === "advantage-prefill" && (!current || (current.response === "not-yet-assessed" && !current.deferred) || current.verificationStatus === "proposed")) {
      const proposed = prefillTechnicalAnswer(project, question);
      return proposed.response !== "not-yet-assessed" || proposed.internalNotes ? proposed : current ?? proposed;
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
  const issues: string[] = [];
  const hasEvidence = Boolean(answer.internalNotes.trim() || answer.evidenceAttachment || answer.evidenceSource !== "Not yet verified");
  if ((answer.response === "yes" || answer.response === "partially") && !hasEvidence) issues.push("Add notes or supporting evidence.");
  if ((answer.response === "partially" || answer.response === "no") && !answer.recommendedAction.trim()) issues.push("Add a recommended corrective action.");
  if (answer.response === "not-applicable" && !answer.internalNotes.trim()) issues.push("Explain why this control does not apply.");
  if (answer.response === "not-yet-assessed") issues.push(answer.deferred ? "Deferred for follow-up." : "This answer still needs to be assessed.");
  return issues;
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
  if (unresolved.length) throw new Error(`${unresolved.length} HIPAA question${unresolved.length === 1 ? " still needs" : "s still need"} an answer or Skip for now selection.`);
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
