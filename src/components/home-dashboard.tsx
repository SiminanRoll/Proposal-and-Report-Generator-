"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ArrowIcon, DocumentPulseIcon, DotsIcon, ProposalIcon, RefreshDocumentIcon, SearchIcon, SparkIcon } from "./icons";
import { deleteProject, exportProjectsBackup, importProjectsBackup, useProjects } from "@/lib/projects/store";
import { getProjectTemplate } from "@/lib/projects/templates";
import type { ProjectType } from "@/lib/projects/types";

const cards: Array<{ type: ProjectType; icon: React.ReactNode }> = [
  { type: "client-report", icon: <DocumentPulseIcon /> },
  { type: "prospect-proposal", icon: <ProposalIcon /> },
  { type: "legacy-modernization", icon: <RefreshDocumentIcon /> },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function HomeDashboard() {
  const { projects } = useProjects();
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState("");
  const backupInputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return projects;
    return projects.filter((project) =>
      `${project.name} ${project.client.name} ${getProjectTemplate(project.type).shortTitle}`.toLowerCase().includes(normalized),
    );
  }, [projects, query]);

  return (
    <div className="dashboard">
      <section className="hero-panel">
        <div className="hero-copy">
          <h1>Report &amp; Proposal Generation</h1>
          <p>Create polished client reports, new Advantage 360 proposals, and modernized quotes from your source documents.</p>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-center"><SparkIcon /></div>
          <span className="orbit-node node-one">Security</span>
          <span className="orbit-node node-two">Value</span>
          <span className="orbit-node node-three">Planning</span>
        </div>
      </section>

      <section className="privacy-bar" aria-label="Local privacy and backups">
        <div className="privacy-copy">
          <span className="privacy-lock">✓</span>
          <div><strong>Private browser workspace</strong><small>Source documents are processed and cached on this device. Nothing is uploaded to DigitalOcean.</small></div>
        </div>
        <div className="privacy-actions">
          <input
            ref={backupInputRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={async (event: ChangeEvent<HTMLInputElement>) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              try {
                const count = await importProjectsBackup(file);
                setBackupMessage(`${count} project${count === 1 ? "" : "s"} restored`);
              } catch (error) {
                setBackupMessage(error instanceof Error ? error.message : "Backup could not be restored.");
              }
            }}
          />
          <button className="button secondary compact" type="button" onClick={exportProjectsBackup}>Download local backup</button>
          <button className="button secondary compact" type="button" onClick={() => backupInputRef.current?.click()}>Restore backup</button>
          {backupMessage && <span className="backup-message">{backupMessage}</span>}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><span className="section-kicker">Start here</span><h2>What are you creating?</h2></div>
          <p>Three focused paths. One shared client and proposal engine.</p>
        </div>
        <div className="creation-grid">
          {cards.map(({ type, icon }) => {
            const template = getProjectTemplate(type);
            return (
              <Link key={type} href={`/create/?type=${encodeURIComponent(type)}`} className={`creation-card accent-${template.accent}`}>
                <div className="creation-card-top">
                  <span className="creation-icon">{icon}</span>
                  <span className="creation-arrow"><ArrowIcon /></span>
                </div>
                <span className="card-eyebrow">{template.eyebrow}</span>
                <h3>{template.title}</h3>
                <p>{template.description}</p>
                <div className="card-outcome"><span>Outcome</span>{template.outcome}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section-block recent-block">
        <div className="section-heading recent-heading">
          <div><span className="section-kicker">Workspace</span><h2>Recent projects</h2></div>
          <label className="search-field"><SearchIcon /><input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Search projects" aria-label="Search projects" /></label>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-projects">
            <div className="empty-graphic"><DocumentPulseIcon /></div>
            <h3>{projects.length === 0 ? "Your first great client experience starts above." : "No projects match that search."}</h3>
            <p>{projects.length === 0 ? "Choose one of the three creation paths. Your work will appear here automatically." : "Try the client name, project name, or project type."}</p>
          </div>
        ) : (
          <div className="project-list">
            {filtered.slice(0, 8).map((project) => {
              const template = getProjectTemplate(project.type);
              const sourceCount = project.sources.filter((source) => source.files.length > 0).length;
              return (
                <div className="project-row" key={project.id}>
                  <Link className="project-row-main" href={`/project/?id=${encodeURIComponent(project.id)}`}>
                    <span className={`project-type-mark accent-${template.accent}`} />
                    <span className="project-primary"><strong>{project.client.name}</strong><small>{project.name}</small></span>
                    <span className="project-type">{template.shortTitle}</span>
                    <span className={`status-pill status-${project.status}`}>{project.status === "sources-needed" ? "Sources needed" : project.status === "review-needed" ? "Confirmation needed" : project.status === "intelligence-ready" ? "Intelligence ready" : "Source intake"}</span>
                    <span className="source-count">{sourceCount}/{project.sources.length} sources</span>
                    <span className="project-date">{formatDate(project.updatedAt)}</span>
                  </Link>
                  <button className="icon-button" type="button" aria-label={`Project actions for ${project.name}`} onClick={() => setOpenMenu(openMenu === project.id ? null : project.id)}><DotsIcon /></button>
                  {openMenu === project.id && <div className="row-menu"><Link href={`/project/?id=${encodeURIComponent(project.id)}`}>Open project</Link><button type="button" onClick={() => { void deleteProject(project.id); setOpenMenu(null); }}>Delete project</button></div>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
