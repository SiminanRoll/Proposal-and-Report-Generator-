import type { Project, RemoteAccessAuditEntry } from "@/lib/projects/types";
import { hasRemoteAccessSource, remoteAccessEntries, remoteAccessRemovalEntries } from "@/lib/security/remote-access-audit";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function status(entry: RemoteAccessAuditEntry): { label: string; ink: string; surface: string } {
  if (entry.status === "needed") return { label: "KEEP", ink: "#0b7862", surface: "#e5f8f2" };
  if (entry.status === "remove" && entry.removalVerifiedAt) return { label: "REMOVED", ink: "#116c6a", surface: "#e5f8f8" };
  if (entry.status === "remove") return { label: "REMOVE", ink: "#aa5b32", surface: "#fff1e0" };
  return { label: "NOT REVIEWED", ink: "#55708b", surface: "#ebf2f7" };
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
  if (!hasRemoteAccessSource(project) || !entries.length) return "";
  const chunkSize = 7;
  const pages: RemoteAccessAuditEntry[][] = [];
  for (let index = 0; index < entries.length; index += chunkSize) pages.push(entries.slice(index, index + chunkSize));

  return pages.map((items, pageIndex) => `<section class="${escapeHtml(pageClass)} pdf-remote-access-review" data-pdf-page="true">
    <header style="padding:4px 0 19px;border-bottom:1px solid #d5e4ef">
      <span style="display:block;font-size:9px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#197eae">REMOTE ACCESS REVIEW</span>
      <h2 style="font-size:30px;letter-spacing:-.05em;line-height:1.08;color:#092e50;margin:7px 0 8px">Remote access review</h2>
      <p style="font-size:12px;line-height:1.5;color:#526e86;margin:0">${pages.length > 1 ? `Page ${pageIndex + 1} of ${pages.length}.` : ""}</p>
    </header>
    <div style="display:grid;gap:10px;align-content:start">
      ${items.map((entry, index) => {
        const choice = status(entry);
        const notes = [entry.assignedTo && `User / device: ${entry.assignedTo}`, entry.notes, entry.reviewedAt && `Decision: ${displayDate(entry.reviewedAt)}`, entry.removalVerifiedAt && `Removal verified: ${displayDate(entry.removalVerifiedAt)}`].filter(Boolean).map(escapeHtml).join(" · ");
        return `<article style="display:flex;gap:13px;align-items:flex-start;padding:14px;border:1px solid #d7e6f0;background:#f7fbff;border-radius:13px;break-inside:avoid">
          <span style="display:grid;place-items:center;flex:0 0 28px;height:28px;border-radius:9px;background:#0f639f;color:white;font-size:11px;font-weight:850">${String(pageIndex * chunkSize + index + 1).padStart(2, "0")}</span>
          <div style="flex:1;min-width:0"><span style="display:block;font-size:9px;font-weight:800;letter-spacing:.07em;color:#54748a">${escapeHtml(entry.software || "Remote access tool")}</span><strong style="display:block;margin:3px 0 5px;color:#123b5c;font-size:14px">${escapeHtml(entry.account || "Email not recorded")}</strong>${notes ? `<small style="display:block;color:#567188;line-height:1.35;font-size:9px">${notes}</small>` : ""}</div>
          <strong style="flex:0 0 auto;max-width:138px;background:${choice.surface};color:${choice.ink};border-radius:100px;padding:8px 9px;text-align:center;font-size:9px;line-height:1.2">${escapeHtml(choice.label)}</strong>
        </article>`;
      }).join("")}
    </div>
    ${footerHtml}
  </section>`).join("");
}


/** Final, actionable Support-only handoff; only unfinished removal requests are included. */
export function remoteAccessRemovalHandoffHtml(project: Project, pageClass = "pdf-page", footerHtml = ""): string {
  const rows = remoteAccessRemovalEntries(project);
  if (!hasRemoteAccessSource(project) || !rows.length) return "";
  const items = rows.map((entry, index) =>
    '<article style="display:flex;justify-content:space-between;gap:16px;padding:13px 15px;margin-bottom:9px;background:#f6fbff;border:1px solid #c9e0ed;border-radius:12px;break-inside:avoid">' +
      '<div><strong style="color:#123b5c;font-size:14px">' + (index + 1) + '. ' + escapeHtml(entry.software.trim() || "Remote access software") + '</strong>' +
      '<p style="color:#345d76;font-size:12px;margin:5px 0">Account email: ' + escapeHtml(entry.account.trim() || "Not recorded") + '</p>' +
      (entry.assignedTo.trim() ? '<small style="color:#57768b">User / device: ' + escapeHtml(entry.assignedTo) + '</small>' : "") +
      (entry.notes.trim() ? '<small style="display:block;color:#57768b">Notes: ' + escapeHtml(entry.notes) + '</small>' : "") +
      '</div><strong style="color:#a6532b;font-size:11px;white-space:nowrap">REMOVE</strong></article>'
  ).join("");
  return '<section class="' + escapeHtml(pageClass) + ' pdf-remote-access-handoff" data-pdf-page="true">' +
    '<header style="padding-bottom:18px;border-bottom:1px solid #c7dbe8">' +
      '<span style="color:#147ea6;font-size:10px;font-weight:900;letter-spacing:.16em">FOLLOW-UP FOR ADVANTAGE SUPPORT</span>' +
      '<h2 style="font-size:29px;color:#103a5c;margin:8px 0">Remote access to remove</h2>' +
      '<p style="font-size:12px;color:#5a7185;margin:0">Please remove the listed access and review related account licenses or billing.</p>' +
    '</header><div style="margin-top:18px">' + items + '</div>' + footerHtml + '</section>';
}
