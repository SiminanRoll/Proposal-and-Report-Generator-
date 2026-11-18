import type { HipaaAnswer, HipaaQuestionDefinition } from "@/lib/projects/types";

const CLIENT_FOLLOW_UP_BY_QUESTION: Record<string, string> = {
  "SEC-01": "Confirm that every in-scope computer is protected by managed endpoint security and monitoring, and identify any unsupported or unmanaged devices.",
  "SEC-02": "Review unsupported systems, missing updates, and devices outside the managed agreement; agree which need a plan.",
  "SEC-03": "Review individual sign-ins, multifactor authentication, remote access, and any shared or unmanaged accounts.",
  "SEC-04": "Confirm secure email, file sharing, and approved workflows for confidential or regulated data.",
  "SEC-05": "Verify which workloads have on-site backup and encrypted off-site cloud copies, including any excluded systems or cloud applications.",
  "SEC-06": "Verify that the right person receives and reviews routine backup-status notifications, understands error alerts, and retains records as appropriate.",
  "SEC-07": "Confirm the current disaster recovery and downtime procedure is available, with evidence of the most recent restoration test.",
  "SEC-08": "Confirm how workforce cybersecurity training will be provided and keep the client's reported provider or declined-service decision on record.",
  "SEC-09": "Clarify the staff-offboarding request process and the contact path for potential cybersecurity incidents.",
  "SEC-10": "Confirm who owns security policies, risk decisions, and any formal regulatory or contractual compliance reviews.",
};

export function securityTrainingDecisionDescription(answer?: HipaaAnswer): string {
  if (!answer?.serviceDisposition) return "";
  const messages: Record<NonNullable<HipaaAnswer["serviceDisposition"]>, string> = {
    "": "",
    "advantage": "Training reported as provided by Advantage; enrollment should be verified against the agreement",
    "other-provider": "Training reported as provided by another organization",
    "planned-advantage": "Client reports plans to arrange training with Advantage",
    "planned-elsewhere": "Client reports plans to obtain training elsewhere",
    "declined": "Client reports declining cybersecurity training at this time",
    "undecided": "Training provider or next step is not yet confirmed",
  };
  return messages[answer.serviceDisposition] || "";
}

/**
 * Returns plain-English follow-up text for the client-facing presentation and PDF.
 * Does not re-use internal questionnaire coaching or claim regulatory certification.
 */
export function hipaaClientFacingFollowUp(question: HipaaQuestionDefinition, answer?: HipaaAnswer): string {
  const choice = question.id === "SEC-08" ? securityTrainingDecisionDescription(answer) : "";
  const detail = answer?.clientVisibleObservation?.trim()
    || answer?.recommendedAction?.trim()
    || CLIENT_FOLLOW_UP_BY_QUESTION[question.id]
    || "Review this safeguard and confirm the next practical step.";

  if (answer?.deferred || !answer || answer.response === "not-yet-assessed") {
    return "This item still needs to be discussed. No conclusion about security coverage or compliance has been reached.";
  }
  if (choice) {
    return `${choice}. ${detail} A recorded choice is not a waiver of applicable requirements.`;
  }
  return detail;
}
