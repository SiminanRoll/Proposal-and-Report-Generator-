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
import { checkCaptainsLogCloudBridge } from "@/lib/compass/captains-log-bridge";
import { CompassMasterBackupSettings } from "./compass-master-backup-settings";

export function CaptainsLogCloudSettings() {
  const [config, setConfig] = useState<CaptainsLogCloudConfig>({ url: "", anonKey: "", email: "" });
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Not connected");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setConfig(getCaptainsLogCloudConfig());
    const snapshot = getCaptainsLogCloudAuthSnapshot();
    setConnected(snapshot.signedIn);
    setStatus(snapshot.signedIn ? `Connected as ${snapshot.email}` : snapshot.configured ? "Ready to connect" : "Not connected");
  }, []);

  const connect = async () => {
    if (busy) return;
    setBusy(true);
    setStatus("Connecting…");
    try {
      const normalized = saveCaptainsLogCloudConfig(config);
      setConfig(normalized);
      const snapshot = await signInCaptainsLogCloud(normalized, password);
      setPassword("");
      const ready = await checkCaptainsLogCloudBridge();
      setConnected(ready);
      setStatus(ready ? `Connected as ${snapshot.email}` : "Signed in, history unavailable");
    } catch (cause) {
      setConnected(false);
      setStatus(cause instanceof Error ? cause.message : "Supabase sign-in failed.");
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
    setStatus("Connection settings saved");
  };

  return <>
    <section className="compass-settings-section captains-log-cloud-settings">
      <div className="compass-settings-section-heading"><div><h2>History connection</h2></div><span className={`captains-log-cloud-badge${connected ? " is-connected" : ""}`}>{connected ? "Connected" : "Not connected"}</span></div>
      <div className="compass-settings-grid two-column">
        <label className="compass-settings-field"><span>Supabase project URL</span><input value={config.url} placeholder="https://your-project.supabase.co" onChange={(event) => setConfig((current) => ({ ...current, url: event.target.value }))}/></label>
        <label className="compass-settings-field"><span>Publishable / anon key</span><input type="password" value={config.anonKey} placeholder="Supabase publishable key" onChange={(event) => setConfig((current) => ({ ...current, anonKey: event.target.value }))}/></label>
        <label className="compass-settings-field"><span>Sign-in email</span><input type="email" value={config.email} placeholder="you@example.com" onChange={(event) => setConfig((current) => ({ ...current, email: event.target.value }))}/></label>
        <label className="compass-settings-field"><span>Password</span><input type="password" value={password} placeholder={connected ? "Connected" : "Password"} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)}/></label>
      </div>
      <div className={`captains-log-cloud-status${connected ? " is-connected" : ""}`} role="status">{status}</div>
      <div className="captains-log-cloud-actions">
        <button className="button secondary" type="button" disabled={busy} onClick={saveOnly}>Save connection</button>
        {connected ? <button className="button secondary" type="button" disabled={busy} onClick={() => void disconnect()}>Disconnect</button> : <button className="button primary" type="button" disabled={busy || !password || !config.url || !config.anonKey || !config.email} onClick={() => void connect()}>{busy ? "Connecting…" : "Connect"}</button>}
      </div>
    </section>
    <CompassMasterBackupSettings />
  </>;
}
