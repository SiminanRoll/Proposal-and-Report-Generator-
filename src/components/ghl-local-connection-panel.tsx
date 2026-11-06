"use client";

import { useEffect, useState } from "react";
import {
  createGhlBrowserApi, GHL_LOCAL_SETTINGS_KEY, isGhlId,
  normalizedGhlName, parseLocalSettings,
} from "@/lib/compass/ghl-browser-api.mjs";
import type { GhlTaskIdentityCandidate } from "@/lib/compass/ghl-task-intake-preflight.mjs";
import type { GhlTaskReadbackSnapshot } from "@/lib/compass/ghl-task-awareness.mjs";

export type LocalGhlConfig = {
  token: string;
  locationId: string;
  assigneeId: string;
};
type Client = { clientId: string; companyName: string };
type Props = {
  clients: Client[];
  onConfig: (settings: LocalGhlConfig | null) => void;
  onVerified: (clientId: string, identity: GhlTaskIdentityCandidate | null, snapshot: GhlTaskReadbackSnapshot | null) => void;
};
type Business = { businessId: string; name: string };
type StoredLink = { companyName: string; businessId: string; contactId?: string };
const LINK_KEY = "client-compass.ghl-local-mappings.v1";
const DEFAULT_LOCATION = "EHEhS0N72GQuZrYYzyAJ";

function storageLinks(): Record<string, StoredLink> {
  try {
    const read = JSON.parse(localStorage.getItem(LINK_KEY) || "{}") as unknown;
    return read && typeof read === "object" && !Array.isArray(read)
      ? read as Record<string, StoredLink> : {};
  } catch { return {}; }
}
function saveLink(client: Client, businessId: string, contactId: string) {
  try {
    const next = storageLinks();
    next[client.clientId] = { companyName: client.companyName, businessId, contactId };
    localStorage.setItem(LINK_KEY, JSON.stringify(next));
  } catch {}
}
function readSavedLink(client: Client): StoredLink | null {
  const entry = storageLinks()[client.clientId];
  return entry?.companyName === client.companyName &&
    isGhlId(entry?.businessId) && (!entry.contactId || isGhlId(entry.contactId)) ? entry : null;
}

/**
 * A user chooses to store a private integration token in this browser's
 * localStorage. It is never in public source or DigitalOcean build env vars.
 * It is not safe from XSS/compromised extensions: the UI makes this explicit.
 */
