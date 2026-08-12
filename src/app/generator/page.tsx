import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { HomeDashboard } from "@/components/home-dashboard";

export default function GeneratorPage() {
  return (
    <AppShell>
      <div style={{ maxWidth: 1600, margin: "18px auto -4px", padding: "0 34px", display: "flex", justifyContent: "flex-end" }}>
        <Link
          href="/generator/internal/"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 13px", border: "1px solid #c9dbe9", borderRadius: 11, background: "#f7fbff", color: "#175b91", fontSize: 11, fontWeight: 800, textDecoration: "none" }}
        >
          <span aria-hidden="true">▣</span>
          Internal TC Report
        </Link>
      </div>
      <HomeDashboard />
    </AppShell>
  );
}
