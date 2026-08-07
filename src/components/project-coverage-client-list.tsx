"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ProjectCoverageCardId, ProjectCoverageCardMetric, ProjectCoverageClient } from "@/lib/compass/project-coverage";
import { ProjectCoverageFilters, projectCoverageFilterMatches, type ProjectCoverageReasonFilter } from "./project-coverage-filters";
import { AnimatedNumber } from "./animated-number";
import { CAPTAINS_LOG_QUEUE_EVENT, clearCaptainsLogQueueEntry, markCaptainsLogQueueEntry, readCaptainsLogQueue, type CaptainsLogQueueEntry } from "@/lib/compass/captains-log-queue";
import { checkCaptainsLogCloudBridge, coordinationCallTaskTitle, nextBusinessDate, sendCoordinationCallToCaptainsLogReliable, syncClientFromCaptainsLog, type CaptainsLogClientSyncResult } from "@/lib/compass/captains-log-bridge";
import { requestQuickPresent } from "@/lib/compass/quick-present-events";

const INITIAL_CLIENT_COUNT = 5;

type SortKey = "default" | "client" | "activity" | "estimate" | "captains-log";
type SortDirection = "asc" | "desc";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string): string {
  if (!value) return "Not recorded";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "CC";
}

function projectNeed(client: ProjectCoverageClient): string {
  return client.projects.map((project) => project.title).join(" + ");
}

function lastActivity(client: ProjectCoverageClient): { primary: string; flag: string } {
  if (client.position === "quoted-open") {
    return {
      primary: client.quoteDate ? `Quoted ${formatDate(client.quoteDate)}` : "Quote date missing",
      flag: client.reviewHistoryMissing ? "Review history missing" : "Outcome still open",
    };
  }
  if (client.position === "discussed-open") {
    return {
      primary: client.reviewDate ? `Reviewed ${formatDate(client.reviewDate)}` : "Discussion recorded",
      flag: client.followUpPastDue ? "Follow-up past due" : "Decision still open",
    };
  }
  return {
    primary: "No review or quote",
    flag: client.noRelationshipHistory ? "No relationship history" : "Coverage needed",
  };
}

function listDescription(position: ProjectCoverageCardId): string {
  if (position === "needs-review") return "Highest-priority qualified needs that have not yet been reviewed or quoted.";
  if (position === "discussed-open") return "Qualified needs already discussed with the client but still missing a completed decision.";
  if (position === "quoted-open") return "Qualified needs with a recorded quote and no completed or otherwise resolved outcome.";
  if (position === "highest-risk") return "The qualified client book ordered by critical server exposure and technical severity.";
  if (position === "oldest-quotes") return "Open quotes ordered from the oldest re-engagement need to the most recent.";
  return "Qualified clients ordered by deduplicated estimated project-package value.";
}

