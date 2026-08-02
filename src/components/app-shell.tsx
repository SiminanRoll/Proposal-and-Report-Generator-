import Link from "next/link";
import { Brand } from "./brand";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <nav className="topnav" aria-label="Primary navigation">
          <Link href="/">Projects</Link>
          <span className="phase-chip">Source Review · Phase 2</span>
          <div className="avatar" aria-label="Signed in user">PB</div>
        </nav>
      </header>
      <main className="page-shell">{children}</main>
    </div>
  );
}
