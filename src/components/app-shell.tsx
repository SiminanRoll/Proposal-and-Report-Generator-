import { APP_VERSION } from "@/lib/app-version";
import { CompassNavigationRail } from "./compass-navigation-rail";
import { GlobalClientSearch } from "./global-client-search";
import { QuickPresentGlobal } from "./quick-present-global";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <CompassNavigationRail />
        <div className="topbar-actions">
          <QuickPresentGlobal />
          <span className="build-version" aria-label={`Application version ${APP_VERSION}`}>v{APP_VERSION}</span>
        </div>
      </header>
      <main className="page-shell">{children}</main>
      <GlobalClientSearch />
    </div>
  );
}
