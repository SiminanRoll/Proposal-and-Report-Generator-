"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProjectStatus, ProjectType } from "@/lib/projects/types";
import { ArrowIcon, DocumentPulseIcon, DotsIcon, ProposalIcon, RefreshDocumentIcon, SearchIcon } from "./icons";
import { deleteProject, useProjects } from "@/lib/projects/store";
import { getProjectTemplate } from "@/lib/projects/templates";
import { lifecycleSummary } from "@/lib/outcomes/client-report-data";

type HomeSortKey = "client" | "type" | "status" | "health" | "sources" | "updated";
type SortDirection = "asc" | "desc";

const cards: Array<{ type: ProjectType; icon: React.ReactNode; title: string; detail: string }> = [
  { type: "client-report", icon: <DocumentPulseIcon />, title: "Technology Review", detail: "Current client report" },
  { type: "prospect-proposal", icon: <ProposalIcon />, title: "Advantage 360 Proposal", detail: "New client proposal" },
  { type: "legacy-modernization", icon: <RefreshDocumentIcon />, title: "Update Existing Proposal", detail: "Refresh an existing quote" },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function projectTypeLabel(type: ProjectType): string {
  if (type === "client-report") return "Technology Review";
  if (type === "prospect-proposal") return "Advantage 360";
  return "Proposal Update";
}

function projectStatusLabel(status: ProjectStatus, ready: boolean): { label: string; tone: string } {
  if (ready || status === "published") return { label: "Ready", tone: "ready" };
  if (status === "sources-needed") return { label: "Needs sources", tone: "attention" };
  if (status === "review-needed") return { label: "Needs review", tone: "attention" };
  if (status === "analyzing") return { label: "Processing", tone: "working" };
  if (status === "ready-for-intelligence" || status === "intelligence-ready") return { label: "Ready to tailor", tone: "working" };
  return { label: "Started", tone: "neutral" };
}

function sourceCount(project: Parameters<typeof lifecycleSummary>[0]): number {
  return project.sources.filter((source) => source.files.length > 0).length;
}

function sortIndicator(column: HomeSortKey, active: HomeSortKey | null, direction: SortDirection): string {
  if (column !== active) return "↕";
  return direction === "asc" ? "↑" : "↓";
}

export function HomeDashboard() {
  const { projects } = useProjects();
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<HomeSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matching = normalized
      ? projects.filter((project) =>
        `${project.name} ${project.client.name} ${projectTypeLabel(project.type)} ${getProjectTemplate(project.type).shortTitle}`.toLowerCase().includes(normalized),
      )
      : [...projects];
    if (!sortKey) return matching;
    const dir = sortDirection === "asc" ? 1 : -1;
    return matching.sort((left, right) => {
      if (sortKey === "client") return dir * left.client.name.localeCompare(right.client.name);
      if (sortKey === "type") return dir * projectTypeLabel(left.type).localeCompare(projectTypeLabel(right.type));
      if (sortKey === "status") {
        const leftStatus = projectStatusLabel(left.status, Boolean(left.presentation.executiveSummary)).label;
        const rightStatus = projectStatusLabel(right.status, Boolean(right.presentation.executiveSummary)).label;
        return dir * (leftStatus.localeCompare(rightStatus) || left.client.name.localeCompare(right.client.name));
      }
      if (sortKey === "health") {
        const leftHealth = lifecycleSummary(left);
        const rightHealth = lifecycleSummary(right);
        const red = leftHealth.overdue - rightHealth.overdue;
        const yellow = leftHealth.dueSoon - rightHealth.dueSoon;
        const green = leftHealth.current - rightHealth.current;
        return dir * (red || yellow || green || left.client.name.localeCompare(right.client.name));
      }
      if (sortKey === "sources") return dir * (sourceCount(left) - sourceCount(right) || left.client.name.localeCompare(right.client.name));
      return dir * (new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime() || left.client.name.localeCompare(right.client.name));
    });
  }, [projects, query, sortDirection, sortKey]);

  const updateSort = (column: HomeSortKey) => {
    if (sortKey === column) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(column);
    setSortDirection(column === "client" || column === "type" || column === "status" ? "asc" : "desc");
  };

  const sortButton = (column: HomeSortKey, label: string) => <button className={`compass-column-sort${sortKey === column ? " is-active" : ""}`} type="button" onClick={() => updateSort(column)}>{label}<span aria-hidden="true">{sortIndicator(column, sortKey, sortDirection)}</span></button>;

  return (
    <div className="dashboard generator-dashboard-v199">
      <header className="generator-home-header">
        <div>
          <span className="section-kicker">Reports &amp; proposals</span>
          <h1>Report Generator</h1>
          <p>Create something new or jump back into recent client work.</p>
        </div>
      </header>

      <section className="generator-create-section" aria-labelledby="generator-create-title">
        <div className="generator-compact-heading">
          <div><span className="section-kicker">New</span><h2 id="generator-create-title">Create</h2></div>
        </div>
        <div className="generator-create-grid">
          {cards.map(({ type, icon, title, detail }) => {
            const template = getProjectTemplate(type);
            return (
              <Link key={type} href={`/create/?type=${encodeURIComponent(type)}`} className={`generator-create-card accent-${template.accent}`}>
                <span className="creation-icon">{icon}</span>
                <span className="generator-create-copy"><strong>{title}</strong><small>{detail}</small></span>
                <span className="creation-arrow"><ArrowIcon /></span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="generator-recent-section" aria-labelledby="generator-recent-title">
        <div className="generator-recent-heading">
          <div><span className="section-kicker">Recent</span><h2 id="generator-recent-title">Reports &amp; proposals</h2></div>
          <label className="search-field"><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recent" aria-label="Search recent reports and proposals" /></label>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-projects generator-empty-projects">
            <div className="empty-graphic"><DocumentPulseIcon /></div>
            <h3>{projects.length === 0 ? "Nothing here yet." : "No results found."}</h3>
            <p>{projects.length === 0 ? "Create a technology review or proposal above and it will appear here." : "Try a client name or report type."}</p>
          </div>
        ) : (
          <div className="generator-project-table">
            <div className="generator-project-head">
              <span>{sortButton("client", "Client")}</span>
              <span>{sortButton("type", "Type")}</span>
              <span>{sortButton("status", "Status")}</span>
              <span>{sortButton("health", "Health")}</span>
              <span>{sortButton("sources", "Sources")}</span>
              <span>{sortButton("updated", "Updated")}</span>
              <span />
            </div>
            <div className="generator-project-list">
              {filtered.slice(0, 12).map((project) => {
                const template = getProjectTemplate(project.type);
                const projectSourceCount = sourceCount(project);
                const status = projectStatusLabel(project.status, Boolean(project.presentation.executiveSummary));
                const health = lifecycleSummary(project);
                const hasHealth = health.inventoryTotal > 0 || health.total > 0;
                return (
                  <div className="generator-project-row" key={project.id}>
                    <Link className="generator-project-main" href={`/project/?id=${encodeURIComponent(project.id)}`}>
                      <span className="generator-project-client"><i className={`project-type-mark accent-${template.accent}`} /><strong>{project.client.name}</strong></span>
                      <span className="generator-project-type">{projectTypeLabel(project.type)}</span>
                      <span className={`generator-status-pill tone-${status.tone}`}>{status.label}</span>
                      <span className={`generator-health-counts${hasHealth ? "" : " is-empty"}`} aria-label={hasHealth ? `${health.overdue} replacement now, ${health.dueSoon} plan soon, ${health.current} healthy` : "No lifecycle inventory available"}>
                        {hasHealth ? <>
                          <span className="generator-health-count risk" title="Replacement now"><i />{health.overdue}</span>
                          <span className="generator-health-count attention" title="Plan soon"><i />{health.dueSoon}</span>
                          <span className="generator-health-count healthy" title="Healthy"><i />{health.current}</span>
                        </> : <span className="generator-health-empty">—</span>}
                      </span>
                      <span className="generator-source-count">{projectSourceCount} source{projectSourceCount === 1 ? "" : "s"}</span>
                      <span className="generator-project-date">{formatDate(project.updatedAt)}</span>
                    </Link>
                    <button className="icon-button compact" type="button" aria-label={`Actions for ${project.client.name}`} onClick={() => setOpenMenu(openMenu === project.id ? null : project.id)}><DotsIcon /></button>
                    {openMenu === project.id && <div className="row-menu"><Link href={`/project/?id=${encodeURIComponent(project.id)}`}>Open</Link><button type="button" onClick={() => { void deleteProject(project.id); setOpenMenu(null); }}>Delete</button></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
