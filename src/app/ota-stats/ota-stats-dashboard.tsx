"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { chicagoDateKey } from "../ota-shared";
import { OTA_TEAM_VIEW_STORAGE_KEY, fetchSharedOtaSnapshot } from "../ota-tracker/logic";
import {
  availablePeriodOptions,
  availableTcNames,
  buildOtaPeriodStats,
  canonicalTcName,
  currentPeriodKey,
  grainBreakdownLabel,
  grainTimelineLabel,
  rowsForPerformanceScope,
  type OtaStatsSourceRow,
  type PerformanceGrain,
  type PerformanceScope,
} from "./logic";
import styles from "./ota-stats.module.css";

const TC_COLORS = [
  "#5ee0b7", "#7aa8ff", "#d18bff", "#f1c15d", "#ff8490", "#5bc7e7",
  "#8bdd7a", "#f39b62", "#a4a2ff", "#63d6cf", "#d9a6ef", "#b7c66b",
];

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function signedPercent(value: number | null): string {
  if (value === null) return "";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function friendlyError(value: unknown): string {
  return value instanceof Error ? value.message : String(value ?? "Unable to load OTA performance.");
}

function tcColor(index: number): string {
  return TC_COLORS[index % TC_COLORS.length];
}

function grainLabel(grain: PerformanceGrain): string {
  return grain[0].toUpperCase() + grain.slice(1);
}

function scopeLabel(scope: PerformanceScope): string {
  return scope === "mine" ? "My Sets" : "All Company";
}

function summaryChange(current: number, prior: number | null): number | null {
  if (prior === null || prior <= 0) return null;
  return ((current - prior) / prior) * 100;
}

export function OtaStatsDashboard() {
  const todayKey = chicagoDateKey();
  const [rows, setRows] = useState<OtaStatsSourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<PerformanceScope>("mine");
  const [grain, setGrain] = useState<PerformanceGrain>("year");
  const [periodKey, setPeriodKey] = useState(currentPeriodKey("year", todayKey));
  const [selectedTc, setSelectedTc] = useState("all");
  const [lastSync, setLastSync] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const load = useCallback(async (code: string, unlocking = false) => {
    const shareCode = code.trim();
    if (!shareCode) {
      setLoading(false);
      setUnlocked(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const snapshot = await fetchSharedOtaSnapshot(shareCode);
      setRows((Array.isArray(snapshot.otas) ? snapshot.otas : []) as OtaStatsSourceRow[]);
      const updated = snapshot.generated_at ? new Date(snapshot.generated_at) : new Date();
      setLastSync(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(updated));
      setTeamCode(shareCode);
      setUnlocked(true);
      if (typeof window !== "undefined") localStorage.setItem(OTA_TEAM_VIEW_STORAGE_KEY, shareCode);
    } catch (cause) {
      setError(friendlyError(cause));
      if (unlocking) {
        setUnlocked(false);
        if (typeof window !== "undefined") localStorage.removeItem(OTA_TEAM_VIEW_STORAGE_KEY);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedCode = typeof window !== "undefined" ? localStorage.getItem(OTA_TEAM_VIEW_STORAGE_KEY) || "" : "";
    if (savedCode) {
      setTeamCode(savedCode);
      void load(savedCode, true);
    } else {
      setLoading(false);
    }
  }, [load]);

  const lock = () => {
    if (typeof window !== "undefined") localStorage.removeItem(OTA_TEAM_VIEW_STORAGE_KEY);
    setRows([]);
    setTeamCode("");
    setUnlocked(false);
    setError("");
    setLastSync("");
  };

  const scopedRows = useMemo(() => rowsForPerformanceScope(rows, scope), [rows, scope]);
  const periodOptions = useMemo(() => availablePeriodOptions(scopedRows, grain, todayKey), [grain, scopedRows, todayKey]);
  const tcNames = useMemo(() => availableTcNames(scopedRows), [scopedRows]);

  useEffect(() => {
    if (!periodOptions.length) return;
    if (!periodOptions.some((option) => option.key === periodKey)) {
      const current = currentPeriodKey(grain, todayKey);
      setPeriodKey(periodOptions.find((option) => option.key === current)?.key || periodOptions[0].key);
    }
  }, [grain, periodKey, periodOptions, todayKey]);

  useEffect(() => {
    if (selectedTc !== "all" && !tcNames.includes(canonicalTcName(selectedTc))) setSelectedTc("all");
  }, [selectedTc, tcNames]);

  const resolvedPeriodKey = periodOptions.some((option) => option.key === periodKey)
    ? periodKey
    : periodOptions[0]?.key || currentPeriodKey(grain, todayKey);

  const stats = useMemo(
    () => buildOtaPeriodStats(scopedRows, grain, resolvedPeriodKey, selectedTc, todayKey),
    [grain, resolvedPeriodKey, scopedRows, selectedTc, todayKey],
  );

  const maxTcTotal = Math.max(1, ...stats.tcStats.map((tc) => tc.total));
  const tcScope = selectedTc === "all" ? "All TCs" : canonicalTcName(selectedTc);
  const reportScope = `${scopeLabel(scope)} · ${tcScope}`;

  const changeGrain = (next: PerformanceGrain) => {
    setGrain(next);
    setPeriodKey(currentPeriodKey(next, todayKey));
  };

  const exportPdf = () => {
    if (typeof window !== "undefined") window.print();
  };

  if (!unlocked) {
    return <main className={styles.shell}>
      <section className={styles.toolbar}>
        <div className={styles.titleGroup}>
          <Link href="/ota-tracker/" className={styles.backLink}>← OTA Tracker</Link>
          <div><span>SECURE PERFORMANCE</span><h1>OTA Performance</h1></div>
        </div>
      </section>
      <section className={styles.panel} style={{ maxWidth: 560, margin: "52px auto", padding: 28 }}>
        <div className={styles.sectionHeader}>
          <div><span>TEAM ACCESS</span><h2>Enter the OTA team view code</h2></div>
        </div>
        <p style={{ margin: "0 0 18px", color: "#9fb0ad", lineHeight: 1.55 }}>This performance view uses the same password as the read-only OTA Tracker. If you already unlocked the tracker on this browser, it opens automatically.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            aria-label="OTA team view code"
            type="password"
            value={teamCode}
            onChange={(event) => setTeamCode(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") void load(teamCode, true); }}
            placeholder="Team view code"
            autoFocus
            style={{ flex: "1 1 260px", minWidth: 0, padding: "11px 12px", borderRadius: 9, border: "1px solid rgba(160,203,194,.2)", background: "#09171e", color: "#e8f1ef" }}
          />
          <button type="button" className={styles.exportButton} onClick={() => void load(teamCode, true)} disabled={loading || teamCode.trim().length < 8}>{loading ? "Unlocking…" : "Unlock"}</button>
        </div>
        {error && <div className={styles.errorBanner} style={{ marginTop: 16 }}>{error}</div>}
      </section>
    </main>;
  }

  return <main className={styles.shell}>
    <section className={styles.toolbar}>
      <div className={styles.titleGroup}>
        <Link href="/ota-tracker/" className={styles.backLink}>← OTA Tracker</Link>
        <div>
          <span>SECURE PERFORMANCE</span>
          <h1>OTA Performance</h1>
        </div>
      </div>
      <div className={styles.controls}>
        <select aria-label="Scope" value={scope} onChange={(event) => setScope(event.target.value as PerformanceScope)}>
          <option value="mine">My Sets</option>
          <option value="company">All Company</option>
        </select>
        <select aria-label="Timeframe" value={grain} onChange={(event) => changeGrain(event.target.value as PerformanceGrain)}>
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
          <option value="year">Year</option>
        </select>
        <select aria-label="Period" value={resolvedPeriodKey} onChange={(event) => setPeriodKey(event.target.value)}>
          {periodOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
        <select aria-label="TC" value={selectedTc} onChange={(event) => setSelectedTc(event.target.value)}>
          <option value="all">All TCs</option>
          {tcNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <button type="button" className={styles.secondaryButton} onClick={() => void load(teamCode)} disabled={loading}>Refresh</button>
        <button type="button" className={styles.secondaryButton} onClick={lock}>Lock / change password</button>
        <button type="button" className={styles.exportButton} onClick={exportPdf}>Export PDF</button>
      </div>
    </section>

    <div className={styles.metaLine}>
      <span>{scopeLabel(scope)} · {grainLabel(grain)} · {stats.periodLabel} · {tcScope}</span>
      <span>Assigned TC is separate from Set By · Password-protected view{lastSync ? ` · Updated ${lastSync}` : ""}</span>
    </div>

    {error && <div className={styles.errorBanner}>{error}</div>}

    <section className={`${styles.reportPage} ${styles.executivePage}`}>
      <div className={styles.printHeading}>
        <div>
          <span>ADVANTAGE TECHNOLOGIES</span>
          <h2>OTA Performance · {stats.periodLabel}</h2>
        </div>
        <strong>{reportScope}</strong>
      </div>

      <div className={styles.kpis}>
        <article className={styles.kpi}>
          <span>Total OTAs</span>
          <strong>{stats.total}</strong>
          <small>{scopeLabel(scope)} · {stats.periodLabel}</small>
        </article>
        <article className={styles.kpi}>
          <span>Top TC</span>
          <strong className={styles.nameValue}>{stats.topTc?.name || "—"}</strong>
          <small>{stats.topTc ? `${stats.topTc.total} OTAs` : "No OTAs in this period"}</small>
        </article>
        <article className={styles.kpi}>
          <span>{stats.averageLabel}</span>
          <strong>{stats.average.toFixed(1)}</strong>
          <small>{grain === "year" && resolvedPeriodKey === currentPeriodKey("year", todayKey) ? "Year-to-date pace" : `${grainLabel(grain)} pace`}</small>
        </article>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div><span>{grainLabel(grain).toUpperCase()} TIMELINE</span><h2>{grainTimelineLabel(grain)}</h2></div>
          <strong>{stats.total} total</strong>
        </div>
        <div className={styles.timelineScroll}>
          <div className={styles.timeline} style={{ gridTemplateColumns: `repeat(${stats.buckets.length}, minmax(54px, 1fr))` }}>
            {stats.buckets.map((bucket, bucketIndex) => {
              const bucketTotal = stats.bucketTotals[bucketIndex];
              const barHeight = bucketTotal ? Math.max(10, (bucketTotal / stats.maxBucketTotal) * 100) : 3;
              return <div className={styles.monthColumn} key={bucket.key}>
                <div className={styles.monthTotal}>{bucketTotal || ""}</div>
                <div className={styles.barWell} title={`${bucket.label}: ${bucketTotal} OTAs`}>
                  <div className={styles.stackedBar} style={{ height: `${barHeight}%` }}>
                    {stats.tcStats.map((tc, tcIndex) => tc.buckets[bucketIndex] > 0 && <span
                      key={`${tc.name}-${bucket.key}`}
                      style={{ flex: tc.buckets[bucketIndex], background: tcColor(tcIndex) }}
                      title={`${tc.name}: ${tc.buckets[bucketIndex]}`}
                    />)}
                  </div>
                </div>
                <strong title={bucket.label}>{bucket.shortLabel}</strong>
              </div>;
            })}
          </div>
        </div>
        <div className={styles.legend}>
          {stats.tcStats.map((tc, index) => <span key={tc.name}><i style={{ background: tcColor(index) }} />{tc.name}<b>{tc.total}</b></span>)}
        </div>
      </section>

      <div className={styles.periodCards}>
        {stats.summaryBuckets.map((bucket, index) => {
          const count = stats.summaryTotals[index];
          const prior = index > 0 ? stats.summaryTotals[index - 1] : null;
          const change = summaryChange(count, prior);
          const periodTop = stats.tcStats.toSorted((a, b) => b.summary[index] - a.summary[index])[0];
          return <article key={bucket.key}>
            <span>{bucket.shortLabel}</span>
            <strong>{count}</strong>
            <small>{change === null ? "" : `${signedPercent(change)} vs prior`}</small>
            <em>{periodTop?.summary[index] ? `${periodTop.name} · ${periodTop.summary[index]}` : "No OTAs"}</em>
          </article>;
        })}
      </div>
    </section>

    <section className={`${styles.reportPage} ${styles.performancePage}`}>
      <div className={styles.printHeading}>
        <div><span>TC PERFORMANCE</span><h2>{stats.periodLabel} leaderboard</h2></div>
        <strong>{reportScope}</strong>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div><span>RANKING</span><h2>OTA volume by assigned TC</h2></div>
          <small>{stats.periodLabel}</small>
        </div>
        <div className={styles.leaderboard}>
          {stats.tcStats.length ? stats.tcStats.map((tc, index) => <div className={styles.leaderRow} key={tc.name}>
            <span className={styles.rank}>{index + 1}</span>
            <div className={styles.leaderName}><strong>{tc.name}</strong><small>{pct(tc.share)} of selected OTAs</small></div>
            <div className={styles.progressTrack}><span style={{ width: `${Math.max(3, (tc.total / maxTcTotal) * 100)}%`, background: tcColor(index) }} /></div>
            <strong className={styles.leaderTotal}>{tc.total}</strong>
            <span className={styles.bestMonth}>{stats.buckets[tc.bestBucketIndex]?.shortLabel || "—"} · {tc.bestBucketCount}</span>
          </div>) : <div className={styles.empty}>No OTAs in this selection.</div>}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div><span>HEATMAP</span><h2>Which assigned TCs were active?</h2></div>
          <small>Darker cells = more OTAs</small>
        </div>
        <div className={styles.heatmapWrap}>
          <div className={styles.heatmap} style={{ gridTemplateColumns: `minmax(155px, 1.5fr) repeat(${stats.buckets.length}, minmax(42px, 1fr))` }}>
            <div className={styles.heatCorner}>TC</div>
            {stats.buckets.map((bucket) => <strong key={bucket.key} title={bucket.label}>{bucket.shortLabel}</strong>)}
            {stats.tcStats.map((tc) => <div className={styles.heatRow} key={tc.name}>
              <span>{tc.name}</span>
              {tc.buckets.map((count, bucketIndex) => {
                const alpha = count ? 0.18 + (count / stats.maxHeatValue) * 0.72 : 0.035;
                return <i key={stats.buckets[bucketIndex].key} style={{ background: `rgba(86, 224, 183, ${alpha})` }} title={`${stats.buckets[bucketIndex].label}: ${count}`}><b>{count || ""}</b></i>;
              })}
            </div>)}
          </div>
        </div>
      </section>
    </section>

    <section className={`${styles.reportPage} ${styles.breakdownPage}`}>
      <div className={styles.printHeading}>
        <div><span>BREAKDOWN</span><h2>{stats.periodLabel} detail</h2></div>
        <strong>{reportScope}</strong>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div><span>BREAKDOWN</span><h2>{grainBreakdownLabel(grain)}</h2></div>
          <strong>{stats.total} OTAs</strong>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.summaryTable}>
            <thead><tr><th>Assigned TC</th>{stats.summaryBuckets.map((bucket) => <th key={bucket.key}>{bucket.shortLabel}</th>)}<th>Total</th><th>Share</th><th>Best period</th></tr></thead>
            <tbody>
              {stats.tcStats.map((tc) => <tr key={tc.name}>
                <td>{tc.name}</td>
                {tc.summary.map((count, index) => <td key={stats.summaryBuckets[index].key}>{count}</td>)}
                <td><strong>{tc.total}</strong></td>
                <td>{pct(tc.share)}</td>
                <td>{stats.buckets[tc.bestBucketIndex]?.shortLabel || "—"} · {tc.bestBucketCount}</td>
              </tr>)}
              <tr className={styles.totalRow}><td>All</td>{stats.summaryTotals.map((count, index) => <td key={stats.summaryBuckets[index].key}>{count}</td>)}<td>{stats.total}</td><td>100%</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div><span>PERIOD TOTALS</span><h2>{stats.periodLabel} at a glance</h2></div>
          <small>{grainTimelineLabel(grain)}</small>
        </div>
        <div className={styles.bucketGrid}>
          {stats.buckets.map((bucket, index) => <article key={bucket.key} title={bucket.label}><span>{bucket.shortLabel}</span><strong>{stats.bucketTotals[index]}</strong></article>)}
        </div>
      </section>

      <footer className={styles.reportFooter}>Generated {new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date())} · {scopeLabel(scope)} · Password-protected OTA performance · Cleared OTAs excluded.</footer>
    </section>
  </main>;
}