function activityTimestamp(client: ProjectCoverageClient): number {
  const raw = client.quoteDate || client.reviewDate || client.nextFollowUp || "";
  if (!raw) return 0;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortIndicator(sortKey: SortKey, activeKey: SortKey, direction: SortDirection): string {
  if (sortKey !== activeKey) return "↕";
  return direction === "asc" ? "↑" : "↓";
}

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface Props {
  card: ProjectCoverageCardMetric;
  activeSegmentId?: string | null;
  onClearSegment?: () => void;
  onOpenClient: (clientId: string) => void;
  onCaptainsLogSync?: (clientId: string, sync: CaptainsLogClientSyncResult) => Promise<void> | void;
}

export function ProjectCoverageClientList({ card, activeSegmentId = null, onClearSegment, onOpenClient, onCaptainsLogSync }: Props) {
  const [activeFilter, setActiveFilter] = useState<ProjectCoverageReasonFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [queueMap, setQueueMap] = useState<Record<string, CaptainsLogQueueEntry>>({});
  const [quickClient, setQuickClient] = useState<ProjectCoverageClient | null>(null);
  const [quickDue, setQuickDue] = useState("");
  const [quickStatus, setQuickStatus] = useState("");
  const [quickSupabaseReady, setQuickSupabaseReady] = useState<boolean | null>(null);
  const [quickSending, setQuickSending] = useState(false);
  const [quickCheckingClientId, setQuickCheckingClientId] = useState("");
  const [quickMode, setQuickMode] = useState<"schedule" | "blocked" | "waiting">("schedule");
  const [quickSync, setQuickSync] = useState<CaptainsLogClientSyncResult | null>(null);

  useEffect(() => {
    setActiveFilter("all");
    setShowAll(false);
  }, [card.id]);

  useEffect(() => { setShowAll(false); }, [activeFilter]);
  useEffect(() => { setActiveFilter("all"); setShowAll(false); }, [activeSegmentId]);

  useEffect(() => {
    const syncQueue = () => setQueueMap(readCaptainsLogQueue());
    syncQueue();
    window.addEventListener("storage", syncQueue);
    window.addEventListener(CAPTAINS_LOG_QUEUE_EVENT, syncQueue as EventListener);
    return () => {
      window.removeEventListener("storage", syncQueue);
      window.removeEventListener(CAPTAINS_LOG_QUEUE_EVENT, syncQueue as EventListener);
    };
  }, []);

  const activeSegment = useMemo(() => card.stats.find((stat) => stat.id === activeSegmentId) ?? null, [activeSegmentId, card.stats]);
  const segmentedClients = useMemo(() => {
    if (!activeSegment) return card.clients;
    const clientIds = new Set(activeSegment.clientIds);
    return card.clients.filter((client) => clientIds.has(client.clientId));
  }, [activeSegment, card.clients]);
  const filteredClients = useMemo(
    () => segmentedClients.filter((client) => projectCoverageFilterMatches(client, activeFilter)),
    [activeFilter, segmentedClients],
  );

  const sortedClients = useMemo(() => {
    const clients = [...filteredClients];
    if (sortKey === "default") return clients;
    const dir = sortDirection === "asc" ? 1 : -1;
    clients.sort((left, right) => {
      if (sortKey === "client") return dir * left.clientName.localeCompare(right.clientName);
      if (sortKey === "activity") return dir * (activityTimestamp(left) - activityTimestamp(right) || left.clientName.localeCompare(right.clientName));
      if (sortKey === "estimate") return dir * (left.estimatedValue - right.estimatedValue || left.clientName.localeCompare(right.clientName));
      const leftAdded = Number(Boolean(left.captainsLogOpenTaskCount || queueMap[left.clientId]));
      const rightAdded = Number(Boolean(right.captainsLogOpenTaskCount || queueMap[right.clientId]));
      return dir * (leftAdded - rightAdded || left.clientName.localeCompare(right.clientName));
    });
    return clients;
  }, [filteredClients, queueMap, sortDirection, sortKey]);

  const visibleClients = showAll ? sortedClients : sortedClients.slice(0, INITIAL_CLIENT_COUNT);
  const hiddenCount = Math.max(0, sortedClients.length - visibleClients.length);
  const motionKey = `${card.id}-${activeSegmentId ?? "all-segments"}-${activeFilter}-${showAll ? "all" : "priority"}-${sortKey}-${sortDirection}`;

  const updateSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      if (sortDirection === "desc") setSortDirection("asc");
      else { setSortKey("default"); setSortDirection("desc"); }
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "client" ? "asc" : "desc");
  };

  const openQuickScheduler = async (client: ProjectCoverageClient) => {
    setQuickCheckingClientId(client.clientId);
    setQuickClient(client);
    setQuickDue(client.nextFollowUp?.slice(0, 10) || nextBusinessDate());
    setQuickStatus("Checking Supabase for current open work…");
    setQuickMode("waiting");
    setQuickSync(null);
    setQuickSupabaseReady(null);
    try {
      const sync = await syncClientFromCaptainsLog(client.clientId, client.clientName, 8000);
      setQuickSync(sync);
      if (sync.ok) await onCaptainsLogSync?.(client.clientId, sync);
      if (!sync.ok || !sync.synced_at) {
        setQuickMode("waiting");
        setQuickStatus("Supabase history could not confirm current open work. Scheduling stays locked.");
        return;
      }
      const openCount = Number(sync.open_task_count ?? sync.open_tasks?.length ?? 0);
      if (openCount > 0 || sync.has_open_tasks) {
        const first = sync.primary_open_task ?? sync.open_tasks?.[0];
        const queue = markCaptainsLogQueueEntry({
          clientId: client.clientId,
          company: client.clientName,
          dueDate: String(first?.scheduled_at || "").slice(0, 10),
          addedAt: sync.synced_at || new Date().toISOString(),
          taskId: first?.id || "",
          linkedCompany: sync.linked_company || "",
          taskCount: openCount,
          taskTitle: first?.title || "",
        });
        setQueueMap(queue);
        setQuickMode("blocked");
        setQuickStatus(`Supabase shows ${openCount} open or planned task${openCount === 1 ? "" : "s"} for this client. No new task will be scheduled.`);
        return;
      }
      setQueueMap(clearCaptainsLogQueueEntry(client.clientId));
      setQuickMode("schedule");
      setQuickStatus("Supabase confirms there are no open or planned tasks for this client. You can schedule a Coordination Call.");
      const available = await checkCaptainsLogCloudBridge();
      setQuickSupabaseReady(available);
    } catch {
      setQuickMode("waiting");
      setQuickSupabaseReady(false);
      setQuickStatus("Supabase history could not confirm current work. Check the History connection in Settings.");
    } finally {
      setQuickCheckingClientId("");
    }
  };

  const sendQuickCoordinationCall = async () => {
    if (!quickClient || quickMode !== "schedule") return;
    if (!quickDue) { setQuickStatus("Choose a due date first."); return; }
    if (quickSending) return;
    setQuickSending(true);
    setQuickStatus("Rechecking Supabase before scheduling…");
    try {
      const gate = await syncClientFromCaptainsLog(quickClient.clientId, quickClient.clientName, 8000);
      setQuickSync(gate);
      if (gate.ok) await onCaptainsLogSync?.(quickClient.clientId, gate);
      if (gate.error === "queued" || !gate.synced_at) {
        setQuickMode("waiting");
        setQuickStatus("Supabase did not confirm the client's current task state. Nothing was scheduled.");
        return;
      }
      const openCount = Number(gate.open_task_count ?? gate.open_tasks?.length ?? 0);
      if (openCount > 0 || gate.has_open_tasks) {
        const first = gate.primary_open_task ?? gate.open_tasks?.[0];
        setQueueMap(markCaptainsLogQueueEntry({
          clientId: quickClient.clientId, company: quickClient.clientName,
          dueDate: String(first?.scheduled_at || "").slice(0, 10), addedAt: gate.synced_at || new Date().toISOString(),
          taskId: first?.id || "", linkedCompany: gate.linked_company || "", taskCount: openCount, taskTitle: first?.title || "",
        }));
        setQuickMode("blocked");
        setQuickStatus(`Supabase found ${openCount} open or planned task${openCount === 1 ? "" : "s"}. No Coordination Call was added.`);
        return;
      }

      const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${quickClient.clientId}-${quickDue}-${Date.now()}`;
      const result = await sendCoordinationCallToCaptainsLogReliable({
        clientId: quickClient.clientId,
        company: quickClient.clientName,
        dueDate: quickDue,
        priorityReason: quickClient.priorityReason,
        requestId,
      }, 9000);
      let synced = result.sync;
      if (!synced?.ok && result.status !== "queued-cloud") {
        try { synced = await syncClientFromCaptainsLog(quickClient.clientId, quickClient.clientName, 7000); } catch { /* request remains queued */ }
      }
      if (synced?.ok) await onCaptainsLogSync?.(quickClient.clientId, synced);
      if (result.status === "blocked-open-task" || (synced && Number(synced.open_task_count ?? synced.open_tasks?.length ?? 0) > 0 && result.status !== "created")) {
        const count = Number(synced?.open_task_count ?? synced?.open_tasks?.length ?? 1);
        setQuickMode("blocked");
        setQuickStatus(`Supabase found ${count} open or planned task${count === 1 ? "" : "s"}. Nothing new was scheduled.`);
        return;
      }
      setQuickStatus("Coordination Call added to the shared Supabase task ledger. Captain's Log will receive it through normal cloud sync.");
      window.setTimeout(() => setQuickClient(null), 900);
    } catch {
      setQuickSupabaseReady(false);
      setQuickMode("waiting");
      setQuickStatus("Supabase could not confirm or schedule this client. Nothing was added.");
    } finally {
      setQuickSending(false);
    }
  };

  return (
    <>
      <section className={`project-coverage-client-list list-${card.id}`} aria-labelledby="project-coverage-client-list-title">
        <header className="project-coverage-client-list-header">
          <div>
            <span className="project-coverage-list-kicker">Selected coverage position</span>
            <h2 id="project-coverage-client-list-title">{card.title} <small>(<AnimatedNumber value={card.count} duration={520} delay={80} />)</small></h2>
            <p>{listDescription(card.id)}</p>
          </div>
          <div className="project-coverage-list-summary">
            <strong><AnimatedNumber value={card.estimatedValue} duration={760} delay={120} format={(value) => formatMoney(Math.round(value))} /></strong>
            <span>{card.valueLabel}</span>
          </div>
        </header>

        {activeSegment && <div className="project-coverage-active-segment" role="status">
          <span><strong>{activeSegment.label}</strong><small>{segmentedClients.length} client{segmentedClients.length === 1 ? "" : "s"} from the selected card detail</small></span>
          <button type="button" onClick={onClearSegment}>Clear segment</button>
        </div>}

        <ProjectCoverageFilters clients={segmentedClients} activeFilter={activeFilter} onChange={setActiveFilter} />

        {visibleClients.length ? <div key={motionKey} className="project-coverage-table-wrap project-coverage-list-motion">
          <table className="project-coverage-table">
            <thead>
              <tr>
                <th><button type="button" className={`project-coverage-sort-button${sortKey === "client" ? " is-active" : ""}`} onClick={() => updateSort("client")}>Client <span aria-hidden="true">{sortIndicator("client", sortKey, sortDirection)}</span></button></th>
                <th>Project need</th>
                <th>Why they need attention</th>
                <th><button type="button" className={`project-coverage-sort-button${sortKey === "activity" ? " is-active" : ""}`} onClick={() => updateSort("activity")}>Last activity <span aria-hidden="true">{sortIndicator("activity", sortKey, sortDirection)}</span></button></th>
                <th><button type="button" className={`project-coverage-sort-button${sortKey === "estimate" ? " is-active" : ""}`} onClick={() => updateSort("estimate")}>Estimated value <span aria-hidden="true">{sortIndicator("estimate", sortKey, sortDirection)}</span></button></th>
                <th><button type="button" className={`project-coverage-sort-button${sortKey === "captains-log" ? " is-active" : ""}`} onClick={() => updateSort("captains-log")}>Open work <span aria-hidden="true">{sortIndicator("captains-log", sortKey, sortDirection)}</span></button></th>
                <th>Present</th>
                <th><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {visibleClients.map((client, index) => {
                const activity = lastActivity(client);
                const queued = queueMap[client.clientId];
                const openTaskCount = Number(client.captainsLogOpenTaskCount || queued?.taskCount || (queued ? 1 : 0));
                const hasOpenWork = openTaskCount > 0;
                const quickLabel = hasOpenWork
                  ? `Supabase has ${openTaskCount} open or planned task${openTaskCount === 1 ? "" : "s"}${queued?.taskTitle ? ` · ${queued.taskTitle}` : ""}. Click to refresh.`
                  : `Check Supabase first, then schedule only if no open work exists for ${client.clientName}`;
                return <tr key={client.clientId} style={{ "--row-motion-index": index } as CSSProperties}>
                  <td data-label="Client"><div className="project-coverage-client-name"><span aria-hidden="true">{initials(client.clientName)}</span><strong>{client.clientName}</strong></div></td>
                  <td data-label="Project need"><strong className="project-coverage-need">{projectNeed(client)}</strong></td>
                  <td data-label="Why they need attention"><span className="project-coverage-attention">{client.attentionReason || client.priorityReason}</span></td>
                  <td data-label="Last activity"><div className="project-coverage-activity"><strong>{activity.primary}</strong><small>{activity.flag}</small></div></td>
                  <td data-label="Estimated value"><strong className="project-coverage-estimate">{formatMoney(client.estimatedValue)}</strong></td>
                  <td data-label="Captain's Log">
                    <button
                      className={`project-coverage-compass-quick${hasOpenWork ? " is-added" : ""}${quickCheckingClientId === client.clientId ? " is-checking" : ""}`}
                      type="button"
                      onClick={() => void openQuickScheduler(client)}
                      aria-pressed={hasOpenWork}
                      disabled={quickCheckingClientId === client.clientId}
                      aria-label={quickLabel}
                      title={quickLabel}
                    >
                      <span className="project-coverage-compass-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m15.2 8.8-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z"/><circle cx="12" cy="12" r="1.05" fill="currentColor" stroke="none"/></svg>
                      </span>
                      <span className="project-coverage-compass-check" aria-hidden="true">✓</span>
                      <span className="sr-only">{hasOpenWork ? "Open work refreshed from Supabase" : "Check Supabase open work"}</span>
                    </button>
                  </td>
                  <td data-label="Present"><button className="project-coverage-present-quick" type="button" onClick={() => requestQuickPresent(client.clientId)} aria-label={`Present report for ${client.clientName}`} title="Open or quick-generate the client presentation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="m10 8 5 2.5-5 2.5V8Z"/><path d="M8 21h8M12 17v4"/></svg></button></td>
                  <td data-label="Action"><button className="project-coverage-open-client" type="button" onClick={() => onOpenClient(client.clientId)}><span>Open client</span><span aria-hidden="true">→</span></button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div> : <div key={motionKey} className="project-coverage-list-empty project-coverage-list-motion">
          <span className="project-coverage-empty-pulse" aria-hidden="true" />
          <strong>No clients match this reason filter.</strong>
          <span>{activeSegment ? `${activeSegment.label} contains ${segmentedClients.length} client${segmentedClients.length === 1 ? "" : "s"} before the reason filter.` : `The selected coverage position still contains ${card.count} qualifying client${card.count === 1 ? "" : "s"}.`}</span>
          <button type="button" onClick={() => setActiveFilter("all")}>Show all project needs</button>
        </div>}

        {/* View all ${filteredClients.length} clients */}
        {sortedClients.length > INITIAL_CLIENT_COUNT && <div className="project-coverage-view-all">
          <button type="button" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show highest-priority clients" : `View all ${sortedClients.length} clients`}
            <span aria-hidden="true">{showAll ? "↑" : "→"}</span>
          </button>
          {!showAll && hiddenCount > 0 && <small>{hiddenCount} more client{hiddenCount === 1 ? "" : "s"} in this filtered list</small>}
        </div>}
      </section>

      {quickClient && <div className="compass-captains-log-backdrop" role="presentation" onMouseDown={() => setQuickClient(null)}>
        <section className="compass-captains-log-modal" role="dialog" aria-modal="true" aria-labelledby="quick-captains-log-coordination-call-title" onMouseDown={(event) => event.stopPropagation()}>
          <header>
            <span className="compass-captains-log-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m15.2 8.8-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z"/></svg></span>
            <div><span className="compass-kicker">Supabase history</span><h3 id="quick-captains-log-coordination-call-title">{quickMode === "blocked" ? "Existing work found" : quickMode === "waiting" ? "Check open work" : "Schedule coordination call"}</h3></div>
            <button type="button" aria-label="Close Captain's Log scheduler" onClick={() => setQuickClient(null)}>×</button>
          </header>
          {quickMode === "schedule" && <>
            <div className="compass-captains-log-task-preview"><span>Task</span><strong>{coordinationCallTaskTitle(quickClient.clientName)}</strong><small>Client Coordination · Call · shared Supabase task ledger</small></div>
            <label><span>Due date</span><input type="date" value={quickDue} min={today()} onChange={(event) => { setQuickDue(event.target.value); }} /></label>
          </>}
          {quickMode === "blocked" && <div className="compass-captains-log-existing-work">{(quickSync?.open_tasks ?? []).slice(0, 5).map((task) => <article key={task.id || task.title}><span>{task.status}</span><strong>{task.title}</strong><small>{task.scheduled_at ? `Planned ${formatDate(task.scheduled_at)}` : "Open task"}{task.tag ? ` · ${task.tag}` : ""}</small></article>)}</div>}
          <p>{quickMode === "schedule" ? "Supabase confirms there is no current open work for this client. Scheduling now creates one Coordination Call in the shared task ledger." : quickMode === "blocked" ? "Existing shared task history is the source of truth, so Client Compass will not add another task." : "Client Compass must read the current Supabase task history before scheduling is allowed."}</p>
          <small className={`compass-captains-log-requirement${quickSupabaseReady === true ? " is-ready" : quickSupabaseReady === false ? " is-missing" : ""}`}>{quickSupabaseReady === true ? "Supabase history connection is ready." : quickSupabaseReady === false ? "Supabase history is not connected in Client Compass Settings." : "Checking Supabase history…"}</small>
          {quickStatus && <div className="compass-captains-log-status" role="status">{quickStatus}</div>}
          <footer><button className="button secondary" type="button" onClick={() => setQuickClient(null)} disabled={quickSending}>{quickMode === "blocked" ? "Close" : "Cancel"}</button>{quickMode === "schedule" && <button className="button primary" type="button" onClick={() => void sendQuickCoordinationCall()} disabled={quickSending}>{quickSending ? "Checking…" : "Schedule Coordination Call"}</button>}</footer>
        </section>
      </div>}
    </>
  );
}
