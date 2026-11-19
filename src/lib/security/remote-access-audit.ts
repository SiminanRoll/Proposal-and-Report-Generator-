import type { Project, RemoteAccessAuditEntry, RemoteAccessAuditStatus } from "@/lib/projects/types";

function stamp(): string { return new Date().toISOString(); }
function nextId(): string { return `remote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

export function remoteAccessEntries(project: Project): RemoteAccessAuditEntry[] {
  return Array.isArray(project.remoteAccessAudit?.entries) ? project.remoteAccessAudit.entries : [];
}

export function remoteAccessAuditCounts(entries: RemoteAccessAuditEntry[]) {
  return {
    reviewed: entries.filter((entry) => entry.status !== "unreviewed").length,
    needed: entries.filter((entry) => entry.status === "needed").length,
    removalNeeded: entries.filter((entry) => entry.status === "remove" && !entry.removalVerifiedAt).length,
    removedVerified: entries.filter((entry) => entry.status === "remove" && !!entry.removalVerifiedAt).length,
    unreviewed: entries.filter((entry) => entry.status === "unreviewed").length,
  };
}

function replaceEntries(project: Project, entries: RemoteAccessAuditEntry[]): Project {
  return { ...project, remoteAccessAudit: { entries, updatedAt: stamp() } };
}

/** The audit is a list of review decisions. It never connects to or deletes remote-access accounts. */
export function addRemoteAccessEntry(project: Project, software = "GoToMyPC"): Project {
  return replaceEntries(project, [...remoteAccessEntries(project), {
    id: nextId(), software, account: "", assignedTo: "",
    status: "unreviewed", notes: "", reviewedAt: "", removalVerifiedAt: "",
  }]);
}

export function updateRemoteAccessEntry(
  project: Project,
  id: string,
  patch: Partial<Pick<RemoteAccessAuditEntry, "software" | "account" | "assignedTo" | "status" | "notes" | "removalVerifiedAt">>,
): Project {
  const entries = remoteAccessEntries(project).map((entry) => {
    if (entry.id !== id) return entry;
    const changedStatus = patch.status !== undefined && patch.status !== entry.status;
    const status: RemoteAccessAuditStatus = patch.status ?? entry.status;
    const removalVerifiedAt = status !== "remove" ? "" :
      patch.removalVerifiedAt !== undefined ? patch.removalVerifiedAt :
      changedStatus ? "" : entry.removalVerifiedAt;
    return {
      ...entry,
      ...patch,
      status,
      removalVerifiedAt,
      reviewedAt: changedStatus ? (status === "unreviewed" ? "" : stamp()) : entry.reviewedAt,
    };
  });
  return replaceEntries(project, entries);
}

export function removeRemoteAccessAuditEntry(project: Project, id: string): Project {
  return replaceEntries(project, remoteAccessEntries(project).filter((entry) => entry.id !== id));
}
