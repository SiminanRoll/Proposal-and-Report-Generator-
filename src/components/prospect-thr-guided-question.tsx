"use client";

import { useState } from "react";
import type { A360ProspectDiscovery } from "@/lib/prospects/a360";
import type { ThrAnswer, ThrQuestion } from "@/lib/prospects/technology-health";

const ANSWERS: ThrAnswer[] = ["positive", "partial", "concern", "unknown"];

export function GuidedThrQuestion({
  question,
  position,
  total,
  current,
  note,
  leaving,
  onAnswer,
  onNote,
  onContinue,
}: {
  question: ThrQuestion;
  position: number;
  total: number;
  current?: ThrAnswer;
  note: string;
  leaving: boolean;
  onAnswer: (answer: ThrAnswer, autoAdvance: boolean) => void;
  onNote: (value: string) => void;
  onContinue: () => void;
}) {
  const [notesOpen, setNotesOpen] = useState(Boolean(note.trim()));
  const progress = Math.round((position / total) * 100);

  return <section className={"thr-guided-page" + (leaving ? " is-leaving" : "")} aria-label={question.category + " question " + position}>
    <div className="thr-guided-inner">
      <div className="thr-guided-meta">
        <span className="prospect-kicker">{question.category}</span>
        <span className="thr-question-position">{String(position).padStart(2, "0")} <i>/</i> {String(total).padStart(2, "0")}</span>
      </div>
      <div className="thr-question-track" role="progressbar" aria-label="Question progress" aria-valuenow={position} aria-valuemin={1} aria-valuemax={total}>
        <span style={{ width: progress + "%" }} />
      </div>
      <h2 className="thr-guided-heading">{question.question}</h2>
      <div className="thr-guided-options">{ANSWERS.map((value, index) =>
        <button type="button" key={value} disabled={leaving} className={"thr-guided-choice" + (current === value ? " selected choice-" + value : "")}
          aria-pressed={current === value} onClick={() => onAnswer(value, !notesOpen)}>

          <strong>{question.options[index]}</strong>
          <span className="thr-choice-arrow" aria-hidden="true">↗</span>
        </button>)}
      </div>
      <div className="thr-note-zone">
        <button type="button" className="thr-note-toggle" onClick={() => setNotesOpen((open) => !open)} aria-expanded={notesOpen}>
          {notesOpen ? "Hide note" : note.trim() ? "Edit note" : "+ Add a note"}
        </button>
        {notesOpen && <div className="thr-note-editor">
          <label htmlFor={"thr-note-" + question.id}>Optional observation</label>
          <textarea id={"thr-note-" + question.id} rows={2} value={note} onChange={(event) => onNote(event.target.value)}
            placeholder="A short detail you want included in the report" maxLength={400} />
          {current && <button type="button" className="thr-note-continue" onClick={onContinue}>Continue →</button>}
        </div>}
      </div>
    </div>
  </section>;
}

type EnvironmentKey = "workstations" | "server" | "locations" | "managementSoftware" | "imagingSoftware" | "otherSoftware";

export function environmentSteps(discovery: A360ProspectDiscovery): EnvironmentKey[] {
  const steps: EnvironmentKey[] = ["workstations", "server", "locations", "managementSoftware"];
  if (discovery.industry === "Dental") steps.push("imagingSoftware");
  steps.push("otherSoftware");
  return steps;
}

export function GuidedThrEnvironment({
  discovery,
  position,
  total,
  leaving,
  onPatch,
  onContinue,
}: {
  discovery: A360ProspectDiscovery;
  position: number;
  total: number;
  leaving: boolean;
  onPatch: <K extends keyof A360ProspectDiscovery>(key: K, value: A360ProspectDiscovery[K]) => void;
  onContinue: () => void;
}) {
  const field = environmentSteps(discovery)[position - 1];
  const prompts: Record<EnvironmentKey, string> = {
    workstations: "About how many computers do you have?",
    server: "Do you have a server in the office?",
    locations: "How many locations do you have?",
    managementSoftware: discovery.industry === "Dental" ? "What practice management software do you use?" : "What software runs your daily business?",
    imagingSoftware: "Which imaging software does your practice use?",
    otherSoftware: "Any other important software we should know about?",
  };
  const description = field === "otherSoftware" ? "Optional" : "A rough answer is fine";
  const isNumber = field === "workstations" || field === "locations";
  const isServer = field === "server";
  const numericValue = isNumber ? discovery[field] : 0;
  const min = field === "locations" ? 1 : 0;
  const softwareValue = !isNumber && !isServer ? discovery[field] : "";
  const progress = Math.round(position / total * 100);

  return <section className={"thr-guided-page" + (leaving ? " is-leaving" : "")} aria-label={"Technology environment question " + position}>
    <div className="thr-guided-inner">
      <div className="thr-guided-meta">
        <span className="prospect-kicker">Your technology environment</span>
        <span className="thr-question-position">{String(position).padStart(2, "0")} <i>/</i> {String(total).padStart(2, "0")}</span>
      </div>
      <div className="thr-question-track" role="progressbar" aria-label="Environment progress" aria-valuenow={position} aria-valuemin={1} aria-valuemax={total}>
        <span style={{ width: progress + "%" }} />
      </div>
      <h2 className="thr-guided-heading">{prompts[field]}</h2>
      {isNumber && <div className="thr-env-number">
        <button type="button" aria-label="Decrease" onClick={() => onPatch(field, Math.max(min, numericValue - 1))}>−</button>
        <input type="number" min={min} value={numericValue} aria-label={prompts[field]} onChange={(event) => onPatch(field, Math.max(min, Math.round(Number(event.target.value) || 0)))} />
        <button type="button" aria-label="Increase" onClick={() => onPatch(field, numericValue + 1)}>+</button>
      </div>}
      {isServer && <div className="thr-guided-options thr-server-choices">
        {(["yes", "no", "not-sure"] as const).map((answer) =>
          <button type="button" key={answer} className={"thr-guided-choice" + (discovery.server === answer ? " selected" : "")} aria-pressed={discovery.server === answer}
            onClick={() => { onPatch("server", answer); onContinue(); }}>
            <strong>{answer === "yes" ? "Yes" : answer === "no" ? "No" : "Not sure"}</strong><span className="thr-choice-arrow" aria-hidden="true">↗</span>
          </button>)}
      </div>}
      {!isNumber && !isServer && <div className="thr-env-software">
        <input value={softwareValue} autoComplete="off" aria-label={prompts[field]} onChange={(event) => onPatch(field, event.target.value)} placeholder="Enter a name, or choose Not sure" />
        <button type="button" onClick={() => { onPatch(field, "Not sure"); onContinue(); }}>Not sure</button>
      </div>}
      {!isServer && <div className="thr-guided-footnote"><span>{description}</span><button type="button" className="thr-note-continue" onClick={onContinue}>Continue →</button></div>}
    </div>
  </section>;
}
