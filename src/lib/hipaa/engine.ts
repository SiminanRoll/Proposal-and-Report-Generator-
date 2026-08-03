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
    answer.completionStatus = response === "not-yet-assessed" ? "open" : "complete";
    answer.lastReviewedDate = evidence.evidence ? now() : "";
  };

  if (question.id === "HIPAA-11") {
    const protectedEntities = numeric(project, "huntress.entitiesProtected");
    const events = numeric(project, "huntress.eventsAnalyzed");
    const total = numeric(project, "environment.totalComputers") || numeric(project, "scalepad.totalAssets");
    if (protectedEntities > 0 && events > 0) {
      apply(
        "yes",
        ["huntress.entitiesProtected", "huntress.eventsAnalyzed", "huntress.signalsDetected", "huntress.signalsInvestigated", "huntress.incidentsReported", "huntress.antivirusEvents", "huntress.malwareFilesBlocked"],
        `${protectedEntities} managed entities were protected and security activity was monitored during the reporting period.`,
      );
    } else if (protectedEntities > 0) {
      apply(
        "partially",
        ["huntress.entitiesProtected"],
        `${protectedEntities} managed entities were shown as protected, but complete monitoring activity still requires confirmation.`,
        "Confirm monitoring coverage and any systems outside the managed-security scope.",
      );
    } else if (total > 0) {
      apply("not-yet-assessed", ["environment.totalComputers", "scalepad.totalAssets"], `${total} assets were identified, but managed endpoint-protection and monitoring coverage still require verification.`);
    }
  }

  if (question.id === "HIPAA-12") {
    const missing = numeric(project, "backup.endpointMissing");
    const backupFact = fact(project, "backup.endpointMissing");
    const cloudPlusBdrCount = numeric(project, "scalepad.backupServers");
    const cloudPlusBdrFact = fact(project, "scalepad.backupServers");

    if (cloudPlusBdrCount > 0 && cloudPlusBdrFact) {
      apply(
        "partially",
        backupFact ? ["scalepad.backupServers", "backup.endpointMissing"] : ["scalepad.backupServers"],
        missing > 0
          ? `${cloudPlusBdrCount} Cloud Plus BDR emergency standby server${cloudPlusBdrCount === 1 ? " was" : "s were"} identified, supporting local and cloud backup of the primary server. ${missing} endpoint device${missing === 1 ? " was" : "s were"} also identified without separate endpoint backup, so the complete protection scope still requires confirmation.`
          : `${cloudPlusBdrCount} Cloud Plus BDR emergency standby server${cloudPlusBdrCount === 1 ? " was" : "s were"} identified, supporting a local recovery copy and cloud backup path for the primary server. The appliance presence supports this control, while current backup-job health and the most recent recovery test still require confirmation.`,
        "Confirm current Cloud Plus BDR job health, the protected server and data scope, the cloud copy, and the date and outcome of the most recent recovery test.",
      );
    } else if (backupFact) {
      apply(
        missing > 0 ? "partially" : "not-yet-assessed",
        ["backup.endpointMissing"],
        missing > 0
          ? `${missing} devices were identified without endpoint backup in the imported assessment. Centralized server or cloud protection may exist separately and must be confirmed.`
          : "No endpoint-backup gap was identified in the imported source, but successful backup monitoring and recovery testing still require verification.",
        "Confirm the complete backup design, last successful jobs, protected copies, and most recent recovery test.",
      );
    }
  }
  answer.completionStatus = answerIsComplete(answer) ? "complete" : answer.response === "not-yet-assessed" ? "open" : "in-progress";
  return answer;
}

const LEGACY_QUESTION_GROUPS: Record<string, string[]> = {
  "HIPAA-01": ["HIPAA-01", "HIPAA-02", "HIPAA-03", "HIPAA-16"],
  "HIPAA-02": ["HIPAA-07", "HIPAA-08"],
  "HIPAA-03": ["HIPAA-04", "HIPAA-05", "HIPAA-06"],
  "HIPAA-04": ["HIPAA-11", "HIPAA-12", "HIPAA-13", "HIPAA-22"],
  "HIPAA-05": ["HIPAA-09", "HIPAA-10"],
  "HIPAA-06": ["HIPAA-20", "HIPAA-21"],
  "HIPAA-07": ["HIPAA-17", "HIPAA-18", "HIPAA-19", "HIPAA-31"],
  "HIPAA-08": ["HIPAA-14", "HIPAA-15", "HIPAA-23"],
  "HIPAA-09": ["HIPAA-28", "HIPAA-29", "HIPAA-30"],
  "HIPAA-10": ["HIPAA-03", "HIPAA-16", "HIPAA-24"],
  "HIPAA-11": ["HIPAA-25", "HIPAA-26", "HIPAA-27"],
  "HIPAA-12": ["HIPAA-31"],
};

