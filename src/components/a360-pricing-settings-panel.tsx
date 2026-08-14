"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_A360_PRESENTATION_PRICING,
  loadA360PresentationPricing,
  saveA360PresentationPricing,
  type A360PresentationPricing,
} from "@/lib/prospects/a360-pricing-settings";

type PricingKey = keyof A360PresentationPricing;

const CORE_FIELDS: Array<{ key: PricingKey; label: string; detail: string; allowNegative?: boolean }> = [
  { key: "site", label: "Site / location fee", detail: "Monthly fee for each covered location." },
  { key: "workstation", label: "Workstation", detail: "Monthly fee for each managed workstation." },
  { key: "serverStandardBackup", label: "Server + standard backup", detail: "Monthly fee for a standard managed server." },
  { key: "minimumAgreement", label: "Minimum agreement", detail: "The monthly floor shown even when the calculated total is lower." },
];

const ADDITIONAL_FIELDS: Array<{ key: PricingKey; label: string; detail: string; allowNegative?: boolean }> = [
  { key: "multiServerDiscount", label: "Multi-server discount", detail: "Recurring discount for each qualifying additional server.", allowNegative: true },
  { key: "cloudPlusAdvancedBackup", label: "Cloud Plus advanced backup", detail: "Monthly advanced server backup option." },
  { key: "workstationBackup", label: "Workstation backup", detail: "Monthly workstation-level backup option." },
  { key: "managedFirewall", label: "Managed firewall", detail: "Monthly managed firewall service." },
  { key: "goToMyPc", label: "GoToMyPC", detail: "Monthly managed remote-access option." },
  { key: "newClientDiscount", label: "New-client discount", detail: "Optional recurring new-client discount.", allowNegative: true },
];

function PriceField({ field, value, onChange }: { field: (typeof CORE_FIELDS)[number]; value: number; onChange: (value: number) => void }) {
  return <label className={`a360-settings-price-field${field.key === "minimumAgreement" ? " is-minimum" : ""}`}>
    <span><strong>{field.label}</strong><small>{field.detail}</small></span>
    <div className="a360-settings-price-input"><em>$</em><input type="number" step="1" min={field.allowNegative ? undefined : 0} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>
  </label>;
}

export function A360PricingSettingsPanel() {
  const [draft, setDraft] = useState<A360PresentationPricing>({ ...DEFAULT_A360_PRESENTATION_PRICING });
  const [saved, setSaved] = useState<A360PresentationPricing>({ ...DEFAULT_A360_PRESENTATION_PRICING });
  const [message, setMessage] = useState("");

  useEffect(() => {
    const current = loadA360PresentationPricing();
    setDraft(current);
    setSaved(current);
  }, []);

  const changed = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const update = (key: PricingKey, value: number) => setDraft((current) => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }));

  const save = () => {
    const next = saveA360PresentationPricing(draft);
    setDraft(next);
    setSaved(next);
    setMessage("A360 pricing saved.");
    window.setTimeout(() => setMessage(""), 2200);
  };

  const resetDraft = () => {
    setDraft({ ...DEFAULT_A360_PRESENTATION_PRICING });
    setMessage("Defaults loaded. Save to apply them.");
  };

  return <section className="settings-pricing-panel a360-settings-pricing" aria-labelledby="a360-pricing-heading">
    <header className="settings-pricing-panel-header">
      <div><span className="compass-settings-section-kicker">A360 presentation</span><h2 id="a360-pricing-heading">Monthly pricing &amp; minimum agreement</h2><p>These are the global defaults used by the live A360 prospect presentation estimate. The minimum agreement acts as a hard monthly floor.</p></div>
      <span className="settings-pricing-scope-badge">Global default</span>
    </header>

    <div className="settings-pricing-subpanel is-primary">
      <div className="compass-settings-subsection-heading"><span>Core calculation</span><h3>Presentation estimate</h3><p>These four numbers directly determine the preliminary monthly amount shown during the A360 conversation.</p></div>
      <div className="a360-settings-price-grid">{CORE_FIELDS.map((field) => <PriceField key={field.key} field={field} value={draft[field.key]} onChange={(value) => update(field.key, value)} />)}</div>
    </div>

    <div className="settings-pricing-subpanel">
      <div className="compass-settings-subsection-heading"><span>Rate card</span><h3>Additional monthly pricing</h3><p>Keep the supporting A360 rates alongside the core presentation numbers so the whole rate card is easy to maintain.</p></div>
      <div className="a360-settings-price-grid">{ADDITIONAL_FIELDS.map((field) => <PriceField key={field.key} field={field} value={draft[field.key]} onChange={(value) => update(field.key, value)} />)}</div>
    </div>

    <div className="settings-pricing-panel-footer">
      <div><strong>Saved with Client Compass preferences.</strong><span>The normal master backup includes these values and restores them with the rest of the browser settings.</span>{message && <small role="status">{message}</small>}</div>
      <div><button className="button secondary" type="button" onClick={resetDraft}>Load defaults</button><button className="button primary" type="button" disabled={!changed} onClick={save}>{changed ? "Save A360 pricing" : "Pricing saved"}</button></div>
    </div>
  </section>;
}
