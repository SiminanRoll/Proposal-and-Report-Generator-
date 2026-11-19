"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import type { Project, RemoteAccessAuditEntry, RemoteAccessAuditStatus } from "@/lib/projects/types";
import {
  addRemoteAccessEntry,
  remoteAccessEntries,
  remoteAccessRemovalEntries,
  remoteAccessSupportHandoffText,
  removeRemoteAccessAuditEntry,
  updateRemoteAccessEntry,
} from "@/lib/security/remote-access-audit";
import styles from "./security-review-premium.module.css";

const SUGGESTED_TOOLS = ["GoToMyPC", "ScreenConnect / ConnectWise Control", "TeamViewer", "AnyDesk", "Splashtop", "RemotePC", "Chrome Remote Desktop", "Windows Remote Desktop", "Other"];

function AccountName({ entry }: { entry: RemoteAccessAuditEntry }) {
  return <><strong>{entry.software.trim() || "Remote access"}</strong><span>{entry.account.trim() || "Email not recorded"}</span>{entry.assignedTo.trim() && <small>{entry.assignedTo}</small>}</>;
}

export function RemoteAccessAuditPresentation({
  project, onUpdate,
}: {
  project: Project; onUpdate: (project: Project) => void;
}) {
  const entries = remoteAccessEntries(project);
  const removals = remoteAccessRemovalEntries(project);
  const add = (software: string) => onUpdate(addRemoteAccessEntry(project, software));
  const patch = (id: string, value: Partial<RemoteAccessAuditEntry>) => onUpdate(updateRemoteAccessEntry(project, id, value));

  return (
    <section className={[styles.accessRoot, styles.accessSimpleRoot].join(" ")} data-presentation-interactive="true" aria-labelledby="remote-access-heading">
      <header className={styles.accessSimpleHeader}>
        <span className={styles.accessSimpleEyebrow}>REMOTE ACCESS REVIEW</span>
        <h2 id="remote-access-heading">Remote access accounts</h2>
        <p>Which accounts should stay active?</p>
      </header>
      <div className={styles.accessSimpleBody}>
        <div className={styles.accessSimpleToolbar}>
          <strong>{entries.length} {entries.length === 1 ? "account" : "accounts"}</strong>
          <div>
            <button className={styles.accessSimpleAdd} type="button" onClick={() => add("GoToMyPC")}>+ GoToMyPC</button>
            <button className={styles.accessSimpleAddAlt} type="button" onClick={() => add("Other")}>+ Other software</button>
          </div>
        </div>
        {entries.length === 0
          ? <div className={styles.accessSimpleEmpty}>No accounts listed. Add a GoToMyPC account or another remote-access program to begin.</div>
          : <div className={styles.accessSimpleList}>
            <div className={styles.accessSimpleColumnHead} aria-hidden="true"><span>Software</span><span>Account email / user</span><span>Keep or remove</span></div>
            {entries.map((entry, index) => (
              <div className={styles.accessSimpleRow} key={entry.id}>
                <label className={styles.accessSimpleField}>
                  <span>Software</span>
                  <input list={"remote-tools-" + entry.id} autoComplete="off" value={entry.software} placeholder="Remote access software" onChange={(event: ChangeEvent<HTMLInputElement>) => patch(entry.id, { software: event.target.value })} />
                  <datalist id={"remote-tools-" + entry.id}>{SUGGESTED_TOOLS.map((tool) => <option key={tool} value={tool} />)}</datalist>
                </label>
                <div className={styles.accessSimpleAccount}>
                  <label className={styles.accessSimpleField}>
                    <span>Account email</span>
                    <input autoComplete="off" inputMode="email" value={entry.account} placeholder="name@example.com" onChange={(event: ChangeEvent<HTMLInputElement>) => patch(entry.id, { account: event.target.value })} />
                  </label>
                  <label className={styles.accessSimpleField}>
                    <span>User / device (optional)</span>
                    <input autoComplete="off" value={entry.assignedTo} placeholder="Assigned user" onChange={(event: ChangeEvent<HTMLInputElement>) => patch(entry.id, { assignedTo: event.target.value })} />
                  </label>
                </div>
                <fieldset className={styles.accessSimpleDecision}>
                  <legend>Keep or remove</legend>
                  <label className={[styles.accessSimpleChoice, entry.status === "needed" ? styles.accessSimpleKeep : ""].join(" ")}>
                    <input type="radio" name={"remote-" + entry.id} checked={entry.status === "needed"} onChange={() => patch(entry.id, { status: "needed" as RemoteAccessAuditStatus })} />
                    <span>Keep</span>
                  </label>
                  <label className={[styles.accessSimpleChoice, entry.status === "remove" ? styles.accessSimpleRemove : ""].join(" ")}>
                    <input type="radio" name={"remote-" + entry.id} checked={entry.status === "remove"} onChange={() => patch(entry.id, { status: "remove" as RemoteAccessAuditStatus })} />
                    <span>Remove</span>
                  </label>
                </fieldset>
                <button className={styles.accessSimpleDelete} type="button" aria-label={"Remove row " + (index + 1) + " from review"} title="Remove this row from the review" onClick={() => onUpdate(removeRemoteAccessAuditEntry(project, entry.id))}>×</button>
              </div>
            ))}
          </div>}
        {removals.length > 0 && <div className={styles.accessSimpleQueue}>
          <strong>{removals.length} marked for Support removal</strong>
          <span>{removals.map((item) => [item.software, item.account].filter(Boolean).join(" · ")).join("  |  ")}</span>
        </div>}
      </div>
    </section>
  );
}

export function RemoteAccessSupportHandoffPresentation({ project }: { project: Project }) {
  const removals = remoteAccessRemovalEntries(project);
  const [copyMessage, setCopyMessage] = useState("");
  async function copyForSupport() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(remoteAccessSupportHandoffText(project));
      setCopyMessage("Copied for Support");
    } catch {
      setCopyMessage("Select the list to copy");
    }
  }
  if (!removals.length) return null;
  return (
    <section className={[styles.accessRoot, styles.accessHandoffRoot].join(" ")} data-presentation-interactive="true" aria-labelledby="remote-handoff-heading">
      <header className={styles.accessSimpleHeader}>
        <span className={styles.accessSimpleEyebrow}>FOLLOW-UP FOR ADVANTAGE SUPPORT</span>
        <h2 id="remote-handoff-heading">Remote access to remove</h2>
        <p>We&apos;ll coordinate these access and account changes with our support team.</p>
      </header>
      <div className={styles.accessHandoffBody}>
        <div className={styles.accessHandoffList}>
          {removals.map((entry) => <article key={entry.id} className={styles.accessHandoffItem}>
            <AccountName entry={entry} />
            <span className={styles.accessHandoffStatus}>Remove</span>
          </article>)}
        </div>
        <button type="button" className={styles.accessSimpleAdd} onClick={copyForSupport}>Copy list for Support</button>
        <span className={styles.accessCopyMessage} role="status">{copyMessage}</span>
      </div>
    </section>
  );
}
