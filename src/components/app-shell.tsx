import { Brand } from "./brand";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
      </header>
      <main className="page-shell">{children}</main>
    </div>
  );
}
