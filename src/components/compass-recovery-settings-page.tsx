import Link from "next/link";
import { CaptainsLogCloudSettings } from "./captains-log-cloud-settings";

export function CompassRecoverySettingsPage() {
  return <div className="compass-admin-page compass-settings-page compass-settings-page-modern compass-recovery-settings-page">
    <header className="settings-detail-hero">
      <Link href="/settings/" className="settings-detail-back">← Settings</Link>
      <span className="compass-settings-section-kicker">Connections, storage &amp; recovery</span>
      <h1>Connections, backup &amp; recovery</h1>
      <p>Manage persistent cloud access, master backups, restore, and recovery in one dedicated settings area.</p>
      <div className="settings-detail-scope-row"><span>Captain's Log connection</span><span>Master backup</span><span>Restore</span><span>Persistent preferences</span></div>
    </header>
    <CaptainsLogCloudSettings />
  </div>;
}
