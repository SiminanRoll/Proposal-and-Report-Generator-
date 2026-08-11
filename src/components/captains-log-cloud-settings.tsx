"use client";

import { useEffect, useState } from "react";
import {
  getCaptainsLogCloudAuthSnapshot,
  getCaptainsLogCloudConfig,
  saveCaptainsLogCloudConfig,
  signInCaptainsLogCloud,
  signOutCaptainsLogCloud,
  type CaptainsLogCloudConfig,
} from "@/lib/compass/captains-log-cloud";
import { verifyCaptainsLogTaskConnection } from "@/lib/compass/captains-log-task-write";
import { CompassMasterBackupSettings } from "./compass-master-backup-settings";

function errorDetail(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

export function CaptainsLogCloudSettings() {
  const [config, setConfig] = useState<CaptainsLogCloudConfig>({ url: "", anonKey: "", email: "" });
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Not connected");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const saved = getCaptainsLogCloudConfig();
    setConfig(saved);
    const snapshot = getCaptainsLogCloudAuthSnapshot();
    if (!snapshot.signedIn) {
      setConnected(false);
      setStatus(snapshot.configured ? "Ready to connect" : "Not connected");
      return () => { cancelled = true; };
    }

    setStatus("Saved sign-in found. Checking Supabase data access…");
    void verifyCaptainsLogTaskConnection()
      .then(() => {
        if (cancelled) return;
        setConnected(true);
        setStatus(`Connected as ${snapshot.email}`);
      })
      .catch((cause) => {
        if (cancelled) return;
        setConnected(false);
        setStatus(`Saved sign-in is valid locally, but data access failed: ${errorDetail(cause, "Captain's Log data could not be reached.")}`);
      });

    return () => { cancelled = true; };
  }, []);

  const connect = async () => {
    if (busy) return;
    setBusy(true);
    setConnected(false);

    const normalized = saveCaptainsLogCloudConfig(config);
    setConfig(normalized);

    let snapshot: ReturnType<typeof getCaptainsLogCloudAuthSnapshot>;
    try {
      setStatus("Signing in to Supabase…");
      snapshot = await signInCaptainsLogCloud(normalized, password);
      setPassword("");
    } catch (cause) {
      setStatus(`Supabase sign-in failed: ${errorDetail(cause, "The authentication request failed.")}`);
      setBusy(false);
      return;
    }

    try {
      setStatus("Signed in. Checking Captain's Log data access…");
      await verifyCaptainsLogTaskConnection();
      setConnected(true);
      setStatus(`Connected as ${snapshot.email}`);
    } catch (cause) {
      setConnected(false);
      setStatus(`Supabase sign-in succeeded, but Captain's Log data access failed: ${errorDetail(cause, "The data request failed.")}`);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    await signOutCaptainsLogCloud();
    setConnected(false);
    setPassword("");
    setStatus("Disconnected");
    setBusy(false);
  };

  const saveOnly = () => {
    const saved = saveCaptainsLogCloudConfig(config);
    setConfig(saved);
    setConnected(false);
    setStatus("Connection settings saved. Connect to verify them.");
  };

  return <section className="compass-settings-section compass-settings-cloud-recovery" id="settings-cloud">
    <div className="compass-settings-section-heading"><div><span className="compass-settings-section-kicker">Cloud &amp; recovery</span><h2>Connection, backup &amp; restore</h2><p>Keep shared history access and local recovery tools together.</p></div></div>

    <div className="compass-settings-cloud-stack">
      <div className="compass-settings-subpanel captains-log-cloud-settings">
        <div className="compass-settings-subsection-heading compass-settings-subsection-heading-row">
          <div><span>Shared history</span><h3>History connection</h3></div>
          <span className={`captains-log-cloud-badge${connected ? " is-connected" : ""}`}>{connected ? "Connected" : "Not connected"}</span>
        </div>
        <div className="compass-settings-grid two-column captains-log-cloud-grid">
          <label className="compass-settings-field"><span>Supabase project URL</span><input value={config.url} placeholder="https://your-project.supabase.co" onChange={(event) => setConfig((current) => ({ ...current, url: event.target.value }))}/></label>
          <label className="compass-settings-field"><span>Publishable / anon key</span><input type="password" value={config.anonKey} placeholder="Supabase publishable key" onChange={(event) => setConfig((current) => ({ ...current, anonKey: event.target.value }))}/></label>
          <label className="compass-settings-field"><span>Sign-in email</span><input type="email" value={config.email} placeholder="you@example.com" onChange={(event) => setConfig((current) => ({ ...current, email: event.target.value }))}/></label>
          <label className="compass-settings-field"><span>Password</span><input type="password" value={password} placeholder={connected ? "Connected" : "Password"} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)}/></label>
        </div>
        <div className="captains-log-cloud-footer">
          <div className={`captains-log-cloud-status${connected ? " is-connected" : ""}`} role="status">{status}</div>
          <div className="captains-log-cloud-actions">
            <button className="button secondary" type="button" disabled={busy} onClick={saveOnly}>Save connection</button>
            {connected ? <button className="button secondary" type="button" disabled={busy} onClick={() => void disconnect()}>Disconnect</button> : <button className="button primary" type="button" disabled={busy || !password || !config.url || !config.anonKey || !config.email} onClick={() => void connect()}>{busy ? "Connecting…" : "Connect"}</button>}
          </div>
        </div>
      </div>

      <CompassMasterBackupSettings />
    </div>
  </section>;
}
