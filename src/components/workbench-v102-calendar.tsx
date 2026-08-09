"use client";

import type { WorkbenchRow } from "./workbench-v102-model";
import { calendarDateKey, calendarDates, formatWorkbenchDate, monthLabel } from "./workbench-v102-model";

type Props = {
  anchor: Date;
  rowsByDate: Map<string, WorkbenchRow[]>;
  focus: WorkbenchRow | null;
  focusId: string;
  todayKey: string;
  onFocus: (clientId: string) => void;
  onPreviousMonth: () => void;
  onToday: () => void;
  onNextMonth: () => void;
  onSchedule: (row: WorkbenchRow) => void;
  onResolve: (clientId: string) => void;
  onOpen: (clientId: string) => void;
  onSnooze: (row: WorkbenchRow) => void;
};

export function WorkbenchV102Calendar({ anchor, rowsByDate, focus, focusId, todayKey, onFocus, onPreviousMonth, onToday, onNextMonth, onSchedule, onResolve, onOpen, onSnooze }: Props) {
  const cells = calendarDates(anchor);
  return <div className="workbench-calendar-shell">
    <div className="workbench-calendar-controls"><button type="button" onClick={onPreviousMonth} aria-label="Previous month">‹</button><strong>{monthLabel(anchor)}</strong><button type="button" onClick={onToday}>Today</button><button type="button" onClick={onNextMonth} aria-label="Next month">›</button></div>
    <div className="workbench-calendar-wrap"><div className="workbench-calendar-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div className="workbench-calendar-grid">{cells.map((date) => {
      const key = calendarDateKey(date);
      const dayRows = rowsByDate.get(key) ?? [];
      const outside = date.getMonth() !== anchor.getMonth();
      return <div key={key} className={`workbench-calendar-day${outside ? " is-outside" : ""}${key === todayKey ? " is-today" : ""}`}>
        <div className="workbench-calendar-day-head"><span>{date.getDate()}</span>{dayRows.length > 0 && <b>{dayRows.length}</b>}</div>
        <div className="workbench-calendar-events">{dayRows.slice(0, 4).map((row) => <button key={row.client.id} type="button" className={`workbench-calendar-event stage-${row.stage.toLowerCase().replace(/\s+/g, "-")}${focusId === row.client.id ? " is-active" : ""}`} onClick={() => onFocus(row.client.id)} title={`${row.client.name}: ${row.activity.title}`}><strong>{row.client.name}</strong><small>{row.activity.kind === "open" ? "Open" : row.activity.kind === "review" ? "Review" : "Last"} · {row.activity.title}</small></button>)}{dayRows.length > 4 && <span className="workbench-calendar-more">+{dayRows.length - 4} more</span>}</div>
      </div>;
    })}</div></div>
    {focus && <div className="workbench-calendar-focus"><div><span className={`workbench-stage stage-${focus.stage.toLowerCase().replace(/\s+/g, "-")}`}>{focus.stage}</span><strong>{focus.client.name}</strong><small>{focus.activity.title} · {formatWorkbenchDate(focus.activity.date)}</small></div><div>{focus.stage === "Needs Action" && <button className="is-resolve" type="button" onClick={() => onResolve(focus.client.id)}>Resolve</button>}{focus.activity.task && <button type="button" onClick={() => onSchedule(focus)}>Adjust date</button>}<button type="button" onClick={() => onOpen(focus.client.id)}>Open client</button><button type="button" onClick={() => onSnooze(focus)}>Snooze 90d</button></div></div>}
  </div>;
}
