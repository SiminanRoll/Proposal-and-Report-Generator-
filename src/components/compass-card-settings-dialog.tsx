"use client";

import { useEffect, useMemo, useState } from "react";
import {
  COMPASS_CARD_ACCENTS,
  COMPASS_CARD_ESTIMATE_MODES,
  COMPASS_CARD_ICONS,
  COMPASS_CARD_SIGNAL_OPTIONS,
  DEFAULT_COMPASS_CARDS,
  normalizeCompassConfig,
} from "@/lib/compass/config";
import { recalculateDataset } from "@/lib/compass/engine";
import { saveCompassConfigAndDataset } from "@/lib/compass/store";
import type { CompassCardDefinition, CompassCardSignal, CompassConfig, CompassDataset } from "@/lib/compass/types";

interface Props {
  open: boolean;
  config: CompassConfig;
  dataset: CompassDataset | null;
  onClose: () => void;
  onSaved: () => void;
}

function newCard(order: number): CompassCardDefinition {
  const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` as const;
  return {
    id,
    builtIn: false,
    enabled: true,
    order,
    title: "New Opportunity Card",
    countLabel: "qualifying clients",
    valueLabel: "estimated opportunity value",
    description: "Define the technical signals and minimum device counts that should qualify a client.",
    accent: "blue",
    icon: "compass",
    criteriaType: "signals",
    matchMode: "any",
    rules: [{ id: `${id}-rule-1`, signal: "windows-10-active", minimumDevices: 1, enabled: true }],
    sourceCardIds: [],
    excludeSignals: [],
    estimateMode: "fixed",
    fixedEstimate: 0,
    manualClientIds: [],
  };
}

function reorder(cards: CompassCardDefinition[]): CompassCardDefinition[] {
  return cards.map((card, index) => ({ ...card, order: index }));
}

export function CompassCardSettingsDialog({ open, config, dataset, onClose, onSaved }: Props) {
  const [cards, setCards] = useState<CompassCardDefinition[]>(() => structuredClone(config.cards));
  const [selectedId, setSelectedId] = useState<string>(config.cards[0]?.id ?? "all");
  const [manualSearch, setManualSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCards(structuredClone(config.cards));
    setSelectedId(config.cards[0]?.id ?? "all");
    setManualSearch("");
    setSaving(false);
    setError("");
  }, [open, config]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, saving]);

  const selected = cards.find((card) => card.id === selectedId) ?? cards[0] ?? null;
  const visibleClients = useMemo(() => {
    if (!dataset || !selected) return [];
    const search = manualSearch.trim().toLowerCase();
    const selectedSet = new Set(selected.manualClientIds);
    const matches = dataset.clients.filter((client) => !search || client.name.toLowerCase().includes(search));
    const prioritized = [...matches.filter((client) => selectedSet.has(client.id)), ...matches.filter((client) => !selectedSet.has(client.id))];
    return prioritized.slice(0, search ? 100 : 35);
  }, [dataset, manualSearch, selected]);

  if (!open || !selected) return null;

  const updateSelected = (patch: Partial<CompassCardDefinition>) => setCards((current) => current.map((card) => card.id === selected.id ? { ...card, ...patch } : card));
  const updateRule = (ruleId: string, patch: Partial<CompassCardDefinition["rules"][number]>) => updateSelected({ rules: selected.rules.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule) });
  const addRule = () => updateSelected({ rules: [...selected.rules, { id: `${selected.id}-rule-${Date.now().toString(36)}`, signal: "windows-10-active", minimumDevices: 1, enabled: true }] });
  const removeRule = (ruleId: string) => updateSelected({ rules: selected.rules.filter((rule) => rule.id !== ruleId) });
  const toggleSource = (cardId: string) => updateSelected({ sourceCardIds: selected.sourceCardIds.includes(cardId as CompassCardDefinition["id"]) ? selected.sourceCardIds.filter((id) => id !== cardId) : [...selected.sourceCardIds, cardId as CompassCardDefinition["id"]] });
  const toggleExclusion = (signal: CompassCardSignal) => updateSelected({ excludeSignals: selected.excludeSignals.includes(signal) ? selected.excludeSignals.filter((item) => item !== signal) : [...selected.excludeSignals, signal] });
  const toggleManualClient = (clientId: string) => updateSelected({ manualClientIds: selected.manualClientIds.includes(clientId) ? selected.manualClientIds.filter((id) => id !== clientId) : [...selected.manualClientIds, clientId] });

  const move = (direction: -1 | 1) => {
    const index = cards.findIndex((card) => card.id === selected.id);
    const target = index + direction;
    if (target < 0 || target >= cards.length) return;
    const next = [...cards];
    [next[index], next[target]] = [next[target], next[index]];
    setCards(reorder(next));
  };

  const addCard = () => {
    const card = newCard(cards.length);
    setCards((current) => [...current, card]);
    setSelectedId(card.id);
  };

  const deleteCard = () => {
    if (selected.builtIn) return;
    const remaining = reorder(cards
      .filter((card) => card.id !== selected.id)
      .map((card) => ({ ...card, sourceCardIds: card.sourceCardIds.filter((id) => id !== selected.id) })));
    setCards(remaining);
    setSelectedId(remaining[0]?.id ?? "all");
  };

  const restoreBuiltIn = () => {
    const fallback = DEFAULT_COMPASS_CARDS.find((card) => card.id === selected.id);
    if (!fallback) return;
    updateSelected({ ...structuredClone(fallback), order: selected.order });
  };

  const validate = (): string => {
    const enabled = cards.filter((card) => card.enabled);
    if (!enabled.length) return "Keep at least one card enabled.";
    for (const card of cards) {
      if (!card.title.trim()) return "Every card needs a title.";
      if (!card.enabled) continue;
      if (card.criteriaType === "signals" && !card.rules.some((rule) => rule.enabled) && !card.manualClientIds.length) return `${card.title} needs at least one enabled criterion or manual client override.`;
      if (card.criteriaType === "rollup" && !card.sourceCardIds.length && !card.manualClientIds.length) return `${card.title} needs at least one source card or manual client override.`;
      if (card.rules.some((rule) => !Number.isFinite(rule.minimumDevices) || rule.minimumDevices < 1)) return `${card.title} has an invalid minimum-device threshold.`;
    }
    return "";
  };

  const save = async () => {
    const validation = validate();
    if (validation) { setError(validation); return; }
    setSaving(true);
    setError("");
    try {
      const nextConfig = normalizeCompassConfig({ ...config, cards: reorder(cards) });
      await saveCompassConfigAndDataset(nextConfig, dataset ? recalculateDataset(dataset, nextConfig) : null);
      await onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Client Compass could not save the card configuration.");
    } finally {
      setSaving(false);
    }
  };

  const availableSources = cards.filter((card) => card.id !== selected.id && card.criteriaType === "signals");

  return (
    <div className="compass-modal-backdrop" role="presentation" onMouseDown={saving ? undefined : onClose}>
      <section className="compass-modal compass-card-manager-modal" role="dialog" aria-modal="true" aria-labelledby="compass-card-manager-title" aria-busy={saving} onMouseDown={(event) => event.stopPropagation()}>
        <header className="compass-modal-header">
          <div><span className="compass-kicker">Configurable opportunity dashboard</span><h2 id="compass-card-manager-title">Manage Cards &amp; Criteria</h2><p>Add custom cards or edit the exact signals, minimum device counts, exclusions, manual overrides, estimates, and display order used by existing cards.</p></div>
          <button className="compass-drawer-close" type="button" onClick={onClose} disabled={saving} aria-label="Close card manager">×</button>
        </header>

        <div className="compass-card-manager-layout">
          <aside className="compass-card-manager-list">
            <button className="button primary compact compass-add-card" type="button" onClick={addCard}>+ Add card</button>
            <div className="compass-card-manager-items">
              {cards.map((card) => <button key={card.id} className={card.id === selected.id ? "is-active" : ""} type="button" onClick={() => { setSelectedId(card.id); setManualSearch(""); }}><span className={`compass-card-manager-dot accent-${card.accent}`}/><span><strong>{card.title}</strong><small>{card.builtIn ? "Built-in template" : "Custom card"}{card.enabled ? "" : " · hidden"}</small></span></button>)}
            </div>
          </aside>

          <div className="compass-card-manager-editor">
            <div className="compass-card-editor-toolbar">
              <label className="compass-card-enabled"><input type="checkbox" checked={selected.enabled} onChange={(event) => updateSelected({ enabled: event.target.checked })}/><span>Show this card</span></label>
              <div><button className="button secondary compact" type="button" onClick={() => move(-1)} disabled={selected.order === 0}>Move up</button><button className="button secondary compact" type="button" onClick={() => move(1)} disabled={selected.order === cards.length - 1}>Move down</button>{selected.builtIn ? <button className="button secondary compact" type="button" onClick={restoreBuiltIn}>Restore template</button> : <button className="button secondary compact danger" type="button" onClick={deleteCard}>Delete card</button>}</div>
            </div>

            <section className="compass-card-editor-section">
              <h3>Card appearance</h3>
              <div className="compass-card-editor-grid">
                <label className="wide"><span>Card title</span><input value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })}/></label>
                <label><span>Accent</span><select value={selected.accent} onChange={(event) => updateSelected({ accent: event.target.value as CompassCardDefinition["accent"] })}>{COMPASS_CARD_ACCENTS.map((accent) => <option key={accent} value={accent}>{accent}</option>)}</select></label>
                <label><span>Icon</span><select value={selected.icon} onChange={(event) => updateSelected({ icon: event.target.value as CompassCardDefinition["icon"] })}>{COMPASS_CARD_ICONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select></label>
                <label className="wide"><span>Description</span><textarea rows={3} value={selected.description} onChange={(event) => updateSelected({ description: event.target.value })}/></label>
                <label><span>Count label</span><input value={selected.countLabel} onChange={(event) => updateSelected({ countLabel: event.target.value })}/></label>
                <label><span>Value label</span><input value={selected.valueLabel} onChange={(event) => updateSelected({ valueLabel: event.target.value })}/></label>
              </div>
            </section>

            {selected.criteriaType === "rollup" ? (
              <section className="compass-card-editor-section">
                <h3>Qualifying source cards</h3>
                <p>A client appears once when it qualifies for any selected source card. Its estimate is deduplicated across overlapping devices.</p>
                <div className="compass-card-source-grid">{availableSources.map((card) => <label key={card.id}><input type="checkbox" checked={selected.sourceCardIds.includes(card.id)} onChange={() => toggleSource(card.id)}/><span>{card.title}</span></label>)}</div>
              </section>
            ) : (
              <>
                <section className="compass-card-editor-section">
                  <div className="compass-card-editor-heading"><div><h3>Qualifying criteria</h3><p>Each criterion counts unique affected devices. “Any” supports rules such as five Replace Now OR five Plan Soon workstations.</p></div><button className="button secondary compact" type="button" onClick={addRule}>+ Add criterion</button></div>
                  <label className="compass-match-mode"><span>Client must satisfy</span><select value={selected.matchMode} onChange={(event) => updateSelected({ matchMode: event.target.value as "any" | "all" })}><option value="any">Any enabled criterion</option><option value="all">All enabled criteria</option></select></label>
                  <div className="compass-card-rule-list">
                    {selected.rules.map((rule) => <div key={rule.id} className={rule.enabled ? "" : "is-disabled"}><label className="compass-rule-toggle"><input type="checkbox" checked={rule.enabled} onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })}/><span>Use</span></label><label><span>Technical signal</span><select value={rule.signal} onChange={(event) => updateRule(rule.id, { signal: event.target.value as CompassCardSignal })}>{COMPASS_CARD_SIGNAL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="compass-rule-min"><span>Minimum devices</span><input type="number" min="1" step="1" value={rule.minimumDevices} onChange={(event) => updateRule(rule.id, { minimumDevices: Math.max(1, Number(event.target.value) || 1) })}/></label><button className="compass-rule-remove" type="button" onClick={() => removeRule(rule.id)} aria-label="Remove criterion">×</button></div>)}
                  </div>
                </section>

                <section className="compass-card-editor-section">
                  <h3>Exclusions</h3><p>Devices matching selected signals are removed before minimum-device counts are evaluated. Server Planning uses this to prevent a critical server from being counted again.</p>
                  <div className="compass-signal-checkbox-grid">{COMPASS_CARD_SIGNAL_OPTIONS.map((option) => <label key={option.value}><input type="checkbox" checked={selected.excludeSignals.includes(option.value)} onChange={() => toggleExclusion(option.value)}/><span>{option.label}</span></label>)}</div>
                </section>

                <section className="compass-card-editor-section">
                  <h3>Estimate behavior</h3>
                  <div className="compass-card-editor-grid"><label><span>Estimate type</span><select value={selected.estimateMode} onChange={(event) => updateSelected({ estimateMode: event.target.value as CompassCardDefinition["estimateMode"] })}>{COMPASS_CARD_ESTIMATE_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>{selected.estimateMode === "fixed" && <label><span>Fixed value per client</span><input type="number" min="0" step="100" value={selected.fixedEstimate} onChange={(event) => updateSelected({ fixedEstimate: Math.max(0, Number(event.target.value) || 0) })}/></label>}</div>
                </section>
              </>
            )}

            <section className="compass-card-editor-section">
              <h3>Manual client overrides</h3><p>Use this for a confirmed immediate replacement or modernization need that is not represented in the Ninja spreadsheet. Overrides remain browser-local.</p>
              {!dataset ? <div className="compass-demo-notice">Import client data before assigning manual overrides.</div> : <><input className="compass-client-override-search" type="search" placeholder="Search clients…" value={manualSearch} onChange={(event) => setManualSearch(event.target.value)}/><div className="compass-client-override-list">{visibleClients.map((client) => <label key={client.id}><input type="checkbox" checked={selected.manualClientIds.includes(client.id)} onChange={() => toggleManualClient(client.id)}/><span>{client.name}</span></label>)}{manualSearch && !visibleClients.length && <p>No matching clients.</p>}</div>{dataset.clients.length > visibleClients.length && <small className="compass-client-override-note">Showing {visibleClients.length} clients. Search to narrow the list.</small>}</>}
            </section>
          </div>
        </div>

        {error && <div className="compass-import-error" role="alert">{error}</div>}
        <footer className="compass-modal-actions"><span className="compass-card-save-note" aria-live="polite">{saving ? "Saving cards and recalculating the current snapshot…" : `${cards.length} card${cards.length === 1 ? "" : "s"} configured`}</span><span className="compass-modal-spacer"/><button className="button secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="button primary" type="button" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save cards & recalculate"}</button></footer>
      </section>
    </div>
  );
}
