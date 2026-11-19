import type { HipaaAnswer, HipaaQuestionDefinition } from "@/lib/projects/types";

/**
 * A control's technical/category ownership is not the same as who will obtain
 * the missing answer after the review. This can always be overridden in the UI.
 */
export function securityFollowUpOwner(
  question: HipaaQuestionDefinition,
  answer?: HipaaAnswer,
): "advantage" | "client" {
  if (answer?.followUpOwner === "advantage" || answer?.followUpOwner === "client") {
    return answer.followUpOwner;
  }
  return question.ownership === "client" ? "client" : "advantage";
}

export function needsSecurityFollowUp(answer?: HipaaAnswer): boolean {
  return !answer || answer.response === "not-yet-assessed" || Boolean(answer.deferred);
}

export function isClientSecurityFollowUp(question: HipaaQuestionDefinition, answer?: HipaaAnswer): boolean {
  return needsSecurityFollowUp(answer) && securityFollowUpOwner(question, answer) === "client";
}
