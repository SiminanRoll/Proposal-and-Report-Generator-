"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useCompassState } from "@/lib/compass/store";
import { buildSegmentSnapshots, formatSegmentStat, SEGMENT_STAT_OPTIONS, segmentRuleSummary, segmentStatValue } from "@/lib/segments/engine";
import { createSegmentDraft, deleteSegment, moveSegment, upsertSegment, useSegments } from "@/lib/segments/store";
import type { SegmentDefinition, SegmentStatId } from "@/lib/segments/types";
import { SegmentEditorDialog } from "./segment-editor-dialog";
import { SegmentIcon } from "./segment-icon";

function statLabel(stat: SegmentStatId): string {
  return SEGMENT_STAT_OPTIONS.find((item) => item.id === stat)?.label ?? stat;
}

export function SegmentManagerPage() {
  const { dataset, config } = useCompassState();
  const { segments } = useSegments();
  const snapshots = useMemo(() => buildSegmentSnapshots(segments, dataset, config), [config, dataset, segments]);
  const [editing, setEditing] = useState<SegmentDefinition | null>(null);
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const toggleFlip = (segmentId: string) => setFlipped((current) => { const next = new Set(current); if (next.has(segmentId)) next.delete(segmentId); else next.add(segmentId); return next; });
  const startCreate = () => setEditing(createSegmentDraft(segments.length));

  return <div className="segment-page segment-manager-page">
    <header className="segment-page-header"><div><span className="compass-kicker">Client books</span><h1>Segment Manager</h1><p>Build reusable client segments by need, size, location, lifecycle, review timing, or any mix that matters.</p></div><button className="button primary" type="button" onClick={startCreate}>+ New segment</button></header>

    {!dataset && <div className="segment-page-notice">Import a current Client Compass snapshot to see live enrollment counts. You can still create segment definitions now.</div>}

    {snapshots.length === 0 ? <section className="segment-empty"><div className="segment-empty-icon"><SegmentIcon name="target" /></div><h2>Create your first managed segment.</h2><p>Segments become hot buttons in the left menu and stay current as the client snapshot changes.</p><button className="button primary" type="button" onClick={startCreate}>Create segment</button></section> : <section className="segment-card-grid">{snapshots.map((snapshot, index) => {
      const isFlipped = flipped.has(snapshot.segment.id);
      return <article className={`segment-flip-card${isFlipped ? " is-flipped" : ""}`} key={snapshot.segment.id} style={{ "--segment-color": snapshot.segment.color } as CSSProperties}>
        <div className="segment-flip-inner">
          <section className="segment-card-face segment-card-front">
            <div className="segment-card-top"><span className="segment-card-icon"><SegmentIcon name={snapshot.segment.icon} /></span><div className="segment-card-title"><strong>{snapshot.segment.title}</strong><small>{snapshot.segment.description || `${snapshot.segment.rules.length} active rule${snapshot.segment.rules.length === 1 ? "" : "s"}`}</small></div><button type="button" className="segment-card-flip" onClick={() => toggleFlip(snapshot.segment.id)} aria-label={`Flip ${snapshot.segment.title} card`}>↻</button></div>
            <div className="segment-card-count"><strong>{snapshot.aggregate.clientCount.toLocaleString()}</strong><span>enrolled client{snapshot.aggregate.clientCount === 1 ? "" : "s"}</span></div>
            <div className="segment-card-rules">{snapshot.segment.rules.slice(0, 2).map((rule) => <span key={rule.id}>{segmentRuleSummary(rule)}</span>)}{snapshot.segment.rules.length > 2 && <span>+{snapshot.segment.rules.length - 2} more</span>}</div>
            <div className="segment-card-actions"><Link href={`/segments/view/?id=${encodeURIComponent(snapshot.segment.id)}`}>Open segment</Link><button type="button" onClick={() => setEditing(snapshot.segment)}>Edit</button><div className="segment-order-actions"><button type="button" disabled={index === 0} onClick={() => moveSegment(snapshot.segment.id, -1)} aria-label="Move segment up">↑</button><button type="button" disabled={index === snapshots.length - 1} onClick={() => moveSegment(snapshot.segment.id, 1)} aria-label="Move segment down">↓</button></div></div>
          </section>
          <section className="segment-card-face segment-card-back">
            <div className="segment-card-top"><span className="segment-card-icon"><SegmentIcon name={snapshot.segment.icon} /></span><div className="segment-card-title"><strong>{snapshot.segment.title}</strong><small>Tracked segment stats</small></div><button type="button" className="segment-card-flip" onClick={() => toggleFlip(snapshot.segment.id)} aria-label={`Show ${snapshot.segment.title} enrollment`}>↻</button></div>
            <div className="segment-back-value"><span>Total estimated need</span><strong>{formatSegmentStat("estimated-value", snapshot.aggregate.estimatedValue)}</strong></div>
            <div className="segment-back-stats">{snapshot.segment.stats.map((stat) => <div key={stat}><span>{statLabel(stat)}</span><strong>{formatSegmentStat(stat, segmentStatValue(snapshot.aggregate, stat))}</strong></div>)}</div>
            <div className="segment-card-actions"><Link href={`/segments/view/?id=${encodeURIComponent(snapshot.segment.id)}`}>View clients</Link><button type="button" onClick={() => setEditing(snapshot.segment)}>Edit segment</button><button className="is-danger" type="button" onClick={() => { if (window.confirm(`Delete ${snapshot.segment.title}?`)) deleteSegment(snapshot.segment.id); }}>Delete</button></div>
          </section>
        </div>
      </article>;
    })}</section>}

    <SegmentEditorDialog open={Boolean(editing)} segment={editing} dataset={dataset} onClose={() => setEditing(null)} onSave={(segment) => { upsertSegment(segment); setEditing(null); }} />
  </div>;
}
