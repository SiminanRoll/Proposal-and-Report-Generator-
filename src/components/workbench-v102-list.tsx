"use client";

import Link from "next/link";
import type { SortDirection, SortKey, WorkbenchRow } from "./workbench-v102-model";
import { formatWorkbenchDate, formatWorkbenchMoney, reportUrl, sortIndicator } from "./workbench-v102-model";

type Props = {
  rows: WorkbenchRow[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  onSchedule: (row: WorkbenchRow) => void;
  onResolve: (clientId: string) => void;
  onOpen: (clientId: string) => void;
  onSnooze: (row: WorkbenchRow) => void;
};

export function WorkbenchV102List({ rows, sortKey, sortDirection, onSort, onSchedule, onResolve, onOpen, onSnooze }: Props) {
  const sortButton = (column: SortKey, label: string) => <button type="button" className={`workbench-sort${sortKey === column ? " is-active" : ""}`} onClick={() => onSort(column)}>{label}<span aria-hidden="true">{sortIndicator(column, sortKey, sortDirection)}</span></button>;

  if (!rows.length) return <div className="workbench-empty"><strong>No clients in this view.</strong><span>Known reviews enter automatically at the annual due date. Clients with no recorded review date stay in Reviews Due until you intentionally add or begin work on them.</span></div>;

  return <div className="workbench-table-wrap"><table className="workbench-table"><thead><tr>
    <th>{sortButton("client", "Client")}</th><th>{sortButton("stage", "Stage")}</th><th>{sortButton("activity", "Latest activity")}</th><th>{sortButton("tasks", "Open tasks")}</th><th>{sortButton("review", "Last review")}</th><th>{sortButton("value", "Est. need")}</th><th>Actions</th>
  </tr></thead><tbody>
    {rows.map((row) => <tr key={row.client.id}>
      <td><strong>{row.client.name}</strong><small>{row.client.city}{row.client.state ? `${row.client.city ? ", " : ""}${row.client.state}` : ""}</small></td>
      <td><span className={`workbench-stage stage-${row.stage.toLowerCase().replace(/\s+/g, "-")}`}>{row.stage}</span></td>
      <td className="workbench-activity-cell"><div className="workbench-activity-main">
        <span className={`workbench-activity-kind kind-${row.activity.kind}`}>{row.activity.kind === "open" ? "Open" : row.activity.kind === "review" ? "Review" : row.activity.kind === "last" ? "Last" : "—"}</span>
        <span className="workbench-activity-copy"><strong title={row.activity.title}>{row.activity.title}</strong><small>{formatWorkbenchDate(row.activity.date)}</small></span>
        {row.activity.task && <button className="workbench-reschedule" type="button" onClick={() => onSchedule(row)} title="Adjust task schedule" aria-label={`Adjust schedule for ${row.client.name}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/><path d="m14.5 14.5 1.5 1.5 3-3"/></svg></button>}
      </div></td>
      <td>{row.openTaskCount}</td>
      <td>{formatWorkbenchDate(row.reviewDate)}</td>
      <td><strong>{formatWorkbenchMoney(row.estimatedValue)}</strong></td>
      <td><div className="workbench-row-actions">
        {row.stage === "Needs Action" && <button className="is-resolve" type="button" onClick={() => onResolve(row.client.id)}>Resolve</button>}
        <button type="button" onClick={() => onOpen(row.client.id)}>Open</button>
        <Link href={reportUrl(row.client.id, row.client.name)}>Report</Link>
        <button className="is-quiet" type="button" onClick={() => onSnooze(row)} title={`Remove ${row.client.name} from Workbench for 90 days`}>Snooze 90d</button>
      </div></td>
    </tr>)}
  </tbody></table></div>;
}
