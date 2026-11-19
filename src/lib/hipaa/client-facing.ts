import type { HipaaAnswer, HipaaQuestionDefinition } from "@/lib/projects/types";
import { needsSecurityFollowUp, securityFollowUpOwner } from "./follow-up-owner";

const CLIENT_FOLLOW_UP_BY_QUESTION: Record<string, string> = {
  "SEC-01": "Confirm managed protection on supported computers and identify unmonitored devices.",
  "SEC-02": "Review outdated software, missing patches and any systems outside managed scope.",
  "SEC-03": "Confirm whether staff use individual logins in the main client-records application. Review shared accounts and any vendor-supported alternatives.",
  "SEC-04": "Review MFA for cloud sign-ins, email and accounts accessible from outside the office; enable supported protections where missing.",
  "SEC-05": "Review protected email and file-sharing methods for confidential information.",
  "SEC-06": "Confirm which critical systems have local and encrypted offsite backup copies, and record exclusions.",
  "SEC-07": "Confirm who receives and reviews backup-status notifications and how failed jobs are followed up.",
  "SEC-08": "Review the recovery plan and evidence of the latest restore test for covered systems.",
  "SEC-09": "Confirm how access is added, adjusted and removed when team members join, change roles or leave.",
  "SEC-10": "Review encryption, screen-lock controls and lost-device protection for applicable devices.",
  "SEC-11": "Confirm secure wiping or destruction of retired data-bearing devices before disposal or reuse.",
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
  const detail = answer?.clientVisibleObservation?.trim()
    || answer?.recommendedAction?.trim()
    || CLIENT_FOLLOW_UP_BY_QUESTION[question.id]
    || "Review this safeguard and confirm the next practical step.";

  if (needsSecurityFollowUp(answer)) {
    const owner = securityFollowUpOwner(question, answer);
    const action = answer?.recommendedAction?.trim() || CLIENT_FOLLOW_UP_BY_QUESTION[question.id] || "Confirm the required technical or business information.";
    return (owner === "advantage" ? "Advantage will verify: " : "Client will confirm: ") + action;
  }
  return detail;
}
