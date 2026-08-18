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
import { clearCaptainsLogCloudCachedSession, saveCaptainsLogCloudLocalCacheNow } from "@/lib/compass/captains-log-cloud-local-cache";
import {
  clearCaptainsLogRememberedPassword,
  getCaptainsLogRememberDevice,
  hasCaptainsLogRememberedPassword,
  saveCaptainsLogRememberedPassword,
  setCaptainsLogRememberDevice,
} from "@/lib/compass/captains-log-device-signin";
import { verifyCaptainsLogTaskConnection } from "@/lib/compass/captains-log-task-write";
import { CAPTAINS_LOG_CLOUD_SESSION_STATUS_EVENT } from "./captains-log-cloud-session-runtime";
import { CompassMasterBackupSettings } from "./compass-master-backup-settings";

function errorDetail(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

function sameConfig(left: CaptainsLogCloudConfig, right: CaptainsLogCloudConfig): boolean {
  return left.url === right.url && left.anonKey === right.anonKey && left.email === right.email;
}

type SessionStatusDetail = {
  connected?: boolean;
  remembered?: boolean;
  email?: string;
  message?: string;
};

export function CaptainsLogCloudSettings() {
  const [config, setConfig] = useState<CaptainsLogCloudConfig>({ url: "", anonKey: "", email: "" });
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Not connected");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [remembered, setRemembered] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [deviceCredentialSaved, setDeviceCredentialSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const onSessionStatus = (event: Event) => {
      const detail = (event as CustomEvent<SessionStatusDetail>).detail || {};
      if (typeof detail.remembered === "boolean") setRemembered(detail.remembered);
      if (typeof detail.connected === "boolean") setConnected(detail.connected);
      if (detail.message) setStatus(detail.connected && detail.email ? `Connected as ${detail.email}` : detail.message);
    };
    window.addEventListener(CAPTAINS_LOG_CLOUD_SESSION_STATUS_EVENT, onSessionStatus);

    const saved = getCaptainsLogCloudConfig();
    setConfig(saved);
    const remember = getCaptainsLogRememberDevice();
    setRememberDevice(remember);
    void hasCaptainsLogRememberedPassword(saved).then((value) => { if (!cancelled) setDeviceCredentialSaved(value); });

    const snapshot = getCaptainsLogCloudAuthSnapshot();
    setRemembered(snapshot.signedIn || remember);
    if (!snapshot.signedIn) {
      setConnected(false);
      setStatus(remember
        ? "Auto-connect is enabled. Compass will reconnect when a saved device credential is available."
        : snapshot.configured ? "Ready to connect" : "Not connected");
      return () => {
        cancelled = true;
        window.removeEventListener(CAPTAINS_LOG_CLOUD_SESSION_STATUS_EVENT, onSessionStatus);
      };
    }

    setStatus(remember ? "Restoring Supabase access with auto-connect enabled…" : "Saved sign-in found. Restoring Supabase access…");
    void verifyCaptainsLogTaskConnection()
      .then(async () => {
        if (cancelled) return;
        await saveCaptainsLogCloudLocalCacheNow().catch(() => undefined);
        setRemembered(true);
        setConnected(true);
        setStatus(`Connected as ${getCaptainsLogCloudAuthSnapshot().email || snapshot.email}`);
      })
      .catch((cause) => {
        if (cancelled) return;
        const current = getCaptainsLogCloudAuthSnapshot();
        setRemembered(current.signedIn || remember);
        setConnected(false);
        setStatus(current.signedIn || remember
          ? `Saved sign-in retained. Compass will retry automatically: ${errorDetail(cause, "Captain's Log data could not be reached.")}`
          : "Supabase sign-in is required.");
      });

    return () => {
      cancelled = true;
      window.removeEventListener(CAPTAINS_LOG_CLOUD_SESSION_STATUS_EVENT, onSessionStatus);
    };
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
      setRemembered(snapshot.signedIn || rememberDevice);
      await saveCaptainsLogCloudLocalCacheNow().catch(() => undefined);
      if (rememberDevice) {
        await saveCaptainsLogRememberedPassword(normalized, password);
        setDeviceCredentialSaved(true);
      }
      setPassword("");
    } catch (cause) {
      setRemembered(getCaptainsLogCloudAuthSnapshot().signedIn || rememberDevice);
      setStatus(`Supabase sign-in failed: ${errorDetail(cause, "The authentication request failed.")}`);
      setBusy(false);
      return;
    }

    try {
      setStatus("Signed in. Checking Captain's Log data access…");
      await verifyCaptainsLogTaskConnection();
      setRemembered(true);
      setConnected(true);
      setStatus(`Connected as ${snapshot.email}${rememberDevice && deviceCredentialSaved ? " · Auto-connect saved" : ""}`);
    } catch (cause) {
      setRemembered(true);
      setConnected(false);
      setStatus(`Sign-in saved. Compass will retry the data connection automatically: ${errorDetail(cause, "The data request failed.")}`);
    } finally {
      setBusy(false);
    }
  };

  const saveDeviceSignIn = async () => {
    if (busy || !password) return;
    setBusy(true);
    try {
      const normalized = saveCaptainsLogCloudConfig(config);
      setConfig(normalized);
      setStatus("Verifying and saving auto-connect for this device…");
      const snapshot = await signInCaptainsLogCloud(normalized, password);
      await saveCaptainsLogCloudLocalCacheNow().catch(() => undefined);
      await saveCaptainsLogRememberedPassword(normalized, password);
      setPassword("");
      setRemembered(true);
      setDeviceCredentialSaved(true);
      await verifyCaptainsLogTaskConnection();
      setConnected(true);
      setStatus(`Connected as ${snapshot.email} · Auto-connect saved`);
    } catch (cause) {
      setStatus(`Auto-connect could not be saved: ${errorDetail(cause, "The sign-in could not be verified.")}`);
    } finally {
      setBusy(false);
    }
  };

  const retrySavedSession = async () => {
    if (busy) return;
    const snapshot = getCaptainsLogCloudAuthSnapshot();
    if (!snapshot.signedIn) {
      setRemembered(rememberDevice);
      setConnected(false);
      setStatus(rememberDevice ? "Auto-connect will retry automatically." : "Supabase sign-in is required.");
      return;
    }

    setBusy(true);
    setRemembered(true);
    setStatus("Retrying saved Supabase sign-in…");
    try {
      await verifyCaptainsLogTaskConnection();
      await saveCaptainsLogCloudLocalCacheNow().catch(() => undefined);
      const current = getCaptainsLogCloudAuthSnapshot();
      setConnected(true);
      setRemembered(true);
      setStatus(`Connected as ${current.email || snapshot.email}`);
    } catch (cause) {
      const current = getCaptainsLogCloudAuthSnapshot();
      setConnected(false);
      setRemembered(current.signedIn || rememberDevice);
      setStatus(current.signedIn || rememberDevice
        ? `Saved sign-in retained. Compass will keep retrying automatically: ${errorDetail(cause, "The data request failed.")}`
        : "Supabase sign-in is required.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (nextStatus = "Disconnected") => {
    setBusy(true);
    await signOutCaptainsLogCloud();
    await clearCaptainsLogCloudCachedSession().catch(() => undefined);
    await setCaptainsLogRememberDevice(false).catch(() => undefined);
    await clearCaptainsLogRememberedPassword().catch(() => undefined);
    setConnected(false);
    setRemembered(false);
    setRememberDevice(false);
    setDeviceCredentialSaved(false);
    setPassword("");
    setStatus(nextStatus);
    setBusy(false);
  };

  const toggleRememberDevice = async (enabled: boolean) => {
    setRememberDevice(enabled);
    await setCaptainsLogRememberDevice(enabled).catch(() => undefined);
    if (!enabled) {
      setDeviceCredentialSaved(false);
      setStatus(connected ? `Connected as ${getCaptainsLogCloudAuthSnapshot().email}` : "Auto-connect disabled. Saved Supabase session can still be retried while it remains valid.");
      return;
    }
    const saved = await hasCaptainsLogRememberedPassword(config).catch(() => false);
    setDeviceCredentialSaved(saved);
    setStatus(saved
      ? "Auto-connect is enabled for this device."
      : "Auto-connect enabled. Enter your Supabase password once below and save the device sign-in.");
  };

  const saveOnly = () => {
    const previous = getCaptainsLogCloudConfig();
    const saved = saveCaptainsLogCloudConfig(config);
    setConfig(saved);
    void saveCaptainsLogCloudLocalCacheNow();

    const current = getCaptainsLogCloudAuthSnapshot();
    setRemembered(current.signedIn || rememberDevice);
    if (sameConfig(previous, saved) && current.signedIn) {
      setStatus(connected ? `Connected as ${current.email}` : "Connection settings saved. Remembered sign-in kept; Compass will retry automatically.");
      return;
    }

    if (!sameConfig(previous, saved) && deviceCredentialSaved) {
      void clearCaptainsLogRememberedPassword();
      setDeviceCredentialSaved(false);
    }
    setConnected(false);
    setStatus(current.configured
      ? rememberDevice
        ? "Connection settings changed. Enter your password once to refresh auto-connect for this device."
        : "Connection settings changed. Enter your password once to save a new sign-in for this device."
      : "Connection settings saved. Connect to verify them.");
  };

  const badgeText = connected ? "Connected" : remembered ? "Remembered" : "Not connected";
  const needsDevicePassword = rememberDevice && !deviceCredentialSaved;

  return <section className="compass-settings-section compass-settings-cloud-recovery" id="settings-cloud">
    <div className="compass-settings-section-heading"><div><span className="compass-settings-section-kicker">Connections, sync &amp; recovery</span><h2>Connection, backup &amp; restore</h2><p>Manage shared Captain's Log access and browser recovery here. Imports, enrichment, calculation refresh, and bulk history sync remain in Data Tools.</p></div><span className="settings-pricing-scope-badge">Persistent settings</span></div>

    <div className="compass-settings-cloud-stack">
      <div className="compass-settings-subpanel captains-log-cloud-settings">
        <div className="compass-settings-subsection-heading compass-settings-subsection-heading-row">
          <div><span>Shared history connection</span><h3>Captain's Log cloud access</h3></div>
          <span className={`captains-log-cloud-badge${connected ? " is-connected" : ""}`}>{badgeText}</span>
        </div>
        <div className="compass-settings-grid two-column captains-log-cloud-grid">
          <label className="compass-settings-field"><span>Supabase project URL</span><input value={config.url} placeholder="https://your-project.supabase.co" onChange={(event) => setConfig((current) => ({ ...current, url: event.target.value }))}/></label>
          <label className="compass-settings-field"><span>Publishable / anon key</span><input type="password" value={config.anonKey} placeholder="Supabase publishable key" onChange={(event) => setConfig((current) => ({ ...current, anonKey: event.target.value }))}/></label>
          <label className="compass-settings-field"><span>Sign-in email</span><input type="email" value={config.email} placeholder="you@example.com" onChange={(event) => setConfig((current) => ({ ...current, email: event.target.value }))}/></label>
          <label className="compass-settings-field"><span>Password</span><input type="password" value={password} disabled={remembered && !needsDevicePassword} placeholder={needsDevicePassword ? "Enter once to save auto-connect" : remembered ? "Remembered on this device" : "Password"} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)}/></label>
        </div>
        <label className="captains-log-cloud-remember-option">
          <input type="checkbox" checked={rememberDevice} onChange={(event) => void toggleRememberDevice(event.target.checked)} />
          <span><strong>Remember this device</strong><small>{deviceCredentialSaved ? "Auto-connect credential saved. Compass can sign back in automatically when the saved Supabase session expires." : "When enabled, enter your password once to store an encrypted device-only auto-connect credential."}</small></span>
        </label>
        <p className="captains-log-cloud-remember-note">Compass normally keeps the renewable Supabase session locally. Remember this device adds automatic re-sign-in if that session becomes invalid. The saved password is encrypted with a non-exportable key stored only in this browser.</p>
        <div className="captains-log-cloud-footer">
          <div className={`captains-log-cloud-status${connected ? " is-connected" : ""}`} role="status">{status}</div>
          <div className="captains-log-cloud-actions">
            <button className="button secondary" type="button" disabled={busy} onClick={saveOnly}>Save connection</button>
            {connected
              ? <>{needsDevicePassword && <button className="button primary" type="button" disabled={busy || !password} onClick={() => void saveDeviceSignIn()}>{busy ? "Saving…" : "Save device sign-in"}</button>}<button className="button secondary" type="button" disabled={busy} onClick={() => void disconnect()}>Disconnect</button></>
              : remembered
                ? <><button className="button primary" type="button" disabled={busy} onClick={() => void retrySavedSession()}>{busy ? "Retrying…" : "Retry saved sign-in"}</button><button className="button secondary" type="button" disabled={busy} onClick={() => void disconnect("Saved sign-in cleared. Enter your password to sign in again.")}>Sign in again</button></>
                : <button className="button primary" type="button" disabled={busy || !password || !config.url || !config.anonKey || !config.email} onClick={() => void connect()}>{busy ? "Connecting…" : "Connect"}</button>}
          </div>
        </div>
      </div>

      <CompassMasterBackupSettings />
    </div>
  </section>;
}
