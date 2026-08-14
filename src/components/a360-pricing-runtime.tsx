"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_A360_PRESENTATION_PRICING,
  loadA360PresentationPricing,
  saveA360PresentationPricing,
  type A360PresentationPricing,
} from "@/lib/prospects/a360-pricing-settings";

type PricingKey = keyof A360PresentationPricing;

const PRICING_FIELDS: Array<{ key: PricingKey; label: string; detail: string; allowNegative?: boolean; core?: boolean }> = [
  { key: "site", label: "Site / location fee", detail: "Monthly fee for each covered location.", core: true },
  { key: "workstation", label: "Workstation", detail: "Monthly fee for each managed workstation.", core: true },
  { key: "serverStandardBackup", label: "Server + standard backup", detail: "Monthly fee for a standard managed server.", core: true },
  { key: "minimumAgreement", label: "Minimum agreement", detail: "Minimum monthly amount shown regardless of device count.", core: true },
  { key: "multiServerDiscount", label: "Multi-server discount", detail: "Recurring discount for each qualifying additional server.", allowNegative: true },
  { key: "cloudPlusAdvancedBackup", label: "Cloud Plus advanced backup", detail: "Monthly advanced server backup option." },
  { key: "workstationBackup", label: "Workstation backup", detail: "Monthly workstation-level backup option." },
  { key: "managedFirewall", label: "Managed firewall", detail: "Monthly managed firewall service." },
  { key: "goToMyPc", label: "GoToMyPC", detail: "Monthly managed remote-access option." },
  { key: "newClientDiscount", label: "New-client discount", detail: "Optional recurring new-client discount.", allowNegative: true },
];

function EditIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>;
}

function DollarIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.8-.8-2-1.3-3.4-1.3-1.8 0-3.1.9-3.1 2.2 0 3.1 6 1.4 6 4.7 0 1.4-1.3 2.4-3.3 2.4-1.5 0-2.8-.5-3.7-1.4M12 5.5v13"/></svg>;
}

function PriceField({ field, value, onChange }: { field: (typeof PRICING_FIELDS)[number]; value: number; onChange: (value: number) => void }) {
  return <label className={`a360-pricing-field${field.key === "minimumAgreement" ? " is-minimum" : ""}`}>
    <span className="a360-pricing-field-copy"><strong>{field.label}</strong><small>{field.detail}</small></span>
    <span className="a360-pricing-input-wrap"><b aria-hidden="true">$</b><input type="number" step="1" min={field.allowNegative ? undefined : 0} value={value} onChange={(event) => onChange(Number(event.target.value))} /></span>
  </label>;
}

export function A360PricingRuntime() {
  const [mounted, setMounted] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<A360PresentationPricing>({ ...DEFAULT_A360_PRESENTATION_PRICING });

  useEffect(() => {
    setMounted(true);
    const contextMenu = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest(".prospect-a360-button") : null;
      if (!target) return;
      event.preventDefault();
      const x = Math.min(event.clientX, Math.max(12, window.innerWidth - 226));
      const y = Math.min(event.clientY, Math.max(12, window.innerHeight - 78));
      setMenu({ x, y });
    };
    const dismiss = (event: MouseEvent) => {
      if (event.button === 2) return;
      setMenu(null);
    };
    const closeMenu = () => setMenu(null);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
        setEditorOpen(false);
      }
    };
    window.addEventListener("contextmenu", contextMenu);
    window.addEventListener("mousedown", dismiss);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("contextmenu", contextMenu);
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", keydown);
    };
  }, []);

  const openEditor = () => {
    setDraft(loadA360PresentationPricing());
    setMenu(null);
    setEditorOpen(true);
  };

  const update = (key: PricingKey, value: number) => setDraft((current) => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }));
  const save = () => {
    saveA360PresentationPricing(draft);
    setEditorOpen(false);
  };
  const reset = () => setDraft({ ...DEFAULT_A360_PRESENTATION_PRICING });

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(<>
    {menu && <div className="a360-pricing-context-menu" role="menu" style={{ left: menu.x, top: menu.y } as CSSProperties} onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" role="menuitem" onClick={openEditor}><span><EditIcon /></span><span><strong>Edit A360 pricing</strong><small>Monthly presentation defaults</small></span></button>
    </div>}

    {editorOpen && <div className="a360-pricing-editor-backdrop" role="presentation" onMouseDown={() => setEditorOpen(false)}>
      <section className="a360-pricing-editor" role="dialog" aria-modal="true" aria-labelledby="a360-pricing-editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <span className="a360-pricing-editor-icon"><DollarIcon /></span>
          <div><span className="compass-kicker">A360 presentation pricing</span><h2 id="a360-pricing-editor-title">Edit monthly pricing</h2><p>These values drive the preliminary monthly estimate shown in the A360 presentation.</p></div>
          <button type="button" className="a360-pricing-editor-close" onClick={() => setEditorOpen(false)} aria-label="Close pricing editor">×</button>
        </header>
        <div className="a360-pricing-editor-body">
          <section className="a360-pricing-section is-core">
            <div className="a360-pricing-section-heading"><div><span>Core estimate</span><h3>Presentation calculation</h3></div><small>These four values directly control the estimate slide.</small></div>
            <div className="a360-pricing-grid">{PRICING_FIELDS.filter((field) => field.core).map((field) => <PriceField key={field.key} field={field} value={draft[field.key]} onChange={(value) => update(field.key, value)} />)}</div>
          </section>
          <section className="a360-pricing-section">
            <div className="a360-pricing-section-heading"><div><span>A360 rate card</span><h3>Additional monthly pricing</h3></div><small>Saved with the same pricing preferences for future use.</small></div>
            <div className="a360-pricing-grid">{PRICING_FIELDS.filter((field) => !field.core).map((field) => <PriceField key={field.key} field={field} value={draft[field.key]} onChange={(value) => update(field.key, value)} />)}</div>
          </section>
          <aside className="a360-pricing-backup-note"><strong>Saved with Client Compass.</strong><span>Pricing preferences are included automatically in the normal master backup and restore flow.</span></aside>
        </div>
        <footer><button type="button" className="button secondary" onClick={reset}>Reset defaults</button><span /><button type="button" className="button secondary" onClick={() => setEditorOpen(false)}>Cancel</button><button type="button" className="button primary" onClick={save}>Save pricing</button></footer>
      </section>
    </div>}
  </>, document.body);
}
