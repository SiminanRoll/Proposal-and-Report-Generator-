import Link from "next/link";
import { APP_VERSION } from "@/lib/app-version";
import { CompassNavigationRail } from "./compass-navigation-rail";
import { GlobalClientSearch } from "./global-client-search";
import { QuickPresentGlobal } from "./quick-present-global";

function WorkbenchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8h14M7 5h10v3H7zM6 8v9m12-9v9M4 17h16M8 17v2m8-2v2"/><path d="M9 12h6"/></svg>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <CompassNavigationRail />
        <div className="topbar-actions">
          <Link className="global-quick-present-button" href="/workbench/" aria-label="Open Account Review Workbench" title="Workbench"><WorkbenchIcon /><span>Workbench</span></Link>
          <QuickPresentGlobal />
          <span className="build-version" aria-label={`Application version ${APP_VERSION}`}>v{APP_VERSION}</span>
        </div>
      </header>
      <main className="page-shell">{children}</main>
      <GlobalClientSearch />
    </div>
  );
}
