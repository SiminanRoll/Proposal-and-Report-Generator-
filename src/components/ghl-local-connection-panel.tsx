"use client";

import { useEffect, useRef, useState } from "react";
import {
  createGhlBrowserApi, GHL_LOCAL_SETTINGS_KEY, isGhlId,
  parseLocalSettings,
} from "@/lib/compass/ghl-browser-api.mjs";
import { saveDurableDatabaseMirrorNow } from "@/lib/compass/durable-storage";

export type LocalGhlConfig = { token: string; locationId: string; assigneeId: string };
export type GhlTaskClient = { clientId: string; companyName: string };
type Contact = { id: string; companyName: string; displayName: string; email: string };
type Link = { companyName: string; contactId: string; businessId?: string };

const LINK_KEY = "client-compass.ghl-local-mappings.v1";
const LOCATION_ID = "EHEhS0N72GQuZrYYzyAJ";

function loadLinks(): Record<string, Link> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LINK_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, Link> : {};
  } catch { return {}; }
}
function rememberLink(client: GhlTaskClient, contactId: string): void {
  const links = loadLinks();
  links[client.clientId] = { companyName: client.companyName, contactId };
  localStorage.setItem(LINK_KEY, JSON.stringify(links));
}
function savedContact(client: GhlTaskClient): string {
  const link = loadLinks()[client.clientId];
  return link?.companyName === client.companyName && isGhlId(link.contactId)
    ? link.contactId : "";
}
async function saveToDocuments(): Promise<"saved" | "browser-only"> {
  const result = await saveDurableDatabaseMirrorNow();
  return result.connected && result.permission === "granted" ? "saved" : "browser-only";
}

