import type { ProjectCoverageClient, ProjectCoveragePosition, QuoteAgeBand } from "./project-coverage";

const DAY_MS = 24 * 60 * 60 * 1000;

export function validDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysSince(value: string, now = new Date()): number | null {
  const date = validDate(value);
  if (!date) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

export function monthsSince(value: string, now = new Date()): number | null {
  const days = daysSince(value, now);
  return days === null ? null : Math.floor(days / 30.4375);
}

export function quoteAgeBand(value: string, now = new Date()): QuoteAgeBand {
  const days = daysSince(value, now);
  if (days === null) return "date-missing";
  if (days <= 90) return "recent";
  if (days <= 180) return "follow-up";
  if (days <= 365) return "re-engagement";
  return "revisit";
}

function technicalRank(client: ProjectCoverageClient): number {
  if (client.hasCriticalServer) return 0;
  if (client.serverProjectCount) return 1;
  return 2;
}

function oldestFirst(value: string): number {
  const date = validDate(value);
  return date ? date.getTime() : Number.NEGATIVE_INFINITY;
}


export function compareCoverageClients(position: ProjectCoveragePosition, left: ProjectCoverageClient, right: ProjectCoverageClient): number {
  if (position === "needs-review") {
    return technicalRank(left) - technicalRank(right)
      || Number(right.noRelationshipHistory) - Number(left.noRelationshipHistory)
      || right.technicalSeverity - left.technicalSeverity
      || right.estimatedValue - left.estimatedValue
      || left.clientName.localeCompare(right.clientName);
  }
  if (position === "discussed-open") {
    return Number(right.followUpPastDue) - Number(left.followUpPastDue)
      || oldestFirst(left.reviewDate) - oldestFirst(right.reviewDate)
      || technicalRank(left) - technicalRank(right)
      || Number(right.missingDocumentedOutcome) - Number(left.missingDocumentedOutcome)
      || right.estimatedValue - left.estimatedValue
      || left.clientName.localeCompare(right.clientName);
  }
  const quotedPriority = (client: ProjectCoverageClient): number => {
    if (client.quoteAgeBand === "revisit") return 0;
    if (client.reviewHistoryMissing) return 1;
    if (client.quoteAgeBand === "re-engagement") return 2;
    if (client.quoteAgeBand === "follow-up" || client.quoteAgeBand === "date-missing") return 3;
    return 4;
  };
  return quotedPriority(left) - quotedPriority(right)
    || technicalRank(left) - technicalRank(right)
    || right.estimatedValue - left.estimatedValue
    || left.clientName.localeCompare(right.clientName);
}

function workstationDescription(client: ProjectCoverageClient): string {
  const count = client.workstationDeviceCount;
  return `${count} aging workstation${count === 1 ? "" : "s"}`;
}

export function coveragePriorityReason(client: ProjectCoverageClient, now = new Date()): string {
  if (client.position === "needs-review") {
    if (client.hasCriticalServer) return "Critical server concern with no review or quote recorded";
    if (client.serverProjectCount) return "Server project need with no review or quote recorded";
    return `${workstationDescription(client)} with no review or quote recorded`;
  }

  if (client.position === "quoted-open") {
    const months = monthsSince(client.quoteDate, now);
    const age = months === null ? "Quote recorded without a date" : `Quote issued ${months} month${months === 1 ? "" : "s"} ago`;
    return client.reviewHistoryMissing ? `${age}; review history is missing` : `${age}; no completed outcome is recorded`;
  }

  const months = monthsSince(client.reviewDate, now);
  const age = months === null ? "Client discussion recorded" : `Reviewed ${months} month${months === 1 ? "" : "s"} ago`;
  const need = client.serverProjectCount ? "server project" : workstationDescription(client);
  return `${need.charAt(0).toUpperCase()}${need.slice(1)} ${age.toLowerCase()} with no documented next step`;
}
