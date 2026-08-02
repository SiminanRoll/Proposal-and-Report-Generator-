"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreateProjectScreen } from "./create-project-screen";
import { isProjectType, type ProjectType } from "@/lib/projects/types";

export function CreatePageClient() {
  const [projectType, setProjectType] = useState<ProjectType | null | undefined>(undefined);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("type") ?? "";
    setProjectType(isProjectType(value) ? value : null);
  }, []);

  if (projectType === undefined) return <div className="loading-state">Preparing workspace…</div>;
  if (projectType === null) {
    return (
      <div className="empty-state large">
        <span className="eyebrow">Choose an outcome</span>
        <h1>This creation path is not available.</h1>
        <p>Return to the dashboard and choose one of the three project types.</p>
        <Link className="button primary" href="/">Back to projects</Link>
      </div>
    );
  }

  return <CreateProjectScreen projectType={projectType} />;
}
