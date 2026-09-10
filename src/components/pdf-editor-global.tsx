"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getProject } from "@/lib/projects/store";

function PdfIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2.8h8l4 4V21H6z"/><path d="M14 2.8V7h4M8.5 12h7M8.5 15h7M8.5 18h4"/><path d="m16.8 10.2 2-2 1.2 1.2-2 2-1.8.6z"/></svg>;
}

export function PdfEditorGlobal() {
  const pathname = usePathname();
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    if (pathname !== "/project") {
      setProjectId("");
      return;
    }
    const id = new URLSearchParams(window.location.search).get("id")?.trim() ?? "";
    const project = id ? getProject(id) : undefined;
    setProjectId(project?.type === "client-report" ? id : "");
  }, [pathname]);

  if (!projectId) return null;
  return <Link className="global-quick-present-button pdf-editor-launch" href={`/project/pdf-editor?id=${encodeURIComponent(projectId)}`} aria-label="Open editable PDF preview" title="Edit PDF"><PdfIcon /><span>Edit PDF</span></Link>;
}
