"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreateProjectScreen } from "./create-project-screen";
import { isProjectType, type ProjectType } from "@/lib/projects/types";

export function CreatePageClient() {
  const [projectType, setProjectType] = useState<ProjectType | null | undefined>(undefined);
  const [initialValues, setInitialValues] = useState({ clientName: "", contactName: "", context: "" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("type") ?? "";
    setProjectType(isProjectType(value) ? value : null);
    setInitialValues({
      clientName: params.get("client")?.trim() ?? "",
      contactName: params.get("contact")?.trim() ?? "",
      context: params.get("context")?.trim() ?? "",
    });
  }, []);

  if (projectType === undefined) return <div className="loading-state">Preparing workspace…</div>;
  if (projectType === null) {
    return (
      <div className="empty-state large">
        <span className="eyebrow">Choose an outcome</span>
        <h1>This creation path is not available.</h1>
        <p>Return to the dashboard and choose one of the three workspace types.</p>
        <Link className="button primary" href="/">Back to workspaces</Link>
      </div>
    );
  }

  return <CreateProjectScreen projectType={projectType} initialClientName={initialValues.clientName} initialContactName={initialValues.contactName} initialContext={initialValues.context} />;
}
