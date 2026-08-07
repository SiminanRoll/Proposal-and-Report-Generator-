"use client";

import type { ProjectCoverageClient } from "@/lib/compass/project-coverage";

export type ProjectCoverageReasonFilter = "all" | "server" | "workstations" | "unsupported";

const FILTERS: Array<{ id: ProjectCoverageReasonFilter; label: string }> = [
  { id: "all", label: "All project needs" },
  { id: "server", label: "Server projects" },
  { id: "workstations", label: "5+ workstations" },
  { id: "unsupported", label: "Unsupported systems" },
];

export function projectCoverageFilterMatches(client: ProjectCoverageClient, filter: ProjectCoverageReasonFilter): boolean {
  if (filter === "server") return client.serverProjectCount > 0;
  if (filter === "workstations") return client.workstationProjectCount > 0;
  if (filter === "unsupported") return client.hasUnsupportedSystems;
  return true;
}

function filterCount(clients: ProjectCoverageClient[], filter: ProjectCoverageReasonFilter): number {
  return clients.filter((client) => projectCoverageFilterMatches(client, filter)).length;
}

interface Props {
  clients: ProjectCoverageClient[];
  activeFilter: ProjectCoverageReasonFilter;
  onChange: (filter: ProjectCoverageReasonFilter) => void;
}

export function ProjectCoverageFilters({ clients, activeFilter, onChange }: Props) {
  return (
    <div className="project-coverage-filters" aria-label="Filter clients by project reason">
      {FILTERS.map((filter) => {
        const count = filterCount(clients, filter.id);
        return <button
          key={filter.id}
          type="button"
          className={activeFilter === filter.id ? "is-active" : ""}
          aria-pressed={activeFilter === filter.id}
          onClick={() => onChange(filter.id)}
        >
          <span>{filter.label}</span>
          <small>{count}</small>
        </button>;
      })}
    </div>
  );
}
