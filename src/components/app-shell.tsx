import Link from "next/link";
import { APP_VERSION } from "@/lib/app-version";
import { CompassNavigationRail } from "./compass-navigation-rail";
import { GlobalClientSearch } from "./global-client-search";
import { QuickPresentGlobal } from "./quick-present-global";
import { ProspectA360Global } from "./prospect-a360-global";
import { A360PricingRuntime } from "./a360-pricing-runtime";

function WorkbenchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8h14M7 5h10v3H7zM6 8v9m12-9v9M4 17h16M8 17v2m8-2v2"/><path d="M9 12h6"/></svg>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <CompassNavigationRail />
        <div className="topbar-actions">
          <Link className="global-quick-present-button" href="/workbench/" aria-label="Open Account Review Workbench" title="Workbench"><WorkbenchIcon /><span>Workbench</span></Link>
          <ProspectA360Global />
          <QuickPresentGlobal />
          <span className="build-version" aria-label={`Application version ${APP_VERSION}`}>v{APP_VERSION}</span>
        </div>
      </header>
      <main className="page-shell">{children}</main>
      <GlobalClientSearch />
      <A360PricingRuntime />
      <span className="mobile-build-version" aria-label={`Application version ${APP_VERSION}`}>v{APP_VERSION}</span>
      <style>{`
        .mobile-build-version { display: none; }
        @media (max-width: 760px) {
          .mobile-build-version {
            position: fixed;
            right: 8px;
            bottom: calc(8px + env(safe-area-inset-bottom));
            z-index: 120;
            display: inline-flex;
            align-items: center;
            min-height: 22px;
            padding: 0 8px;
            border: 1px solid rgba(95, 155, 209, .28);
            border-radius: 999px;
            color: #315f86;
            background: rgba(241, 249, 255, .88);
            box-shadow: 0 5px 16px rgba(24, 74, 116, .10), inset 0 1px 0 rgba(255,255,255,.82);
            backdrop-filter: blur(12px) saturate(125%);
            -webkit-backdrop-filter: blur(12px) saturate(125%);
            font-size: 9px;
            font-weight: 800;
            letter-spacing: .04em;
            line-height: 1;
            pointer-events: none;
          }
        }
      `}</style>
    </div>
  );
}
