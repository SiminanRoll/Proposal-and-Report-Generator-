import { APP_VERSION } from "@/lib/app-version";
import { Brand } from "./brand";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <span className="build-version" aria-label={`Application version ${APP_VERSION}`}>v{APP_VERSION}</span>
      </header>
      <main className="page-shell">{children}</main>
    </div>
  );
}
