"use client";

import type { ChangeEvent } from "react";
import type { HipaaAnswer, HipaaResponse } from "@/lib/projects/types";

export const TRAINING_DECISION_LABELS: Record<Exclude<NonNullable<HipaaAnswer["serviceDisposition"]>, "">, string> = {
  advantage: "Training provided by Advantage (verify enrollment)",
  "other-provider": "Training provided by another organization",
  "planned-advantage": "Planning training with Advantage",
  "planned-elsewhere": "Planning to obtain training elsewhere",
  declined: "Client reports declining training at this time",
  undecided: "Provider or next step not yet decided",
};

export function trainingDecisionLabel(answer?: Pick<HipaaAnswer, "serviceDisposition">): string {
  const value = answer?.serviceDisposition;
  return value ? TRAINING_DECISION_LABELS[value] ?? "" : "";
}

/** An informational record of the conversation. This is not a liability waiver. */
export function SecurityTrainingDecision({
  response, value, onChange,
}: {
  response: HipaaResponse;
  value?: HipaaAnswer["serviceDisposition"];
  onChange: (value: NonNullable<HipaaAnswer["serviceDisposition"]>) => void;
}) {
  if (response !== "yes" && response !== "no" && response !== "partially") return null;
  const options: Array<Exclude<NonNullable<HipaaAnswer["serviceDisposition"]>, "">> = response === "yes"
    ? ["advantage", "other-provider", "undecided"]
    : ["planned-advantage", "planned-elsewhere", "declined", "undecided"];
  return <label style={{ display: "grid", gap: 7, minWidth: 0, fontSize: "inherit" }}>
    <strong style={{ fontSize: "0.86em" }}>Training source or decision</strong>
    <select
      aria-label="Training source or decision"
      required
      value={value || ""}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value as NonNullable<HipaaAnswer["serviceDisposition"]>)}
      style={{ width: "100%", maxWidth: "100%", padding: "11px 12px", borderRadius: 11, border: "1px solid #a3b7cc", background: "#fff", color: "#19334c", fontSize: "0.93em" }}
    >
      <option value="">Choose the provider or next step...</option>
      {options.map((option) => <option key={option} value={option}>{TRAINING_DECISION_LABELS[option]}</option>)}
    </select>
    <small style={{ lineHeight: 1.4, opacity: .76 }}>This captures what the client reported. A declined or externally planned service does not waive legal or regulatory obligations.</small>
  </label>;
}
