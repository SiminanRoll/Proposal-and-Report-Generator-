"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEFAULT_CONSULTANT_CONTACTS,
  loadConsultantContacts,
  saveConsultantContacts,
  type ConsultantContact,
} from "@/lib/outcomes/consultant-contacts";

function cloneContacts(contacts: ConsultantContact[]): ConsultantContact[] {
  return contacts.map((contact) => ({ ...contact, aliases: [...(contact.aliases ?? [])] }));
}

function blankConsultant(): ConsultantContact {
  return { name: "", role: "Technology Consultant", phone: "", mobile: "", email: "", web: "adv.tech", calendarEmail: "", aliases: [] };
}

export function CompassConsultantSettingsPage() {
  const [contacts, setContacts] = useState<ConsultantContact[]>(() => cloneContacts(DEFAULT_CONSULTANT_CONTACTS));
  const [message, setMessage] = useState("");

  useEffect(() => { setContacts(loadConsultantContacts()); }, []);

  const updateContact = (index: number, patch: Partial<ConsultantContact>) => {
    setMessage("");
    setContacts((current) => current.map((contact, itemIndex) => itemIndex === index ? { ...contact, ...patch } : contact));
  };

  const save = () => {
    const saved = saveConsultantContacts(contacts);
    setContacts(saved);
    setMessage(`${saved.length} consultant${saved.length === 1 ? "" : "s"} saved. Presentation scheduling and report contact matching now use this roster.`);
  };

  return <div className="compass-admin-page compass-settings-page compass-settings-page-modern compass-consultant-settings-page">
    <header className="settings-detail-hero">
      <Link href="/settings/" className="settings-detail-back">← Settings</Link>
      <span className="compass-settings-section-kicker">People &amp; appointment routing</span>
      <h1>Technology consultants &amp; scheduling</h1>
      <p>Maintain the consultant roster used during onsite planning and remote consultation scheduling. When a scheduled consultant matches this roster, their contact information is carried into the final client PDF beside the Client Success Manager.</p>
      <div className="settings-detail-scope-row"><span>Onsite planning</span><span>Remote consultations</span><span>Client PDF contact cards</span><span>Included in backup</span></div>
    </header>

    <section className="compass-settings-section consultant-roster-section">
      <div className="compass-settings-section-heading consultant-roster-heading">
        <div><span className="compass-settings-section-kicker">Consultant roster</span><h2>Who can be selected during a presentation</h2><p>The Microsoft 365 calendar email/UPN is kept separately from the public contact email so Outlook availability can be connected cleanly later.</p></div>
        <button className="button secondary" type="button" onClick={() => { setMessage(""); setContacts((current) => [...current, blankConsultant()]); }}>+ Add consultant</button>
      </div>

      <div className="consultant-roster-list">
        {contacts.map((contact, index) => <article className="consultant-roster-card" key={`${contact.name}-${index}`}>
          <div className="consultant-roster-card-head">
            <div><span>Consultant {String(index + 1).padStart(2, "0")}</span><strong>{contact.name.trim() || "New consultant"}</strong></div>
            <button type="button" onClick={() => { setMessage(""); setContacts((current) => current.filter((_, itemIndex) => itemIndex !== index)); }}>Remove</button>
          </div>
          <div className="consultant-roster-fields">
            <label><span>Name</span><input value={contact.name} placeholder="Technology Consultant name" onChange={(event) => updateContact(index, { name: event.target.value })}/></label>
            <label><span>Role / title</span><input value={contact.role} placeholder="Technology Consultant" onChange={(event) => updateContact(index, { role: event.target.value })}/></label>
            <label><span>Phone</span><input value={contact.phone ?? ""} placeholder="877.723.8832 x000" onChange={(event) => updateContact(index, { phone: event.target.value })}/></label>
            <label><span>Mobile</span><input value={contact.mobile ?? ""} placeholder="Optional mobile number" onChange={(event) => updateContact(index, { mobile: event.target.value })}/></label>
            <label><span>Contact email</span><input type="email" value={contact.email ?? ""} placeholder="name@adv-tech.com" onChange={(event) => updateContact(index, { email: event.target.value })}/></label>
            <label><span>Website</span><input value={contact.web ?? ""} placeholder="adv.tech" onChange={(event) => updateContact(index, { web: event.target.value })}/></label>
            <label className="consultant-calendar-field"><span>Microsoft 365 calendar email / UPN</span><input type="email" value={contact.calendarEmail ?? ""} placeholder="Calendar identity used for Outlook availability" onChange={(event) => updateContact(index, { calendarEmail: event.target.value })}/><small>This can differ from the contact email. It will be the lookup identity for free/busy availability.</small></label>
            <label><span>Name aliases</span><input value={(contact.aliases ?? []).join(", ")} placeholder="Optional alternate names, comma separated" onChange={(event) => updateContact(index, { aliases: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}/></label>
          </div>
        </article>)}
      </div>
    </section>

    <section className="consultant-calendar-readiness">
      <span className="compass-settings-section-kicker">Calendar readiness</span>
      <div><strong>Roster first. Live Outlook availability next.</strong><p>The scheduler already uses the same appointment model for onsite and remote meetings. The roster now gives each consultant one stable identity that can be used for both contact matching and a future Microsoft Graph free/busy lookup.</p></div>
    </section>

    {message && <div className="compass-workspace-success" role="status">{message}</div>}
    <footer className="compass-settings-savebar compass-settings-savebar-clean settings-detail-savebar consultant-settings-savebar">
      <button className="button secondary" type="button" onClick={() => { setMessage(""); setContacts(cloneContacts(DEFAULT_CONSULTANT_CONTACTS)); }}>Reset draft to defaults</button>
      <span>Saved roster settings are persistent browser preferences and are included in the normal Client Compass master backup/restore.</span>
      <button className="button primary" type="button" onClick={save}>Save consultant roster</button>
    </footer>
  </div>;
}
