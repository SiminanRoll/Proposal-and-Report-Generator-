"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompassDataset } from "@/lib/compass/types";
import type { ProjectCoverageCardMetric } from "@/lib/compass/project-coverage";
import {
  SEGMENT_RULE_FIELDS,
  SEGMENT_RULE_GROUPS,
  operatorsForSegmentField,
  segmentFieldDefaultValue,
  segmentFieldKind,
  segmentFieldPrefix,
  segmentFieldStep,
  segmentFieldUnit,
  segmentOperatorLabel,
  segmentOsOptions,
} from "@/lib/segments/engine";
import { newSegmentRule } from "@/lib/segments/store";
import type { SegmentRule, SegmentRuleField, SegmentRuleOperator } from "@/lib/segments/types";
import { loadCoverageCardCriteria, saveCoverageCardCriteria, type CoverageCardCriteria } from "@/lib/compass/coverage-card-criteria";

function selectedOptionValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

interface Props {
  open: boolean;
  card: ProjectCoverageCardMetric | null;
  dataset: CompassDataset | null;
  qualifiedClientIds: string[];
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_CRITERIA: CoverageCardCriteria = { matchMode: "all", rules: [], includeClientIds: [], excludeClientIds: [] };

export function ProjectCoverageCardCriteriaDialog({ open, card, dataset, qualifiedClientIds, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<CoverageCardCriteria>(EMPTY_CRITERIA);
  const [error, setError] = useState("");
  const qualifiedSet = useMemo(() => new Set(qualifiedClientIds), [qualifiedClientIds]);
  const sortedClients = useMemo(() => (dataset?.clients || []).filter((client) => qualifiedSet.has(client.id)).slice().sort((a, b) => a.name.localeCompare(b.name)), [dataset, qualifiedSet]);

  useEffect(() => {
    if (!open || !card) return;
    const existing = loadCoverageCardCriteria()[card.id];
    setDraft(existing ? structuredClone(existing) : structuredClone(EMPTY_CRITERIA));
    setError("");
  }, [card, open]);

  if (!open || !card) return null;

  const updateRule = (ruleId: string, patch: Partial<SegmentRule>) => {
    setDraft((current) => ({ ...current, rules: current.rules.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule) }));
  };

  const save = () => {
    if (!draft.rules.length && !draft.includeClientIds.length) {
      setError("Add at least one rule or manually include a client, or use Reset to default.");
      return;
    }
    saveCoverageCardCriteria(card.id, draft);
    onSaved();
  };

  const reset = () => {
    saveCoverageCardCriteria(card.id, null);
    onSaved();
  };

  return <div className="segment-editor-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="segment-editor" role="dialog" aria-modal="true" aria-labelledby="coverage-card-criteria-title" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><span className="compass-kicker">Card criteria</span><h2 id="coverage-card-criteria-title">Edit {card.title}</h2><p>Customize this broad coverage signal using the same rule language as Segment Manager. Saved criteria replace this card&apos;s default enrollment within the qualified project book, so your primary cards can reflect the coverage signals that matter to you.</p></div>
        <button type="button" onClick={onClose} aria-label="Close card criteria editor">×</button>
      </header>
      <div className="segment-editor-scroll">
        <section className="segment-editor-section">
          <div className="segment-editor-section-heading"><div><span className="compass-kicker">Enrollment</span><h3>Rules</h3><p>Use device age, counts, operating systems, project value, workflow activity, or client details. Custom cards may overlap when the same qualified client matches more than one card.</p></div><label className="segment-match-mode"><span>Match</span><select value={draft.matchMode} onChange={(event) => setDraft({ ...draft, matchMode: event.target.value === "any" ? "any" : "all" })}><option value="all">All rules</option><option value="any">Any rule</option></select></label></div>
          <div className="segment-rule-list">{draft.rules.map((rule) => {
            const operators = operatorsForSegmentField(rule.field);
            const kind = segmentFieldKind(rule.field);
            const unit = segmentFieldUnit(rule.field);
            const prefix = segmentFieldPrefix(rule.field);
            const step = segmentFieldStep(rule.field);
            return <div className="segment-rule-row" key={rule.id}>
              <select value={rule.field} onChange={(event) => {
                const field = event.target.value as SegmentRuleField;
                const operator = operatorsForSegmentField(field)[0] || "eq";
                const nextKind = segmentFieldKind(field);
                const value = nextKind === "boolean" ? "true" : nextKind === "os" ? (segmentOsOptions(field)[0]?.value ?? "") : nextKind === "number" ? segmentFieldDefaultValue(field) : "";
                updateRule(rule.id, { field, operator, value });
              }}>{SEGMENT_RULE_GROUPS.map((group) => <optgroup key={group} label={group}>{SEGMENT_RULE_FIELDS.filter((field) => field.group === group).map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</optgroup>)}</select>
              <select value={rule.operator} onChange={(event) => updateRule(rule.id, { operator: event.target.value as SegmentRuleOperator })}>{operators.map((operator) => <option key={operator} value={operator}>{segmentOperatorLabel(operator, rule.field)}</option>)}</select>
              {kind === "boolean" ? <select value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })}><option value="true">Yes</option><option value="false">No</option></select>
                : kind === "os" ? <select value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })}>{segmentOsOptions(rule.field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  : kind === "number" ? <div className={`segment-rule-number${prefix ? " has-prefix" : ""}${unit ? " has-unit" : ""}`}>{prefix && <span className="segment-rule-number-prefix" aria-hidden="true">{prefix}</span>}<input type="number" min="0" step={step} value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })} />{unit && <span className="segment-rule-number-unit" aria-hidden="true">{unit}</span>}</div>
                    : <input type="text" value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })} placeholder="Value" />}
              <button type="button" aria-label="Remove rule" onClick={() => setDraft({ ...draft, rules: draft.rules.filter((item) => item.id !== rule.id) })}>×</button>
            </div>;
          })}</div>
          <button className="segment-add-rule" type="button" onClick={() => setDraft({ ...draft, rules: [...draft.rules, newSegmentRule()] })}>+ Add rule</button>
        </section>

        {sortedClients.length > 0 && <section className="segment-editor-section">
          <div className="segment-editor-section-heading"><div><span className="compass-kicker">Overrides</span><h3>Manual include / exclude</h3><p>Optional exceptions always win over the rule engine. Overrides are limited to clients already in the qualified project book.</p></div></div>
          <div className="segment-editor-grid">
            <label className="segment-field"><span>Always include</span><select multiple value={draft.includeClientIds} onChange={(event) => setDraft({ ...draft, includeClientIds: selectedOptionValues(event.currentTarget).filter((id) => !draft.excludeClientIds.includes(id)) })}>{sortedClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <label className="segment-field"><span>Always exclude</span><select multiple value={draft.excludeClientIds} onChange={(event) => setDraft({ ...draft, excludeClientIds: selectedOptionValues(event.currentTarget).filter((id) => !draft.includeClientIds.includes(id)) })}>{sortedClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          </div>
        </section>}
        <div style={{ padding: "12px 14px", border: "1px solid #d7e4ef", borderRadius: 14, background: "#f4f8fc", color: "#62768c", fontSize: 11, lineHeight: 1.5 }}><strong style={{ color: "#274a70" }}>Saved with Client Compass.</strong> Card criteria are stored alongside your local settings and are included in the normal Client Compass master backup and restore flow.</div>
        {error && <div className="segment-editor-error" role="alert">{error}</div>}
      </div>
      <footer><button className="button secondary" type="button" onClick={reset}>Reset to default</button><span className="segment-editor-footer-spacer" /><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="button" onClick={save}>Save criteria</button></footer>
    </section>
  </div>;
}
