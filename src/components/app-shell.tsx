import Link from "next/link";
import { APP_VERSION } from "@/lib/app-version";
import { Brand } from "./brand";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="topbar-actions">
          <nav className="topbar-nav" aria-label="Primary navigation">
            <Link href="/">Compass</Link>
            <Link href="/generator/">Report Generator</Link>
          </nav>
          <span className="build-version" aria-label={`Application version ${APP_VERSION}`}>v{APP_VERSION}</span>
        </div>
      </header>
      <main className="page-shell">{children}</main>
    </div>
  );
}
