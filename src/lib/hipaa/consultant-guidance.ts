import type { Project } from "@/lib/projects/types";

export const HIPAA_CONSULTANT_GUIDANCE = "This readiness review can highlight potential weaknesses, but it does not determine HIPAA compliance. Practices without ongoing qualified guidance should consider working with a qualified HIPAA consultant or compliance professional, especially when several answers are No or Not sure.";

export interface HipaaConsultantGuidance {
  title: string;
  copy: string;
  tone: "healthy" | "attention";
}

export function hipaaConsultantGuidance(project: Project): HipaaConsultantGuidance {
  const consultantAnswer = project.hipaa.answers.find((answer) => answer.questionId === "HIPAA-10");
  const noOrUnknownCount = project.hipaa.answers.filter((answer) => answer.response === "no" || answer.response === "not-yet-assessed").length;

  if (consultantAnswer?.response === "yes") {
    return {
      title: "Continue ongoing HIPAA guidance",
      copy: "Continue regular policy, staff-training, and change reviews with the qualified HIPAA consultant or compliance professional supporting the practice. This technology readiness review does not determine HIPAA compliance.",
      tone: "healthy",
    };
  }

  if (consultantAnswer?.response === "partially") {
    return {
      title: "Strengthen ongoing HIPAA guidance",
      copy: `Regular qualified guidance appears limited or inconsistent. ${HIPAA_CONSULTANT_GUIDANCE}`,
      tone: "attention",
    };
  }

  return {
    title: "Qualified HIPAA guidance is recommended",
    copy: noOrUnknownCount >= 2
      ? HIPAA_CONSULTANT_GUIDANCE
      : "This readiness review can highlight potential weaknesses, but it does not determine HIPAA compliance. Consider working with a qualified HIPAA consultant or compliance professional to keep policies, staff training, and compliance responsibilities current.",
    tone: "attention",
  };
}