function mergedLegacyResponse(answers: HipaaAnswer[]): HipaaResponse {
  const responses = answers.map((answer) => answer.response);
  if (responses.includes("no")) return "no";
  if (responses.includes("partially")) return "partially";
  const yesCount = responses.filter((response) => response === "yes").length;
  const unresolvedCount = responses.filter((response) => response === "not-yet-assessed").length;
  if (yesCount > 0 && unresolvedCount > 0) return "partially";
  if (yesCount > 0) return "yes";
  if (responses.length > 0 && responses.every((response) => response === "not-applicable")) return "not-applicable";
  return "not-yet-assessed";
}

function migrateLegacyAnswers(existingAnswers: HipaaAnswer[]): HipaaAnswer[] {
  return HIPAA_QUESTIONS.map((question) => {
    const legacy = (LEGACY_QUESTION_GROUPS[question.id] ?? [question.id])
      .map((id) => existingAnswers.find((answer) => answer.questionId === id))
      .filter(Boolean) as HipaaAnswer[];
    if (!legacy.length) return baseAnswer(question);
    const response = mergedLegacyResponse(legacy);
    const notes = Array.from(new Set(legacy.flatMap((answer) => [answer.internalNotes, answer.clientVisibleObservation]).filter(Boolean))).join("\n");
    const actions = Array.from(new Set(legacy.map((answer) => answer.recommendedAction).filter(Boolean))).join("\n");
    const source = legacy.find((answer) => answer.evidenceSource !== "Not yet verified")?.evidenceSource ?? "Not yet verified";
    const migrated: HipaaAnswer = {
      ...baseAnswer(question),
      response,
      confidence: legacy.some((answer) => answer.confidence === "high") ? "high" : legacy.some((answer) => answer.confidence === "medium") ? "medium" : "low",
      verificationStatus: legacy.some((answer) => answer.verificationStatus === "client-confirmed") ? "client-confirmed" : legacy.some((answer) => answer.verificationStatus === "technically-verified") ? "technically-verified" : question.ownership === "advantage-prefill" ? "proposed" : "not-reviewed",
      evidenceSource: source,
      evidenceDate: legacy.find((answer) => answer.evidenceDate)?.evidenceDate ?? "",
      evidenceAttachment: legacy.find((answer) => answer.evidenceAttachment)?.evidenceAttachment ?? null,
      internalNotes: notes,
      clientVisibleObservation: legacy.find((answer) => answer.clientVisibleObservation)?.clientVisibleObservation ?? "",
      riskSeverity: response === "no" ? "high" : response === "partially" ? "moderate" : "none",
      recommendedAction: actions,
      responsibleParty: legacy.find((answer) => answer.responsibleParty)?.responsibleParty ?? "",
      targetDate: legacy.find((answer) => answer.targetDate)?.targetDate ?? "",
      lastReviewedDate: legacy.find((answer) => answer.lastReviewedDate)?.lastReviewedDate ?? "",
      includeInReport: legacy.some((answer) => answer.includeInReport),
    };
    return { ...migrated, completionStatus: answerIsComplete(migrated) ? "complete" : "open" };
  });
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
  return {
    ...emptyHipaaAssessment(),
    ...existing,
    questionSetVersion: HIPAA_QUESTION_SET_VERSION,
    status: migrating && existing.enabled ? "in-progress" : existing.status,
    answers: normalizedAnswers,
    clientConfirmation: migrating
      ? { status: "pending", confirmer: "", confirmedAt: "", acceptedResponsibility: false }
      : { ...emptyHipaaAssessment().clientConfirmation, ...existing.clientConfirmation },
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
  if (answer.response === "not-yet-assessed") return [answer.deferred ? "Deferred for follow-up." : "Choose an answer or leave this for the live review."];
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
