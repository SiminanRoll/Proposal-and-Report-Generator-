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


/** Open support requests only. Review choices never disable remote software or subscriptions. */
export function remoteAccessRemovalEntries(project: Project): RemoteAccessAuditEntry[] {
  return remoteAccessEntries(project).filter((entry) => entry.status === "remove" && !entry.removalVerifiedAt);
}

/** Plain text that Patric can copy directly into a Support ticket. No credentials or API calls. */
export function remoteAccessSupportHandoffText(project: Project): string {
  const client = project.client?.name?.trim() || "Client";
  const rows = remoteAccessRemovalEntries(project);
  return [
    "Remote access removal requests - " + client,
    "",
    ...rows.map((entry, index) => [
      String(index + 1) + ". " + (entry.software.trim() || "Remote access software"),
      "Account email: " + (entry.account.trim() || "Not recorded"),
      ...(entry.assignedTo.trim() ? ["User / device: " + entry.assignedTo.trim()] : []),
      ...(entry.notes.trim() ? ["Notes: " + entry.notes.trim()] : []),
      "Action: Remove access and review related licensing / billing.",
      "",
    ].join("\n")),
  ].join("\n").trim();
}


export function hasRemoteAccessSource(project: Project): boolean {
  return project.sources.some((source) => source.kind === "remote-access-inventory"
    && source.files.some((file) => file.status !== "failed" && file.analysis?.sourceType === "remote-access"));
}

/** Add only newly imported accounts. Existing human Keep/Remove choices remain intact. */
export function withImportedRemoteAccess(project: Project): Project {
  const source = project.sources.find((item) => item.kind === "remote-access-inventory");
  const files = source?.files ?? [];
  const existing = remoteAccessEntries(project);
  const entries = [...existing];
  const keys = new Set(existing.map((entry) => (entry.software.trim().toLowerCase() + "|" + entry.account.trim().toLowerCase())));
  for (const file of files) {
    const fact = file.analysis?.facts.find((item) => item.key === "remoteAccess.candidates");
    const values = Array.isArray(fact?.value) ? fact.value : [];
    for (const raw of values) {
      try {
        const row = JSON.parse(String(raw)) as { software?: unknown; account?: unknown; assignedTo?: unknown };
        const account = String(row.account ?? "").trim();
        const software = String(row.software ?? "Remote access").trim() || "Remote access";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) continue;
        const key = software.toLowerCase() + "|" + account.toLowerCase();
        if (keys.has(key)) continue;
        keys.add(key);
        entries.push({
          id: nextId(), software, account, assignedTo: String(row.assignedTo ?? "").trim().slice(0, 80),
          status: "unreviewed", notes: "", reviewedAt: "", removalVerifiedAt: "",
        });
      } catch { /* Ignore malformed extracted rows without losing previously reviewed accounts. */ }
    }
  }
  return entries.length === existing.length ? project : replaceEntries(project, entries);
}
