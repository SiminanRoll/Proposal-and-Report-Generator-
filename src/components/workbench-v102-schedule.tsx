"use client";

import type { ScheduleEditor } from "./workbench-v102-model";

type Props = {
  editor: ScheduleEditor;
  date: string;
  error: string;
  saving: boolean;
  onDate: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export function WorkbenchV102ScheduleDialog({ editor, date, error, saving, onDate, onClose, onSave }: Props) {
  return <div className="workbench-schedule-backdrop" role="presentation" onMouseDown={() => { if (!saving) onClose(); }}><section className="workbench-schedule-dialog" role="dialog" aria-modal="true" aria-labelledby="workbench-schedule-title" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><span className="compass-kicker">Adjust schedule</span><h3 id="workbench-schedule-title">{editor.clientName}</h3></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close schedule editor">×</button></header>
    <div className="workbench-schedule-task"><span>Open review activity</span><strong>{editor.task.title || editor.task.tag || "Task"}</strong></div>
    <label><span>Scheduled date</span><input type="date" value={date} onChange={(event) => onDate(event.target.value)} /></label>
    {error && <div className="workbench-schedule-error" role="alert">{error}</div>}
    <footer><button type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="is-primary" type="button" onClick={onSave} disabled={saving || !date}>{saving ? "Saving…" : "Save date"}</button></footer>
  </section></div>;
}
