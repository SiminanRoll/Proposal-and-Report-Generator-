import Link from "next/link";

type SettingsHubIcon = "pricing" | "data" | "coverage" | "segments" | "reports" | "map" | "people" | "workspace" | "recovery";

function SettingsIcon({ type }: { type: SettingsHubIcon }) {
  if (type === "pricing") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.8-.8-2-1.3-3.4-1.3-1.8 0-3.1.9-3.1 2.2 0 3.1 6 1.4 6 4.7 0 1.4-1.3 2.4-3.3 2.4-1.5 0-2.8-.5-3.7-1.4M12 5.5v13"/></svg>;
  if (type === "data") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3 1.5 0 2.8-.1 4-.4"/><path d="M19 16v6M16 19h6"/></svg>;
  if (type === "coverage") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="8" height="7" rx="2"/><rect x="13" y="4" width="8" height="7" rx="2"/><rect x="3" y="13" width="8" height="7" rx="2"/><rect x="13" y="13" width="8" height="7" rx="2"/></svg>;
  if (type === "segments") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></svg>;
  if (type === "reports") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 12h6M9 16h4"/></svg>;
  if (type === "people") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.2 2.3-5 5.5-5s5 1.8 5.5 5"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.4c3.2-.7 5.1.8 5.5 3.6"/></svg>;
  if (type === "workspace") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="15" rx="3"/><path d="M3 9h18M8 4v5M8 13h4M8 16h7"/></svg>;
  if (type === "recovery") return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/><path d="M9 12h6M12 9v6"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3.5 6.5 5-2.5 7 2.5 5-2.5v13.5l-5 2.5-7-2.5-5 2.5V6.5Z"/><path d="M8.5 4v13.5M15.5 6.5V20"/></svg>;
}

const SETTINGS_AREAS: Array<{ icon: SettingsHubIcon; title: string; description: string; href: string; action: string; badge: string }> = [
  { icon: "pricing", title: "Pricing, estimates & numbers", description: "A360 monthly fees and minimum agreement, lifecycle thresholds, and project-estimate values.", href: "/settings/pricing/", action: "Open pricing settings", badge: "Global defaults" },
  { icon: "data", title: "Data & sync", description: "Inventory imports, client enrichment, calculation refresh, and Captain's Log history sync.", href: "/data/", action: "Open Data Tools", badge: "Specialized tools" },
  { icon: "coverage", title: "Coverage cards & signals", description: "Project Coverage and Health card criteria stay directly on the card backs, where the business signal is easiest to understand.", href: "/", action: "Open coverage cards", badge: "Edit in context" },
  { icon: "segments", title: "Segments", description: "Build reusable client books with rules, include/exclude overrides, display identity, and saved segment definitions.", href: "/segments/", action: "Open Segment Manager", badge: "Specialized editor" },
  { icon: "reports", title: "Reports & presentations", description: "Create and manage client reports, proposals, presentation content, HIPAA readiness, and saved workspace-specific output.", href: "/generator/", action: "Open Report Generator", badge: "Workspace specific" },
  { icon: "map", title: "Maps, lists & views", description: "Territory and map display choices plus saved list columns, widths, and viewing preferences remain close to the view they control.", href: "/map/", action: "Open Map", badge: "Saved preferences" },
  { icon: "people", title: "Technology consultants & scheduling", description: "Maintain the consultant roster, report contact details, appointment identities, and Microsoft 365 calendar lookup addresses.", href: "/settings/consultants/", action: "Manage consultant roster", badge: "People & calendar" },
  { icon: "workspace", title: "Workspace defaults", description: "Default home view, workstation project qualification minimum, and Priority Lens availability.", href: "/settings/workspace/", action: "Open workspace defaults", badge: "Global behavior" },
  { icon: "recovery", title: "Connections, backup & recovery", description: "Captain's Log cloud access, local master backups, restore, and persistent browser preferences.", href: "/settings/recovery/", action: "Open recovery settings", badge: "Recovery & storage" },
];

export function CompassSettingsPage() {
  return <div className="compass-admin-page compass-settings-page compass-settings-page-modern settings-hub-page">
    <header className="settings-hub-hero">
      <span className="compass-settings-section-kicker">Client Compass control center</span>
      <h1>Settings</h1>
      <p>One place to understand where every global preference lives — calculations, people, scheduling, coverage logic, reports, maps, data, sync, storage, and recovery.</p>
    </header>

    <section className="settings-hub-directory" aria-labelledby="settings-directory-title">
      <div className="settings-hub-directory-heading"><div><span className="compass-settings-section-kicker">Settings map</span><h2 id="settings-directory-title">Everything customizable, organized by what it affects</h2><p>Settings is now the directory only. Each group has one clear home, while complex editors remain beside the feature they control.</p></div></div>
      <div className="settings-hub-grid">{SETTINGS_AREAS.map((area) => <Link key={area.title} href={area.href} className={`settings-hub-card settings-hub-${area.icon}`}>
        <span className="settings-hub-card-icon"><SettingsIcon type={area.icon} /></span>
        <span className="settings-hub-card-badge">{area.badge}</span>
        <span className="settings-hub-card-copy"><strong>{area.title}</strong><small>{area.description}</small></span>
        <b>{area.action}<span aria-hidden="true">→</span></b>
      </Link>)}</div>
    </section>
  </div>;
}
