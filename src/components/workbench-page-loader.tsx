"use client";

import dynamic from "next/dynamic";

const BrowserWorkbenchPage = dynamic(
  () => import("./workbench-page-v102").then((module) => module.WorkbenchPageV102),
  { ssr: false, loading: () => <div className="loading-state">Loading Workbench…</div> },
);

export function WorkbenchPageLoader() {
  return <BrowserWorkbenchPage />;
}
