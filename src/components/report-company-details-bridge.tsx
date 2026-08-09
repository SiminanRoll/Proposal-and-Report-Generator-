"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useCompassState } from "@/lib/compass/store";
import { getProject } from "@/lib/projects/store";
import { CompassClientWorkspace } from "./compass-client-workspace";

/**
 * Reuses the canonical Compass company workspace from a prepared report.
 * The report toolbar is rendered deep inside OutcomeExperience, so this small
 * bridge keeps the two experiences connected without duplicating company UI.
 */
export function ReportCompanyDetailsBridge() {
  const { dataset, config, ready, refresh } = useCompassState();
  const [menuTarget, setMenuTarget] = useState<HTMLElement | null>(null);
  const [clientId, setClientId] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let currentTarget: HTMLElement | null = null;
    let currentClientId = "";

    const sync = () => {
      const target = document.querySelector<HTMLElement>(".report-more-menu > div");
      if (target !== currentTarget) {
        currentTarget = target;
        setMenuTarget(target);
      }

      const params = new URLSearchParams(window.location.search);
      const projectId = params.get("id")?.trim() || "";
      const project = projectId ? getProject(projectId) : undefined;
      const value = project?.intelligence.facts.find((fact) => fact.key === "compass.clientId")?.value;
      const nextClientId = typeof value === "string" ? value : "";
      if (nextClientId !== currentClientId) {
        currentClientId = nextClientId;
        setClientId(nextClientId);
      }
      if (!target || !nextClientId) setOpen(false);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const clientAvailable = Boolean(ready && dataset && clientId && dataset.clients.some((client) => client.id === clientId));

  return <>
    {menuTarget && clientId && createPortal(
      <button
        type="button"
        disabled={!clientAvailable}
        onClick={() => {
          document.querySelector<HTMLDetailsElement>(".report-more-menu")?.removeAttribute("open");
          setOpen(true);
        }}
      >
        View company details
      </button>,
      menuTarget,
    )}
    {open && clientAvailable && dataset && <CompassClientWorkspace
      clientId={clientId}
      dataset={dataset}
      config={config}
      onBack={() => setOpen(false)}
      onCloseAll={() => setOpen(false)}
      onDatasetSaved={refresh}
    />}
  </>;
}
