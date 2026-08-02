"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProjectWorkspace } from "./project-workspace";

export function ProjectPageClient() {
  const [projectId, setProjectId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("id");
    setProjectId(value?.trim() || null);
  }, []);

  if (projectId === undefined) return <div className="loading-state">Loading project…</div>;
  if (projectId === null) {
    return (
      <div className="empty-state large">
        <span className="eyebrow">Project unavailable</span>
        <h1>No local project was selected.</h1>
        <p>Return to the dashboard and open a project stored in this browser.</p>
        <Link className="button primary" href="/">Back to projects</Link>
      </div>
    );
  }

  return <ProjectWorkspace projectId={projectId} />;
}
