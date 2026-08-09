"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CompassDataset } from "@/lib/compass/types";
import {
  SEGMENT_RULE_FIELDS,
  SEGMENT_RULE_GROUPS,
  SEGMENT_STAT_OPTIONS,
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
import type { SegmentDefinition, SegmentIconName, SegmentRuleField, SegmentRuleOperator, SegmentStatId } from "@/lib/segments/types";
import { SegmentIcon } from "./segment-icon";

const ICONS: SegmentIconName[] = ["target", "pin", "server", "users", "building", "shield", "calendar", "spark"];
const COLORS = ["#7c5cff", "#2f7df4", "#12a594", "#ef8c3a", "#e65d78", "#b16be8", "#496b8d", "#25a86b"];

function selectedOptionValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

interface Props {
  open: boolean;
  segment: SegmentDefinition | null;
  dataset: CompassDataset | null;
  onClose: () => void;
  onSave: (segment: SegmentDefinition) => void;
  onDelete?: (segmentId: string) => void;
}

export function SegmentEditorDialog({ open, segment, dataset, onClose, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<SegmentDefinition | null>(segment ? structuredClone(segment) : null);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setDraft(segment ? structuredClone(segment) : null); setError(""); } }, [open, segment]);
  const sortedClients = useMemo(() => (dataset?.clients || []).slice().sort((left, right) => left.name.localeCompare(right.name)), [dataset]);
  if (!open || !draft) return null;

  const updateRule = (ruleId: string, patch: Partial<SegmentDefinition["rules"][number]>) => {
    setDraft((current) => current ? { ...current, rules: current.rules.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule) } : current);
  };
  const toggleStat = (stat: SegmentStatId) => setDraft((current) => {
    if (!current) return current;
    if (current.stats.includes(stat)) return { ...current, stats: current.stats.filter((item) => item !== stat) };
    if (current.stats.length >= 3) return current;
    return { ...current, stats: [...current.stats, stat] };
  });
  const save = () => {
    const title = draft.title.trim();
    const descriptor = draft.descriptor.trim();
    if (!title) { setError("Give the segment a name."); return; }
    if (!descriptor) { setError("Add a one-word map descriptor."); return; }
    if (/\s/.test(descriptor)) { setError("The map descriptor should be one word."); return; }
    if (descriptor.length > 16) { setError("Keep the map descriptor to 16 characters or fewer."); return; }
    if (!draft.rules.length && !draft.includeClientIds.length) { setError("Add at least one rule or manually include a client."); return; }
    if (!draft.stats.length) { setError("Choose at least one stat for the back of the card."); return; }
    onSave({ ...draft, title, descriptor, description: draft.description.trim(), updatedAt: new Date().toISOString() });
  };
  const remove = () => {
    if (!onDelete) return;
    if (!window.confirm(`Delete ${draft.title}? This cannot be undone.`)) return;
    onDelete(draft.id);
  };

  return <div className="segment-editor-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="segment-editor" style={{ "--segment-color": draft.color } as CSSProperties} role="dialog" aria-modal="true" aria-labelledby="segment-editor-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="compass-kicker">Managed segment</span><h2 id="segment-editor-title">{segment?.title === "New Segment" ? "Create segment" : "Edit segment"}</h2><p>Define the audience once. Client Compass keeps the segment current as your client snapshot changes.</p></div><button type="button" onClick={onClose} aria-label="Close segment editor">×</button></header>
      <div className="segment-editor-scroll">
        <div className="segment-editor-grid">
          <label className="segment-field"><span>Segment title</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="No Recent Quote (1yr+)" /></label>
          <label className="segment-field"><span>Map descriptor</span><input value={draft.descriptor} maxLength={16} onChange={(event) => setDraft({ ...draft, descriptor: event.target.value.replace(/\s+/g, "") })} placeholder="Unquoted" /></label>
          <label className="segment-field" style={{ gridColumn: "1 / -1" }}><span>Description</span><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Optional internal context" /></label>
        </div>

        <section className="segment-editor-section"><div className="segment-editor-section-heading"><div><span className="compass-kicker">Identity</span><h3>Color &amp; icon</h3></div><div className="segment-editor-preview" style={{ "--segment-color": draft.color } as CSSProperties}><span><SegmentIcon name={draft.icon} /></span><strong>{draft.title || "Segment"}</strong></div></div>
          <div className="segment-color-row"><input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} aria-label="Segment color" />{COLORS.map((color) => <button type="button" key={color} className={draft.color.toLowerCase() === color.toLowerCase() ? "is-selected" : ""} style={{ background: color }} aria-label={`Use ${color}`} onClick={() => setDraft({ ...draft, color })} />)}</div>
          <div className="segment-icon-row">{ICONS.map((icon) => <button type="button" key={icon} className={draft.icon === icon ? "is-selected" : ""} onClick={() => setDraft({ ...draft, icon })}><SegmentIcon name={icon} /><span>{icon}</span></button>)}</div>
        </section>

        <section className="segment-editor-section"><div className="segment-editor-section-heading"><div><span className="compass-kicker">Enrollment</span><h3>Rules</h3><p>Build with device age, device counts, operating system, opportunity, workflow, or client details.</p></div><label className="segment-match-mode"><span>Match</span><select value={draft.matchMode} onChange={(event) => setDraft({ ...draft, matchMode: event.target.value === "any" ? "any" : "all" })}><option value="all">All rules</option><option value="any">Any rule</option></select></label></div>
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
                  : kind === "number" ? <div className={`segment-rule-number${prefix ? " has-prefix" : ""}${unit ? " has-unit" : ""}`}>
                    {prefix && <span className="segment-rule-number-prefix" aria-hidden="true">{prefix}</span>}
                    <input type="number" min="0" step={step} value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })} placeholder="0" />
                    {unit && <span className="segment-rule-number-unit" aria-hidden="true">{unit}</span>}
                  </div>
                    : <input type="text" value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })} placeholder="Value" />}
              <button type="button" aria-label="Remove rule" onClick={() => setDraft({ ...draft, rules: draft.rules.filter((item) => item.id !== rule.id) })}>×</button>
            </div>;
          })}</div>
          <button className="segment-add-rule" type="button" onClick={() => setDraft({ ...draft, rules: [...draft.rules, newSegmentRule()] })}>+ Add rule</button>
        </section>

        <section className="segment-editor-section"><div className="segment-editor-section-heading"><div><span className="compass-kicker">Card back</span><h3>Tracked stats</h3><p>Choose up to three stats shown when the segment card flips.</p></div><span className="segment-stat-count">{draft.stats.length}/3</span></div>
          <div className="segment-stat-options">{SEGMENT_STAT_OPTIONS.map((stat) => <label key={stat.id} className={draft.stats.includes(stat.id) ? "is-selected" : ""}><input type="checkbox" checked={draft.stats.includes(stat.id)} disabled={!draft.stats.includes(stat.id) && draft.stats.length >= 3} onChange={() => toggleStat(stat.id)} /><span>{stat.label}</span></label>)}</div>
        </section>

        {sortedClients.length > 0 && <section className="segment-editor-section"><div className="segment-editor-section-heading"><div><span className="compass-kicker">Overrides</span><h3>Manual include / exclude</h3><p>Optional exceptions always win over the rule engine.</p></div></div>
          <div className="segment-editor-grid"><label className="segment-field"><span>Always include</span><select multiple value={draft.includeClientIds} onChange={(event) => setDraft({ ...draft, includeClientIds: selectedOptionValues(event.currentTarget).filter((id) => !draft.excludeClientIds.includes(id)) })}>{sortedClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label className="segment-field"><span>Always exclude</span><select multiple value={draft.excludeClientIds} onChange={(event) => setDraft({ ...draft, excludeClientIds: selectedOptionValues(event.currentTarget).filter((id) => !draft.includeClientIds.includes(id)) })}>{sortedClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label></div>
        </section>}
        {error && <div className="segment-editor-error" role="alert">{error}</div>}
      </div>
      <footer>{onDelete && <button className="button segment-delete-button" type="button" onClick={remove}>Delete segment</button>}<span className="segment-editor-footer-spacer" /><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" type="button" onClick={save}>Save segment</button></footer>
    </section>
  </div>;
}
