import type { Project, RemoteAccessAuditEntry } from "@/lib/projects/types";
import { remoteAccessAuditCounts, remoteAccessEntries } from "@/lib/security/remote-access-audit";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function status(entry: RemoteAccessAuditEntry): { label: string; ink: string; surface: string } {
  if (entry.status === "needed") return { label: "YES — KEEP ACCESS", ink: "#0b7862", surface: "#e5f8f2" };
  if (entry.status === "remove" && entry.removalVerifiedAt) return { label: "REMOVAL VERIFIED", ink: "#116c6a", surface: "#e5f8f8" };
  if (entry.status === "remove") return { label: "NO — REMOVE ACCESS", ink: "#aa5b32", surface: "#fff1e0" };
  return { label: "NOT YET REVIEWED", ink: "#55708b", surface: "#ebf2f7" };
}

function displayDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed);
}

/**
 * Print-friendly, evidence-oriented access review. Audit decisions do not revoke access.
 * Only render after an entry is explicitly added; never create imaginary GoToMyPC accounts.
 */
export function remoteAccessAuditReportHtml(project: Project, pageClass = "pdf-page", footerHtml = ""): string {
  const entries = remoteAccessEntries(project);
  if (!project.hipaa.enabled || !entries.length) return "";
  const totals = remoteAccessAuditCounts(entries);
  const chunkSize = 7;
  const pages: RemoteAccessAuditEntry[][] = [];
  for (let index = 0; index < entries.length; index += chunkSize) pages.push(entries.slice(index, index + chunkSize));

  return pages.map((items, pageIndex) => `<section class="${escapeHtml(pageClass)} pdf-remote-access-review" data-pdf-page="true">
    <header style="padding:4px 0 19px;border-bottom:1px solid #d5e4ef">
      <span style="display:block;font-size:9px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#197eae">ACCESS CONTROL · SECURITY SAFEGUARDS</span>
      <h2 style="font-size:30px;letter-spacing:-.05em;line-height:1.08;color:#092e50;margin:7px 0 8px">Remote access review</h2>
      <p style="font-size:12px;line-height:1.5;color:#526e86;margin:0">A record of which remote access connections the client wishes to retain or review for removal. Accounts are not disabled by choosing “No.” ${pages.length > 1 ? `Page ${pageIndex + 1} of ${pages.length}.` : ""}</p>
    </header>
    <div style="display:flex;gap:10px;margin:18px 0 15px">
      <div style="flex:1;background:#eff7ff;border:1px solid #c8dfea;border-radius:13px;padding:12px"><strong style="display:block;font-size:23px;color:#115588">${entries.length}</strong><span style="font-size:10px;color:#56728b;font-weight:760">Accounts listed</span></div>
      <div style="flex:1;background:#eaf9f4;border:1px solid #c3e6d8;border-radius:13px;padding:12px"><strong style="display:block;font-size:23px;color:#0c8a71">${totals.needed}</strong><span style="font-size:10px;color:#56728b;font-weight:760">Retain access</span></div>
      <div style="flex:1;background:#fff1e8;border:1px solid #efd5bd;border-radius:13px;padding:12px"><strong style="display:block;font-size:23px;color:#b77338">${totals.removalNeeded}</strong><span style="font-size:10px;color:#56728b;font-weight:760">Removal to verify</span></div>
      <div style="flex:1;background:#eff4f9;border:1px solid #d6e0e8;border-radius:13px;padding:12px"><strong style="display:block;font-size:23px;color:#426a89">${totals.unreviewed}</strong><span style="font-size:10px;color:#56728b;font-weight:760">Not reviewed</span></div>
    </div>
    <div style="display:grid;gap:10px;align-content:start">
      ${items.map((entry, index) => {
        const choice = status(entry);
        const notes = [entry.assignedTo && `User / purpose: ${entry.assignedTo}`, entry.notes, entry.reviewedAt && `Decision: ${displayDate(entry.reviewedAt)}`, entry.removalVerifiedAt && `Removal verified: ${displayDate(entry.removalVerifiedAt)}`].filter(Boolean).map(escapeHtml).join(" · ");
        return `<article style="display:flex;gap:13px;align-items:flex-start;padding:14px;border:1px solid #d7e6f0;background:#f7fbff;border-radius:13px;break-inside:avoid">
          <span style="display:grid;place-items:center;flex:0 0 28px;height:28px;border-radius:9px;background:#0f639f;color:white;font-size:11px;font-weight:850">${String(pageIndex * chunkSize + index + 1).padStart(2, "0")}</span>
          <div style="flex:1;min-width:0"><span style="display:block;font-size:9px;font-weight:800;letter-spacing:.07em;color:#54748a">${escapeHtml(entry.software || "Remote access tool")}</span><strong style="display:block;margin:3px 0 5px;color:#123b5c;font-size:14px">${escapeHtml(entry.account || "Account name to confirm")}</strong>${notes ? `<small style="display:block;color:#567188;line-height:1.35;font-size:9px">${notes}</small>` : ""}</div>
          <strong style="flex:0 0 auto;max-width:138px;background:${choice.surface};color:${choice.ink};border-radius:100px;padding:8px 9px;text-align:center;font-size:9px;line-height:1.2">${escapeHtml(choice.label)}</strong>
        </article>`;
      }).join("")}
    </div>
    <aside style="margin-top:15px;padding:13px 15px;border-left:4px solid #269cbe;background:#eff8fc;color:#496c82;font-size:10px;line-height:1.5">
      <strong style="display:block;color:#115d87;margin-bottom:3px">SECURE REMOVAL FOLLOW-UP</strong>
      ${totals.removalNeeded ? `${totals.removalNeeded} account(s) are flagged as no longer needed. Confirm the owner, disable or revoke access in the actual service, and verify the removal separately.` : "No account is currently flagged for unverified removal."}
      This audit does not modify remote-access software, subscriptions, or permissions. Do not include passwords or other credentials.
    </aside>
    ${footerHtml}
  </section>`).join("");
}
