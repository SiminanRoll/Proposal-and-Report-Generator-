"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProjectWorkspace } from "./project-workspace";

export function ProjectPageClient() {
  const [projectId, setProjectId] = useState<string | null | undefined>(undefined);
  const [autoPresent, setAutoPresent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("id");
    setProjectId(value?.trim() || null);
    setAutoPresent(params.get("present") === "1");
  }, []);

  if (projectId === undefined) return <div className="loading-state">Loading workspace…</div>;
  if (projectId === null) {
    return (
      <div className="empty-state large">
        <span className="eyebrow">Workspace unavailable</span>
        <h1>No local workspace was selected.</h1>
        <p>Return to the dashboard and open a workspace stored in this browser.</p>
        <Link className="button primary" href="/">Back to workspaces</Link>
      </div>
    );
  }

  return <ProjectWorkspace projectId={projectId} autoPresent={autoPresent} />;
}
