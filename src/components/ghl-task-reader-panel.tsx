"use client";

import { useEffect, useState } from "react";
import type { GhlTaskIdentityCandidate } from "@/lib/compass/ghl-task-intake-preflight.mjs";
import type { GhlTaskReadbackSnapshot } from "@/lib/compass/ghl-task-awareness.mjs";

export type GhlReaderClient = { clientId: string; companyName: string };
type Link = { companyName: string; businessId: string; contactId?: string };
type Candidate = { businessId: string; name: string };
type Match = { clientId: string; status: "exact_match" | "ambiguous" | "not_found"; candidates: Candidate[]; truncated?: boolean };
type ReadReply = {
  clientId: string;
  status: "verified_read" | "not_checked";
  reason: string;
  identity: GhlTaskIdentityCandidate | null;
  taskReadback: GhlTaskReadbackSnapshot | null;
  contactCandidates: string[];
};
type Props = {
  clients: GhlReaderClient[];
  onVerified: (clientId: string, identity: GhlTaskIdentityCandidate | null, taskReadback: GhlTaskReadbackSnapshot | null) => void;
};

const STORE_KEY = "client-compass.ghl-verified-business-links.v1";
const ID = /^[A-Za-z0-9_-]{8,128}$/;
const nameKey = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");

function validLink(client: GhlReaderClient, entry: unknown): entry is Link {
  if (!entry || typeof entry !== "object") return false;
  const record = entry as Partial<Link>;
  return record.companyName === client.companyName &&
    typeof record.businessId === "string" && ID.test(record.businessId) &&
    (record.contactId == null || (typeof record.contactId === "string" && ID.test(record.contactId)));
}

/**
 * GHL Private Integration Token never enters this component.
 * The independent reader access secret is explicitly entered each session and
 * held in React memory only; it is not persisted, logged, or put into URLs.
 * All lookups are read-only, authenticated, same-origin requests to DigitalOcean.
 */