export function GhlLocalConnectionPanel({ clients, onConfig, onVerified }: Props) {
  const [tokenInput, setTokenInput] = useState("");
  const [locationId, setLocationId] = useState(DEFAULT_LOCATION);
  const [assigneeId, setAssigneeId] = useState("");
  const [configured, setConfigured] = useState<LocalGhlConfig | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [allBusinesses, setAllBusinesses] = useState<Business[] | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Record<string, string>>({});
  const [selectedContact, setSelectedContact] = useState<Record<string, string>>({});
  const [contactChoices, setContactChoices] = useState<Record<string, string[]>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [generalStatus, setGeneralStatus] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    try {
      const settings = parseLocalSettings(JSON.parse(localStorage.getItem(GHL_LOCAL_SETTINGS_KEY) || "null"));
      if (settings) {
        setTokenInput(settings.token);
        setLocationId(settings.locationId);
        setAssigneeId(settings.assigneeId);
        setConfigured(settings);
        setAcknowledged(true);
        onConfig(settings);
      }
    } catch { /* No local credentials saved. */ }
    // Only hydrate once on mount. Parent callbacks are not part of credential lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearVerified() {
    for (const client of clients) onVerified(client.clientId, null, null);
    setAllBusinesses(null);
    setSelectedBusiness({});
    setSelectedContact({});
    setContactChoices({});
    setStatuses({});
  }

  function configure() {
    const value = parseLocalSettings({ token: tokenInput.trim(), locationId: locationId.trim(), assigneeId: assigneeId.trim() });
    if (!value || !acknowledged) {
      setGeneralStatus("Enter a valid token, location ID, and acknowledge the local browser-storage risk.");
      return;
    }
    try { localStorage.setItem(GHL_LOCAL_SETTINGS_KEY, JSON.stringify(value)); }
    catch { setGeneralStatus("Browser storage is blocked; credentials will not persist after closing."); }
    setConfigured(value);
    onConfig(value);
    clearVerified();
    setGeneralStatus("Token saved only in this browser. Test the connection to check GHL API/CORS access.");
  }

  function forget() {
    try { localStorage.removeItem(GHL_LOCAL_SETTINGS_KEY); }
    catch {}
    setTokenInput("");
    setAssigneeId("");
    setConfigured(null);
    setAcknowledged(false);
    onConfig(null);
    clearVerified();
    setGeneralStatus("Local GHL token removed from this browser.");
  }

  async function findBusinesses() {
    if (!configured || working) return;
    setWorking(true);
    setGeneralStatus("Contacting GHL directly from this browser…");
    try {
      const api = createGhlBrowserApi(configured);
      const businesses = await api.listBusinesses();
      setAllBusinesses(businesses);
      setGeneralStatus("GHL connection successful. Found " + businesses.length + " existing businesses. Select the correct company and verify its contacts.");
    } catch (err) {
      setAllBusinesses(null);
      setGeneralStatus(err instanceof Error ? err.message : "GHL request failed.");
    } finally { setWorking(false); }
  }

  async function verify(client: Client) {
    if (!configured || working) return;
    const saved = readSavedLink(client);
    const businessId = selectedBusiness[client.clientId] || saved?.businessId || "";
    const contactId = selectedContact[client.clientId] || saved?.contactId;
    if (!isGhlId(businessId)) {
      setStatuses((current) => ({ ...current, [client.clientId]: "Select an existing GHL business first." }));
      return;
    }
    onVerified(client.clientId, null, null);
    setWorking(true);
    setStatuses((current) => ({ ...current, [client.clientId]: "Checking GHL company, contacts, and tasks…" }));
    try {
      const api = createGhlBrowserApi(configured);
      const result = await api.verifyClient({
        clientId: client.clientId,
        companyName: client.companyName,
        businessId,
        selectedContactId: contactId,
      });
      if (result.status === "verified_read" && result.identity?.selectedContactId && result.taskReadback) {
        onVerified(client.clientId, result.identity, result.taskReadback);
        saveLink(client, businessId, result.identity.selectedContactId);
        setStatuses((current) => ({ ...current, [client.clientId]:
          "Verified " + result.taskReadback.tasks.length + " contact task(s). Existing records only." }));
      } else if (result.reason === "ambiguous_contact" && Array.isArray(result.contactCandidates)) {
        const ids = result.contactCandidates.filter(isGhlId);
        setContactChoices((current) => ({ ...current, [client.clientId]: ids }));
        setStatuses((current) => ({ ...current, [client.clientId]:
          "Multiple associated contacts found. Choose the intended GHL contact and verify again." }));
      } else {
        setStatuses((current) => ({ ...current, [client.clientId]:
          "Could not verify: " + String(result.reason || "unknown").replaceAll("_", " ") }));
      }
    } catch (err) {
      setStatuses((current) => ({ ...current, [client.clientId]:
        err instanceof Error ? err.message : "GHL lookup unavailable." }));
    } finally { setWorking(false); }
  }

  return <section style={{ border: "1px solid #bdd3e6", borderRadius: 10, padding: 14, background: "#f5f9fd", marginTop: 12 }}>
    <strong>GHL connection on this device</strong>
    <p style={{ color: "#526b83", fontSize: 12, margin: "6px 0 10px" }}>
      Enter your Private Integration Token once. It stays in this browser's localStorage and is never built into the website.
      Local storage is not a secure vault: site scripts, malicious extensions, or anyone with access to this browser may read it.
      The GHL API may also block direct browser requests through CORS.
    </p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 9 }}>
      <label style={{ display: "grid", fontSize: 12, gap: 4 }}>Private Integration Token
        <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
          autoComplete="off" placeholder="Stored only in this browser"
          style={{ border: "1px solid #c4d4e2", borderRadius: 6, padding: 8 }} />
      </label>
      <label style={{ display: "grid", fontSize: 12, gap: 4 }}>GHL Location ID
        <input value={locationId} onChange={(e) => setLocationId(e.target.value)}
          style={{ border: "1px solid #c4d4e2", borderRadius: 6, padding: 8 }} />
      </label>
      <label style={{ display: "grid", fontSize: 12, gap: 4 }}>Patric's GHL User ID (for task assignment)
        <input value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
          placeholder="Required for task creation"
          style={{ border: "1px solid #c4d4e2", borderRadius: 6, padding: 8 }} />
      </label>
    </div>
    <label style={{ fontSize: 12, display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
      <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
      I understand my browser stores this token and accept the local-device security risk.
    </label>
    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" onClick={configure} disabled={!acknowledged || working}
        style={{ padding: "8px 12px", background: "#1766a6", color: "#fff", border: 0, borderRadius: 7 }}>
        Save locally
      </button>
      <button type="button" onClick={() => void findBusinesses()} disabled={!configured || working}
        style={{ padding: "8px 12px", border: "1px solid #aec7df", background: "white", borderRadius: 7 }}>
        Test GHL connection and find businesses
      </button>
      <button type="button" onClick={forget} disabled={working}
        style={{ padding: "8px 12px", border: "1px solid #d5dfe7", background: "white", borderRadius: 7 }}>
        Forget token
      </button>
    </div>
    {generalStatus && <div role="status" style={{ color: "#526b83", fontSize: 12, marginTop: 9 }}>{generalStatus}</div>}
    {configured && <div style={{ marginTop: 10, display: "grid", gap: 8, maxHeight: 260, overflowY: "auto" }}>
      {clients.map((client) => {
        const matches = (allBusinesses || []).filter((b) => normalizedGhlName(b.name) === normalizedGhlName(client.companyName));
        const saved = readSavedLink(client);
        const selected = selectedBusiness[client.clientId] || saved?.businessId || "";
        const contacts = contactChoices[client.clientId] || [];
        return <div key={client.clientId} style={{ background: "#fff", border: "1px solid #dbe6f0", borderRadius: 8, padding: 9 }}>
          <strong style={{ fontSize: 12 }}>{client.companyName}</strong>
          <div style={{ fontSize: 11, color: "#62778a" }}>
            {allBusinesses ? (matches.length === 0 ? "No exact-name match found" :
              matches.length === 1 ? "One exact-name match" : "Multiple exact matches; choose carefully") :
              "Find businesses to select an existing GHL record"}
          </div>
          {!!matches.length && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
            {matches.map((b) => <button key={b.businessId} type="button"
              onClick={() => {
                setSelectedBusiness((current) => ({ ...current, [client.clientId]: b.businessId }));
                setSelectedContact((current) => { const n = { ...current }; delete n[client.clientId]; return n; });
                onVerified(client.clientId, null, null);
              }}
              style={{ padding: "5px 7px", borderRadius: 6, fontSize: 11, border: "1px solid #bad1e3", background: selected === b.businessId ? "#dcecff" : "#f5f9fd" }}>
              {selected === b.businessId ? "Selected · " : "Select · "}{b.businessId}
            </button>)}
          </div>}
          {!!saved && <div style={{ fontSize: 11, color: "#526b83" }}>Previously verified business: {saved.businessId}</div>}
          {!!contacts.length && <select value={selectedContact[client.clientId] || ""} aria-label={"GHL contact for " + client.companyName}
            onChange={(e) => setSelectedContact((current) => ({ ...current, [client.clientId]: e.target.value }))}
            style={{ padding: 5, marginRight: 6, fontSize: 11 }}>
            <option value="">Choose a contact</option>
            {contacts.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>}
          <button type="button" disabled={working || !selected} onClick={() => void verify(client)}
            style={{ padding: "6px 9px", marginTop: 5, fontSize: 11, borderRadius: 6, border: "1px solid #bad1e3", background: "#eef6fd" }}>
            Verify company, contact and tasks
          </button>
          {statuses[client.clientId] && <div role="status" style={{ fontSize: 11, marginTop: 6 }}>{statuses[client.clientId]}</div>}
        </div>;
      })}
    </div>}
  </section>;
}
