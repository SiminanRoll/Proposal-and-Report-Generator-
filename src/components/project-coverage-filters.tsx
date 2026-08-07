"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<ProjectCoverageReasonFilter, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const positionIndicator = () => {
    const container = containerRef.current;
    const button = buttonRefs.current.get(activeFilter);
    if (!container || !button) return;
    setIndicator({ left: button.offsetLeft, width: button.offsetWidth, ready: true });
  };

  useLayoutEffect(positionIndicator, [activeFilter, clients]);

  useEffect(() => {
    const resize = () => positionIndicator();
    window.addEventListener("resize", resize);
    const observer = typeof ResizeObserver === "undefined" || !containerRef.current ? null : new ResizeObserver(resize);
    if (containerRef.current) observer?.observe(containerRef.current);
    return () => {
      window.removeEventListener("resize", resize);
      observer?.disconnect();
    };
  }, [activeFilter]);

  return (
    <div ref={containerRef} className="project-coverage-filters" aria-label="Filter clients by project reason">
      <span
        className={`project-coverage-filter-indicator${indicator.ready ? " is-ready" : ""}`}
        style={{ "--filter-left": `${indicator.left}px`, "--filter-width": `${indicator.width}px` } as CSSProperties}
        aria-hidden="true"
      />
      {FILTERS.map((filter) => {
        const count = filterCount(clients, filter.id);
        return <button
          key={filter.id}
          ref={(node) => { if (node) buttonRefs.current.set(filter.id, node); else buttonRefs.current.delete(filter.id); }}
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