export function GhlTaskReaderPanel({ clients, onVerified }: Props) {
  const [accessSecret, setAccessSecret] = useState("");
  const [links, setLinks] = useState<Record<string, Link>>({});
  const [selectedBusiness, setSelectedBusiness] = useState<Record<string, string>>({});
  const [selectedContact, setSelectedContact] = useState<Record<string, string>>({});
  const [manualBusiness, setManualBusiness] = useState<Record<string, string>>({});
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("");
  const [generalError, setGeneralError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      const obj = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown> : {};
      const found: Record<string, Link> = {};
      for (const client of clients) {
        if (validLink(client, obj[client.clientId])) found[client.clientId] = obj[client.clientId] as Link;
      }
      setLinks(found);
    } catch {
      setLinks({});
    }
  }, [clients]);

  function saveLink(client: GhlReaderClient, businessId: string, contactId?: string) {
    const entry: Link = { companyName: client.companyName, businessId, ...(contactId ? { contactId } : {}) };
    setLinks((current) => ({ ...current, [client.clientId]: entry }));
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const record: Record<string, Link> = raw ? JSON.parse(raw) : {};
      record[client.clientId] = entry;
      localStorage.setItem(STORE_KEY, JSON.stringify(record));
    } catch {
      // Browser storage disabled: lookup still works for this open dialog.
    }
  }

  function forget(client: GhlReaderClient) {
    setLinks((current) => { const next = { ...current }; delete next[client.clientId]; return next; });
    setSelectedBusiness((current) => { const next = { ...current }; delete next[client.clientId]; return next; });
    setSelectedContact((current) => { const next = { ...current }; delete next[client.clientId]; return next; });
    setIssues((current) => ({ ...current, [client.clientId]: "" }));
    onVerified(client.clientId, null, null);
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const record: Record<string, Link> = raw ? JSON.parse(raw) : {};
      delete record[client.clientId];
      localStorage.setItem(STORE_KEY, JSON.stringify(record));
    } catch {}
  }

  async function request(path: "businesses/matches" | "tasks/read", body: object): Promise<unknown> {
    if (accessSecret.trim().length < 32) throw new Error("Enter the separate reader access secret (32+ characters).");
    let response: Response;
    try {
      response = await fetch("/api/ghl/" + path, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + accessSecret.trim(),
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("GHL read service not reachable at this app address.");
    }
    if (response.status === 401) throw new Error("Reader access secret was rejected.");
    if (response.status === 403) throw new Error("This site origin is not authorized for GHL reads.");
    if (response.status === 503) throw new Error("GHL read service is not configured on DigitalOcean.");
    if (!response.ok) throw new Error("GHL read unavailable. No changes were made.");
    try { return await response.json(); }
    catch { throw new Error("GHL read returned an invalid response."); }
  }

  async function findMatches() {
    if (working || !clients.length) return;
    setWorking(true);
    setGeneralError("");
    setProgress("Finding exact GHL business-name matches…");
    try {
      const found: Record<string, Match> = {};
      for (let i = 0; i < clients.length; i += 50) {
        const batch = clients.slice(i, i + 50);
        const reply = await request("businesses/matches", {
          clients: batch.map(({ clientId, companyName }) => ({ clientId, companyName })),
        }) as { results?: Match[] };
        if (!reply || !Array.isArray(reply.results) || reply.results.length !== batch.length) {
          throw new Error("GHL returned an incomplete match list. No client was automatically linked.");
        }
        for (const entry of reply.results) {
          const selected = batch.find((c) => c.clientId === entry?.clientId);
          if (!selected || !["exact_match", "not_found", "ambiguous"].includes(entry.status) ||
              !Array.isArray(entry.candidates) ||
              entry.candidates.some((candidate) => !ID.test(candidate.businessId) || nameKey(candidate.name) !== nameKey(selected.companyName))) {
            throw new Error("GHL returned a contradictory business match list.");
          }
          found[entry.clientId] = entry;
        }
        setProgress("Checked " + Math.min(i + 50, clients.length) + " / " + clients.length + " clients");
      }
      setMatches(found);
      setProgress("Exact matches found. Confirm each business before reading tasks.");
    } catch (err) {
      setMatches({});
      setGeneralError(err instanceof Error ? err.message : "GHL lookup failed.");
      setProgress("");
    } finally {
      setWorking(false);
    }
  }

  function selectBusiness(client: GhlReaderClient, businessId: string) {
    if (!ID.test(businessId)) return;
    const match = matches[client.clientId];
    if (!match?.candidates.some((candidate) =>
      candidate.businessId === businessId && nameKey(candidate.name) === nameKey(client.companyName))) return;
    setSelectedBusiness((current) => ({ ...current, [client.clientId]: businessId }));
    setSelectedContact((current) => { const next = { ...current }; delete next[client.clientId]; return next; });
    onVerified(client.clientId, null, null);
    setIssues((current) => ({ ...current, [client.clientId]: "Business selected. Read GHL to verify its contacts and tasks." }));
  }

  async function readOne(client: GhlReaderClient, businessId: string, contactId?: string) {
    if (!ID.test(businessId)) {
      setIssues((current) => ({ ...current, [client.clientId]: "Select an existing business or enter its exact GHL business ID." }));
      return false;
    }
    onVerified(client.clientId, null, null);
    try {
      const response = await request("tasks/read", {
        clientId: client.clientId,
        businessId,
        companyName: client.companyName,
        ...(contactId && ID.test(contactId) ? { selectedContactId: contactId } : {}),
      }) as ReadReply;
      if (!response || response.clientId !== client.clientId ||
        (response.status !== "verified_read" && response.status !== "not_checked")) {
        throw new Error("GHL returned an unverified task response.");
      }
      if (response.status === "verified_read") {
        const identity = response.identity;
        const snapshot = response.taskReadback;
        if (!identity?.verified || identity.businessId !== businessId ||
            snapshot?.status !== "verified_read" || snapshot.clientId !== client.clientId ||
            snapshot.businessId !== businessId) {
          throw new Error("GHL task readback failed company/contact verification.");
        }
        onVerified(client.clientId, identity, snapshot);
        saveLink(client, businessId, identity.selectedContactId);
        setIssues((current) => ({ ...current, [client.clientId]:
          "Verified: " + snapshot.tasks.length + " GHL contact task(s) read. No tasks created." }));
        return true;
      }
      const reason = response.reason || "not_checked";
      if (reason === "ambiguous_contact" && Array.isArray(response.contactCandidates)) {
        setIssues((current) => ({ ...current, [client.clientId]:
          "Multiple contacts belong to this business. Choose the intended contact below." }));
        setCandidates((current) => ({ ...current, [client.clientId]: response.contactCandidates.filter((id) => ID.test(id)) }));
      } else {
        setIssues((current) => ({ ...current, [client.clientId]:
          reason === "business_name_mismatch" ? "GHL business name does not exactly match this Compass client." :
          "Could not verify existing tasks: " + reason.replaceAll("_", " ") }));
      }
      return false;
    } catch (err) {
      setIssues((current) => ({ ...current, [client.clientId]:
        err instanceof Error ? err.message : "GHL lookup unavailable." }));
      return false;
    }
  }

  const [candidates, setCandidates] = useState<Record<string, string[]>>({});
  async function readSelected() {
    if (working) return;
    setWorking(true);
    setGeneralError("");
    let done = 0;
    try {
      // Sequential reads limit upstream GHL API bursts and keep per-client
      // failures independent. An interrupted run doesn't mark unread rows empty.
      for (const client of clients) {
        const businessId = selectedBusiness[client.clientId] ||
          links[client.clientId]?.businessId || manualBusiness[client.clientId]?.trim() || "";
        if (!ID.test(businessId)) continue;
        await readOne(client, businessId,
          selectedContact[client.clientId] || links[client.clientId]?.contactId);
        done++;
        setProgress("Read " + done + " existing GHL business(es).");
      }
      if (!done) setGeneralError("Find and confirm an existing GHL business first.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section aria-label="GHL existing tasks read-only" style={{
      border: "1px solid #cbddec", padding: 14, borderRadius: 10, background: "#f8fbfe", marginTop: 14,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>Connect existing GHL records (read only)</div>
      <p style={{ fontSize: 12, margin: "6px 0 10px", color: "#526b83" }}>
        Uses the secured DigitalOcean read service. Enter only the separate reader-access secret, never the GHL Private Integration Token.
        The secret stays in memory for this dialog; verified company IDs are saved in this browser only.
      </p>
      <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
        Reader access secret (session only)
        <input type="password" autoComplete="off" value={accessSecret} onChange={(event) => setAccessSecret(event.target.value)}
          placeholder="Separate reader secret" style={{ padding: 9, border: "1px solid #cbddec", borderRadius: 7, width: "100%" }} />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <button type="button" disabled={working || !clients.length} onClick={() => void findMatches()}
          style={{ padding: "8px 12px", borderRadius: 8, background: "#ecf4ff", border: "1px solid #9fbddd", cursor: "pointer" }}>
          Find exact GHL company matches
        </button>
        <button type="button" disabled={working || !clients.length} onClick={() => void readSelected()}
          style={{ padding: "8px 12px", borderRadius: 8, background: "#1864ae", color: "white", border: 0, cursor: "pointer" }}>
          Read tasks for linked clients
        </button>
        <button type="button" onClick={() => setAccessSecret("")} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ccd9e5", background: "white" }}>
          Clear reader secret
        </button>
      </div>
      {progress && <p role="status" style={{ fontSize: 12, color: "#315b76", margin: "8px 0" }}>{progress}</p>}
      {generalError && <p role="alert" style={{ fontSize: 12, color: "#a13535", margin: "8px 0" }}>{generalError}</p>}
      <div style={{ maxHeight: 265, overflow: "auto", marginTop: 10, display: "grid", gap: 7 }}>
        {clients.map((client) => {
          const match = matches[client.clientId];
          const linked = links[client.clientId];
          const picked = selectedBusiness[client.clientId] || linked?.businessId || "";
          const optionIds = candidates[client.clientId] || [];
          return <div key={client.clientId} style={{ background: "#fff", border: "1px solid #dce7f1", padding: 10, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <strong style={{ fontSize: 12 }}>{client.companyName}</strong>
              <span style={{ fontSize: 11, color: "#526b83" }}>{linked ? "Previously verified ID saved locally" : match?.status === "exact_match" ? "One exact GHL match" : match?.status === "ambiguous" ? "Multiple exact names" : match?.status === "not_found" ? "No exact name match" : "Not matched"}</span>
            </div>
            {!!match?.candidates.length && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {match.candidates.map((candidate) => <button key={candidate.businessId} type="button"
                style={{ background: picked === candidate.businessId ? "#dceafa" : "#f5f8fb", border: "1px solid #c2d7e6", borderRadius: 6, padding: "5px 8px", fontSize: 11 }}
                onClick={() => selectBusiness(client, candidate.businessId)}>
                {picked === candidate.businessId ? "Selected · " : "Confirm · "}{candidate.businessId}
              </button>)}
              {match.truncated && <span style={{ fontSize: 11 }}>Additional duplicates omitted; verify directly in GHL.</span>}
            </div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
              <input aria-label={"Existing GHL business ID for " + client.companyName}
                placeholder="Existing GHL business ID" value={manualBusiness[client.clientId] ?? picked}
                onChange={(event) => setManualBusiness((current) => ({ ...current, [client.clientId]: event.target.value }))}
                style={{ flex: "1 1 185px", minWidth: 120, border: "1px solid #ccdce8", padding: 6, borderRadius: 6, fontSize: 11 }} />
              {!!optionIds.length && <select aria-label={"Select associated contact for " + client.companyName}
                value={selectedContact[client.clientId] || ""}
                onChange={(event) => setSelectedContact((current) => ({ ...current, [client.clientId]: event.target.value }))}
                style={{ fontSize: 11, padding: 6 }}>
                <option value="">Choose a GHL contact ID</option>
                {optionIds.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>}
              <button type="button" disabled={working} onClick={() => void (async () => {
                setWorking(true);
                try {
                  await readOne(client, (manualBusiness[client.clientId] || picked).trim(),
                    selectedContact[client.clientId] || linked?.contactId);
                } finally { setWorking(false); }
              })()} style={{ fontSize: 11, padding: "6px 10px", borderRadius: 6, background: "#ecf4fc", border: "1px solid #afcce7" }}>
                Verify and read tasks
              </button>
              {linked && <button type="button" disabled={working} onClick={() => forget(client)}
                style={{ fontSize: 11, color: "#526b83", padding: "6px 10px" }}>Forget link</button>}
            </div>
            {issues[client.clientId] && <div role="status" style={{ fontSize: 11, marginTop: 5, color: "#385e79" }}>{issues[client.clientId]}</div>}
          </div>;
        })}
      </div>
    </section>
  );
}
