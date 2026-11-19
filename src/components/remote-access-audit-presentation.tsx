"use client";

import type { ChangeEvent } from "react";
import type { Project, RemoteAccessAuditEntry, RemoteAccessAuditStatus } from "@/lib/projects/types";
import {
  addRemoteAccessEntry,
  remoteAccessAuditCounts,
  remoteAccessEntries,
  removeRemoteAccessAuditEntry,
  updateRemoteAccessEntry,
} from "@/lib/security/remote-access-audit";
import styles from "./security-review-premium.module.css";

const SUGGESTED_TOOLS = ["GoToMyPC", "ScreenConnect / ConnectWise Control", "TeamViewer", "AnyDesk", "Splashtop", "RemotePC", "Chrome Remote Desktop", "Windows Remote Desktop", "Other"];

function ShortStatus({ entry }: { entry: RemoteAccessAuditEntry }) {
  if (entry.status === "needed") return <span className={styles.accessCurrent}>Approved to retain</span>;
  if (entry.status === "remove" && entry.removalVerifiedAt) return <span className={styles.accessVerified}>Removal verified</span>;
  if (entry.status === "remove") return <span className={styles.accessRemove}>Removal recommended</span>;
  return <span className={styles.accessUnknown}>Needs review</span>;
}

export function RemoteAccessAuditPresentation({
  project, onUpdate,
}: {
  project: Project; onUpdate: (project: Project) => void;
}) {
  const entries = remoteAccessEntries(project);
  const counts = remoteAccessAuditCounts(entries);
  const reviewTotal = counts.needed + counts.removalNeeded + counts.removedVerified;
  const add = (software: string) => onUpdate(addRemoteAccessEntry(project, software));
  const patch = (id: string, value: Partial<RemoteAccessAuditEntry>) => onUpdate(updateRemoteAccessEntry(project, id, value));

  return (
    <section className={styles.accessRoot} data-presentation-interactive="true" aria-labelledby="remote-access-heading">
      <div className={styles.accessGlow} aria-hidden="true" />
      <header className={styles.accessHero}>
        <div className={styles.accessBrand}>SECURITY REVIEW <span> / </span> ACCESS CONTROL</div>
        <div className={styles.accessHeading}>
          <div>
            <span className={styles.eyebrow}>WHO CAN STILL CONNECT?</span>
            <h2 id="remote-access-heading">Remote access, under control.</h2>
            <p>Let's review every remote-access program and account that may still open a path into your systems. Confirm which ones your team needs, then flag the rest for secure removal.</p>
          </div>
          <div className={styles.accessShield} aria-hidden="true"><span>✓</span></div>
        </div>
        <div className={styles.accessMetrics}>
          <div><b>{entries.length}</b><span>Listed accounts</span></div>
          <div><b>{reviewTotal}</b><span>Decisions recorded</span></div>
          <div className={counts.removalNeeded ? styles.metricAttention : ""}><b>{counts.removalNeeded}</b><span>Pending removal</span></div>
        </div>
      </header>

      <div className={styles.accessBody}>
        <div className={styles.accessIntro}>
          <div><span className={styles.eyebrow}>ACCESS INVENTORY</span><h3>Review each connection.</h3><p>List individual GoToMyPC accounts separately, even when several use the same software. Add other remote-access programs in use.</p></div>
          <div className={styles.accessAddActions}>
            <button type="button" className={styles.accessPrimary} onClick={() => add("GoToMyPC")}><span aria-hidden="true">＋</span> GoToMyPC account</button>
            <button type="button" className={styles.accessSecondary} onClick={() => add("Other")}>＋ Other software</button>
          </div>
        </div>

        {entries.length === 0 ? <div className={styles.accessEmpty}>
          <div className={styles.accessEmptyIcon} aria-hidden="true">⌘</div>
          <h4>No accounts listed yet.</h4>
          <p>Add the current GoToMyPC accounts or any other remote-access tools. Nothing will be marked active or unnecessary until someone reviews it.</p>
          <button type="button" onClick={() => add("GoToMyPC")}>Start with GoToMyPC <span aria-hidden="true">→</span></button>
        </div> : <div className={styles.accessList}>
          {entries.map((entry, index) => <article className={styles.accessEntry} key={entry.id}>
            <div className={styles.entryTop}>
              <div className={styles.entryNumber}>{String(index + 1).padStart(2, "0")}</div>
              <div className={styles.entryName}><strong>{entry.account.trim() || entry.software || "Remote access account"}</strong><ShortStatus entry={entry} /></div>
              <button className={styles.entryDelete} type="button" aria-label={`Remove audit row ${index + 1}`} title="Delete this audit row only. Does not delete a remote-access account." onClick={() => onUpdate(removeRemoteAccessAuditEntry(project, entry.id))}>×</button>
            </div>
            <div className={styles.entryFields}>
              <label><span>Remote access software</span><input list={`remote-tools-${entry.id}`} autoComplete="off" value={entry.software} onChange={(event: ChangeEvent<HTMLInputElement>) => patch(entry.id, { software: event.target.value })} placeholder="e.g. GoToMyPC" /><datalist id={`remote-tools-${entry.id}`}>{SUGGESTED_TOOLS.map((tool) => <option key={tool} value={tool} />)}</datalist></label>
              <label><span>Account / connection label</span><input autoComplete="off" value={entry.account} onChange={(event: ChangeEvent<HTMLInputElement>) => patch(entry.id, { account: event.target.value })} placeholder="Username or device label (no passwords)" /></label>
              <label><span>Assigned user / purpose</span><input autoComplete="off" value={entry.assignedTo} onChange={(event: ChangeEvent<HTMLInputElement>) => patch(entry.id, { assignedTo: event.target.value })} placeholder="Who still uses this?" /></label>
            </div>
            <fieldset className={styles.entryDecision}>
              <legend>Is this connection still needed?</legend>
              <div className={styles.entryChoices}>
                <label className={`${styles.entryChoice} ${entry.status === "needed" ? styles.choiceNeeded : ""}`}>
                  <input type="radio" name={`access-${entry.id}`} checked={entry.status === "needed"} onChange={() => patch(entry.id, { status: "needed" as RemoteAccessAuditStatus })} />
                  <span className={styles.entryCheck} aria-hidden="true">{entry.status === "needed" ? "✓" : ""}</span><span><strong>Yes, still active</strong><small>Keep access approved</small></span>
                </label>
                <label className={`${styles.entryChoice} ${entry.status === "remove" ? styles.choiceRemove : ""}`}>
                  <input type="radio" name={`access-${entry.id}`} checked={entry.status === "remove"} onChange={() => patch(entry.id, { status: "remove" as RemoteAccessAuditStatus })} />
                  <span className={styles.entryCheck} aria-hidden="true">{entry.status === "remove" ? "✓" : ""}</span><span><strong>No, do not need</strong><small>Flag for removal</small></span>
                </label>
                <button className={styles.entryClear} type="button" disabled={entry.status === "unreviewed"} onClick={() => patch(entry.id, { status: "unreviewed" })}>Not reviewed</button>
              </div>
            </fieldset>
            <div className={styles.entryFooter}>
              <label><span>Review note / requested action</span><input value={entry.notes} onChange={(event: ChangeEvent<HTMLInputElement>) => patch(entry.id, { notes: event.target.value })} placeholder="Optional, e.g. verify with office manager" /></label>
              {entry.status === "remove" && <label className={styles.removeVerified}>
                <input type="checkbox" checked={Boolean(entry.removalVerifiedAt)} onChange={(event) => patch(entry.id, { removalVerifiedAt: event.target.checked ? new Date().toISOString() : "" })} />
                <span>Removal actually verified</span>
              </label>}
              {entry.reviewedAt && <small className={styles.reviewedAt}>Decision recorded {new Date(entry.reviewedAt).toLocaleDateString()}</small>}
            </div>
          </article>)}
        </div>}

        <aside className={styles.accessFootnote}>
          <div aria-hidden="true" className={styles.accessFootnoteIcon}>!</div>
          <p><strong>A review choice is not a removal action.</strong> Selecting “No, do not need” creates an item for Advantage and the client to verify and securely disable. It does not deactivate a tool, terminate a subscription, or revoke access automatically. Do not record passwords or credentials here.</p>
        </aside>
      </div>
    </section>
  );
}