export function GhlLocalConnectionPanel({
  clients, onConfig, onLinked,
}: {
  clients: GhlTaskClient[];
  onConfig: (value: LocalGhlConfig | null) => void;
  onLinked: (clientId: string, contactId: string | null) => void;
}) {
  const [connection, setConnection] = useState<LocalGhlConfig | null>(null);
  const [editing, setEditing] = useState(false);
  const [token, setToken] = useState("");
  const [locationId, setLocationId] = useState(LOCATION_ID);
  const [assigneeId, setAssigneeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, Contact[]>>({});
  const [linked, setLinked] = useState<Record<string, string>>({});
  const [retry, setRetry] = useState(0);
  const callbacks = useRef({ onConfig, onLinked });
  callbacks.current = { onConfig, onLinked };
  const currentClients = useRef(clients);
  currentClients.current = clients;
  const clientKeys = clients.map((client) => client.clientId + ":" + client.companyName).join("|");

  useEffect(() => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(GHL_LOCAL_SETTINGS_KEY) || "null");
      const saved = parseLocalSettings(raw);
      if (saved && saved.assigneeId) {
        setConnection(saved);
        setToken(saved.token);
        setLocationId(saved.locationId);
        setAssigneeId(saved.assigneeId);
        callbacks.current.onConfig(saved);
        return;
      }
      if (saved) {
        setToken(saved.token);
        setLocationId(saved.locationId);
        setAssigneeId(saved.assigneeId);
      }
    } catch { /* New setup. */ }
    setEditing(true);
  }, []);

  useEffect(() => {
    if (!connection) return;
    let active = true;
    const selected = currentClients.current;
    setLoading(true);
    setMessage("");
    setIssues({});
    setChoices({});
    setLinked({});
    for (const client of selected) callbacks.current.onLinked(client.clientId, null);

    const resolveOne = async (client: GhlTaskClient) => {
      const api = createGhlBrowserApi(connection);
      try {
        const previouslyLinked = savedContact(client);
        if (previouslyLinked) {
          try {
            await api.verifyCompanyContact(previouslyLinked, client.companyName);
            if (!active) return;
            setLinked((current) => ({ ...current, [client.clientId]: previouslyLinked }));
            callbacks.current.onLinked(client.clientId, previouslyLinked);
            return;
          } catch {
            // Saved links are hints only; a failed check must be resolved from GHL again.
          }
        }
        const matches = await api.findCompanyContacts(client.companyName);
        if (!active) return;
        if (matches.length === 0) {
          setIssues((current) => ({ ...current, [client.clientId]: "No matching GHL contact. Check the company name in GHL." }));
          return;
        }
        if (matches.length > 1) {
          setChoices((current) => ({ ...current, [client.clientId]: matches }));
          setIssues((current) => ({ ...current, [client.clientId]: "Choose the contact for this company once." }));
          return;
        }
        await api.verifyCompanyContact(matches[0].id, client.companyName);
        if (!active) return;
        rememberLink(client, matches[0].id);
        setLinked((current) => ({ ...current, [client.clientId]: matches[0].id }));
        callbacks.current.onLinked(client.clientId, matches[0].id);
      } catch (cause) {
        if (!active) return;
        setIssues((current) => ({ ...current, [client.clientId]:
          cause instanceof Error ? cause.message : "Unable to check this company in GHL." }));
      }
    };

    void (async () => {
      let cursor = 0;
      const worker = async () => {
        while (cursor < selected.length && active) {
          const client = selected[cursor++];
          await resolveOne(client);
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, selected.length) }, () => worker()));
      if (!active) return;
      setLoading(false);
      try { await saveToDocuments(); } catch { /* Browser storage remains available. */ }
    })();
    return () => { active = false; };
    // Reconnect only when saved GHL settings or selected clients change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.token, connection?.locationId, connection?.assigneeId, clientKeys, retry]);

  async function saveSettings() {
    const next = parseLocalSettings({
      token: token.trim(), locationId: locationId.trim(), assigneeId: assigneeId.trim(),
    });
    if (!next?.assigneeId) {
      setMessage("Enter your GHL token and assigned user ID once.");
      return;
    }
    try { localStorage.setItem(GHL_LOCAL_SETTINGS_KEY, JSON.stringify(next)); }
    catch {
      setMessage("This browser did not allow the connection to be saved.");
      return;
    }
    setConnection(next);
    setEditing(false);
    callbacks.current.onConfig(next);
    try {
      const status = await saveToDocuments();
      setMessage(status === "saved" ?
        "Connection saved with your Client Compass Documents backup." :
        "Connection saved in this browser. Documents backup can be enabled in Settings.");
    } catch {
      setMessage("Connection saved in this browser. The Documents backup could not be updated.");
    }
  }

  async function chooseContact(client: GhlTaskClient, contactId: string) {
    if (!connection || !isGhlId(contactId)) return;
    setLoading(true);
    try {
      const api = createGhlBrowserApi(connection);
      await api.verifyCompanyContact(contactId, client.companyName);
      rememberLink(client, contactId);
      setLinked((current) => ({ ...current, [client.clientId]: contactId }));
      setChoices((current) => { const next = { ...current }; delete next[client.clientId]; return next; });
      setIssues((current) => { const next = { ...current }; delete next[client.clientId]; return next; });
      callbacks.current.onLinked(client.clientId, contactId);
      await saveToDocuments().catch(() => undefined);
    } catch (cause) {
      setIssues((current) => ({ ...current, [client.clientId]:
        cause instanceof Error ? cause.message : "Unable to link this contact." }));
    } finally { setLoading(false); }
  }

  function forget() {
    localStorage.removeItem(GHL_LOCAL_SETTINGS_KEY);
    setConnection(null);
    setEditing(true);
    setToken("");
    callbacks.current.onConfig(null);
    for (const client of clients) callbacks.current.onLinked(client.clientId, null);
    setLinked({});
    setMessage("This browser's GHL connection was cleared.");
    void saveToDocuments().catch(() => undefined);
  }

  return <section style={{ marginTop: 10, fontSize: 13 }}>
    {connection && !editing ? (
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, color: "#42617b" }}>
        <strong style={{ color: "#196a44" }}>GHL connected on this device</strong>
        {loading ? <span role="status">Matching selected clients…</span> :
          <span role="status">{Object.keys(linked).length} of {clients.length} clients ready</span>}
        <button type="button" onClick={() => setEditing(true)} style={{ marginLeft: "auto", background: "none", border: 0, color: "#1766a6", cursor: "pointer" }}>Connection settings</button>
      </div>
    ) : (
      <div style={{ padding: 14, background: "#f5f9fc", border: "1px solid #cfdeeb", borderRadius: 10 }}>
        <strong>Connect GoHighLevel once</strong>
        <p style={{ margin: "5px 0 12px", color: "#526b83", fontSize: 12 }}>
          Stored locally in this browser and your connected Documents Work Folder backup.
          The backup includes the token in readable form. Keep that private folder protected.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 9 }}>
          <label>GHL API token<input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)}
            style={{ display: "block", width: "100%", padding: 8, border: "1px solid #bbcedf", borderRadius: 7 }} /></label>
          <label>Location ID<input value={locationId} onChange={(event) => setLocationId(event.target.value)}
            style={{ display: "block", width: "100%", padding: 8, border: "1px solid #bbcedf", borderRadius: 7 }} /></label>
          <label>Assigned GHL user ID<input value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}
            style={{ display: "block", width: "100%", padding: 8, border: "1px solid #bbcedf", borderRadius: 7 }} /></label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => void saveSettings()} style={{ background: "#1766a6", color: "white", border: 0, borderRadius: 7, padding: "9px 15px", cursor: "pointer" }}>Save connection</button>
          {connection && <button type="button" onClick={() => setEditing(false)} style={{ border: "1px solid #b4c8d9", background: "white", borderRadius: 7, padding: "9px 12px" }}>Cancel</button>}
          {connection && <button type="button" onClick={forget} style={{ marginLeft: "auto", background: "none", border: 0, color: "#a13d35" }}>Forget</button>}
        </div>
      </div>
    )}
    {message && <p role="status" style={{ color: "#526b83", margin: "8px 0" }}>{message}</p>}
    {connection && !loading && Object.keys(issues).length > 0 &&
      <div style={{ marginTop: 10, background: "#fffaf1", border: "1px solid #e7d9b0", padding: 12, borderRadius: 8 }}>
        <strong>One-time contact selection</strong>
        {clients.filter((client) => !!issues[client.clientId]).map((client) => (
          <div key={client.clientId} style={{ marginTop: 7 }}>
            <strong>{client.companyName}</strong>
            <span style={{ display: "block", color: "#715d45", fontSize: 12 }}>{issues[client.clientId]}</span>
            {choices[client.clientId]?.length ? (
              <select aria-label={"GHL contact for " + client.companyName} defaultValue=""
                onChange={(event) => void chooseContact(client, event.target.value)}
                style={{ marginTop: 5, padding: 7, borderRadius: 6, maxWidth: "100%" }}>
                <option value="">Choose contact…</option>
                {choices[client.clientId].map((contact) =>
                  <option key={contact.id} value={contact.id}>
                    {contact.displayName}{contact.email ? " (" + contact.email + ")" : ""}
                  </option>)}
              </select>
            ) : <button type="button" disabled={loading} onClick={() => setRetry((n) => n + 1)}
              style={{ marginTop: 5, border: "1px solid #d1b877", background: "white", borderRadius: 6, padding: "5px 9px" }}>Retry match</button>}
          </div>
        ))}
      </div>}
  </section>;
}
