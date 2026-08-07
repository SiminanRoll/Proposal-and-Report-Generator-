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
import { checkCaptainsLogCloudBridge, probeCaptainsLogCloudDesktop } from "@/lib/compass/captains-log-bridge";

export function CaptainsLogCloudSettings() {
  const [config, setConfig] = useState<CaptainsLogCloudConfig>({ url: "", anonKey: "", email: "" });
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Not connected");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [desktopOnline, setDesktopOnline] = useState(false);

  useEffect(() => {
    setConfig(getCaptainsLogCloudConfig());
    const snapshot = getCaptainsLogCloudAuthSnapshot();
    setConnected(snapshot.signedIn);
    setDesktopOnline(false);
    setStatus(snapshot.signedIn ? `Cloud signed in as ${snapshot.email} · test the desktop connection` : snapshot.configured ? "Configuration saved · sign in to connect" : "Not configured");
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
      if (!ready) {
        setDesktopOnline(false);
        setStatus("Signed in, but the Captain's Log cloud ledger could not be reached.");
      } else {
        const probe = await probeCaptainsLogCloudDesktop(7000);
        setDesktopOnline(probe.desktopOnline);
        setStatus(probe.desktopOnline ? `Cloud connected as ${snapshot.email} · Captain's Log V${probe.desktopVersion} responded` : `Cloud connected as ${snapshot.email} · Captain's Log desktop has not responded yet. Open V842 and test again.`);
      }
    } catch (cause) {
      setConnected(false);
      setStatus(cause instanceof Error ? cause.message : "Captain's Log cloud sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    await signOutCaptainsLogCloud();
    setConnected(false);
    setDesktopOnline(false);
    setPassword("");
    setStatus("Disconnected");
    setBusy(false);
  };

  const testDesktop = async () => {
    if (busy || !connected) return;
    setBusy(true);
    setStatus("Testing Captain's Log desktop…");
    try {
      const probe = await probeCaptainsLogCloudDesktop(8000);
      setDesktopOnline(probe.desktopOnline);
      setStatus(probe.desktopOnline ? `Captain's Log V${probe.desktopVersion} responded. Two-way sync is ready.` : (probe.error || "The cloud account is connected, but Captain's Log did not respond. Open V842 and verify the same Supabase account."));
    } finally { setBusy(false); }
  };

  const saveOnly = () => {
    const saved = saveCaptainsLogCloudConfig(config);
    setConfig(saved);
    setStatus("Connection settings saved. Sign in to activate Captain's Log sync.");
  };

  return <section className="compass-settings-section captains-log-cloud-settings">
    <div className="compass-settings-section-heading"><div><span className="compass-kicker">Captain&apos;s Log</span><h2>Cloud connection</h2><p>Client Compass now uses the same authenticated Supabase account as Captain&apos;s Log. Coordination Calls are queued in the shared cloud ledger and remain there until Captain&apos;s Log processes them—no localhost port or browser protocol is required.</p></div><span className={`captains-log-cloud-badge${desktopOnline ? " is-connected" : ""}`}>{desktopOnline ? "Desktop ready" : connected ? "Cloud only" : "Not connected"}</span></div>
    <div className="compass-settings-grid two-column">
      <label className="compass-settings-field"><span>Supabase project URL</span><input value={config.url} placeholder="https://your-project.supabase.co" onChange={(event) => setConfig((current) => ({ ...current, url: event.target.value }))}/><small>Use the same Supabase URL shown in Captain&apos;s Log → Settings → Sync.</small></label>
      <label className="compass-settings-field"><span>Publishable / anon key</span><input type="password" value={config.anonKey} placeholder="Supabase publishable key" onChange={(event) => setConfig((current) => ({ ...current, anonKey: event.target.value }))}/><small>This is the public project key used by Captain&apos;s Log—not a service-role key.</small></label>
      <label className="compass-settings-field"><span>Supabase sign-in email</span><input type="email" value={config.email} placeholder="you@example.com" onChange={(event) => setConfig((current) => ({ ...current, email: event.target.value }))}/><small>Use the same secure sign-in account as Captain&apos;s Log.</small></label>
      <label className="compass-settings-field"><span>Password</span><input type="password" value={password} placeholder={connected ? "Already connected" : "Used only to sign in"} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)}/><small>The password is never stored. Supabase returns a refresh session that stays in this browser.</small></label>
    </div>
    <div className={`captains-log-cloud-status${desktopOnline ? " is-connected" : ""}`} role="status">{status}</div>
    <div className="captains-log-cloud-actions">
      <button className="button secondary" type="button" disabled={busy} onClick={saveOnly}>Save connection settings</button>
      {connected && <button className="button secondary" type="button" disabled={busy} onClick={() => void testDesktop()}>Test desktop sync</button>}
      {connected ? <button className="button secondary" type="button" disabled={busy} onClick={() => void disconnect()}>Disconnect</button> : <button className="button primary" type="button" disabled={busy || !password || !config.url || !config.anonKey || !config.email} onClick={() => void connect()}>{busy ? "Connecting…" : "Connect Captain's Log"}</button>}
    </div>
  </section>;
}
