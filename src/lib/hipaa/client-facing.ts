import type { HipaaAnswer, HipaaQuestionDefinition } from "@/lib/projects/types";

const CLIENT_FOLLOW_UP_BY_QUESTION: Record<string, string> = {
  "HIPAA-01": "Confirm who owns HIPAA security and that written policies are reviewed as the practice, technology, or workflows change.",
  "HIPAA-02": "Confirm the most recent documented security risk analysis and make sure any remaining risks have a clear follow-up plan.",
  "HIPAA-03": "Confirm that workforce security training is current and that the practice has a consistent process for handling policy violations.",
  "HIPAA-04": "Review how user access is approved, changed, and removed so access stays aligned with each team member’s role.",
  "HIPAA-05": "Review Business Associate Agreements with applicable vendors that handle protected health information and bring any missing or outdated agreements current.",
  "HIPAA-06": "Confirm that staff know how to report a suspected security incident and that the practice has a documented response process.",
  "HIPAA-07": "Review backup, recovery, and downtime procedures and confirm the practice has a current, tested plan for critical systems.",
  "HIPAA-08": "Review physical safeguards for work areas, devices, and retired equipment, including secure storage and documented disposal practices.",
  "HIPAA-09": "Review account access, multifactor authentication, remote access, and secure information-sharing methods for any remaining gaps.",
  "HIPAA-10": "Confirm that HIPAA policies, training, and compliance needs are reviewed regularly with an appropriate compliance resource as the practice changes.",
  "HIPAA-11": "Confirm that all supported computers remain covered by managed endpoint protection, monitoring, and response services.",
  "HIPAA-12": "Confirm that backup and recovery coverage remains current for the systems that support the practice’s critical data and operations.",
};

/**
 * Returns wording that is safe for the client-facing presentation and PDF.
 * Questionnaire helper/coaching text is intentionally never used here because
 * that language is for the reviewer, not the final report.
 */
export function hipaaClientFacingFollowUp(question: HipaaQuestionDefinition, answer?: HipaaAnswer): string {
  const observation = answer?.clientVisibleObservation?.trim() ?? "";
  if (observation) return observation;

  const action = answer?.recommendedAction?.trim() ?? "";
  if (action) return action;

  if (answer?.deferred || !answer || answer.response === "not-yet-assessed") {
    return "This item still needs to be confirmed with the practice before the readiness review is considered complete.";
  }

  return CLIENT_FOLLOW_UP_BY_QUESTION[question.id]
    ?? "Review this area with the practice and confirm any remaining gaps or next steps.";
}
