"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { captainsLogCloudRest, getCaptainsLogCloudAuthSnapshot } from "@/lib/compass/captains-log-cloud";
import { OTA_TEAM_VIEW_STORAGE_KEY, chicagoDateKey, fetchSharedOtaSnapshot } from "../ota-tracker/logic";
import {
  OTA_STATS_MONTHS,
  availableStatsYears,
  availableTcNames,
  buildOtaYearStats,
  canonicalTcName,
  yearOverYearPercent,
  type OtaStatsSourceRow,
} from "./logic";
import styles from "./ota-stats.module.css";

type AccessMode = "disconnected" | "writer" | "viewer";

const OTA_SELECT = "id,set_date,appointment_date,tc_name";
const TC_COLORS = [
  "#5ee0b7", "#7aa8ff", "#d18bff", "#f1c15d", "#ff8490", "#5bc7e7",
  "#8bdd7a", "#f39b62", "#a4a2ff", "#63d6cf", "#d9a6ef", "#b7c66b",
];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function signedPercent(value: number | null): string {
  if (value === null) return "—";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function friendlyError(value: unknown): string {
  let text = value instanceof Error ? value.message : String(value ?? "Unable to load OTA performance.");
  text = text.replace(/Captain'?s Log cloud sync failed\s*\(\d+\)\s*:\s*/gi, "");
  text = text.replace(/Captain'?s Log/gi, "OTA performance");
  return text;
}

function tcColor(index: number): string {
  return TC_COLORS[index % TC_COLORS.length];
}

export function OtaStatsDashboard() {
  const todayKey = chicagoDateKey();
  const currentYear = Number(todayKey.slice(0, 4));
  const [rows, setRows] = useState<OtaStatsSourceRow[]>([]);
  const [mode, setMode] = useState<AccessMode>("disconnected");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [year, setYear] = useState(currentYear);
  const [selectedTc, setSelectedTc] = useState("all");
  const [lastSync, setLastSync] = useState("");

  const loadWriter = useCallback(async () => {
    const result = await captainsLogCloudRest<OtaStatsSourceRow[]>("GET", "company_otas", undefined, {
      select: OTA_SELECT,
      order: "set_date.asc.nullslast",
    });
    setRows(Array.isArray(result) ? result : []);
    setMode("writer");
  }, []);

  const loadViewer = useCallback(async (code: string) => {
    const snapshot = await fetchSharedOtaSnapshot(code);
    setRows((Array.isArray(snapshot.otas) ? snapshot.otas : []) as unknown as OtaStatsSourceRow[]);
    setMode("viewer");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const auth = getCaptainsLogCloudAuthSnapshot();
      if (auth.configured && auth.signedIn) {
        await loadWriter();
      } else {
        const code = typeof window !== "undefined" ? localStorage.getItem(OTA_TEAM_VIEW_STORAGE_KEY) || "" : "";
        if (code) await loadViewer(code);
        else setMode("disconnected");
      }
      setLastSync(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()));
    } catch (cause) {
      setMode("disconnected");
      setError(friendlyError(cause));
    } finally {
      setLoading(false);
    }
  }, [loadViewer, loadWriter]);

  useEffect(() => { void load(); }, [load]);

  const years = useMemo(() => availableStatsYears(rows, currentYear), [currentYear, rows]);
  const tcNames = useMemo(() => availableTcNames(rows), [rows]);
  const stats = useMemo(() => buildOtaYearStats(rows, year, selectedTc, todayKey), [rows, selectedTc, todayKey, year]);
  const priorStats = useMemo(() => buildOtaYearStats(rows, year - 1, selectedTc, todayKey), [rows, selectedTc, todayKey, year]);
  const yoy = yearOverYearPercent(stats.total, priorStats.total);
  const maxTcTotal = Math.max(1, ...stats.tcStats.map((tc) => tc.total));

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      if (mode === "writer") await loadWriter();
      else {
        const code = localStorage.getItem(OTA_TEAM_VIEW_STORAGE_KEY) || "";
        if (code) await loadViewer(code);
        else await load();
      }
      setLastSync(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()));
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = () => {
    if (typeof window !== "undefined") window.print();
  };

  const reportScope = selectedTc === "all" ? "All TCs" : canonicalTcName(selectedTc);

  if (mode === "disconnected" && !loading) {
    return <main className={styles.shell}>
      <section className={styles.accessCard}>
        <div>
          <span>OTA PERFORMANCE</span>
          <h1>Year Review</h1>
          <p>Use your existing team access or full-access session to view historical OTA performance.</p>
        </div>
        <div className={styles.accessActions}>
          <Link href="/ota-tracker/">Open OTA Tracker</Link>
          <button type="button" onClick={() => void load()}>Retry</button>
        </div>
        {error && <div className={styles.error}>{error}</div>}
      </section>
    </main>;
  }

  return <main className={styles.shell}>
    <section className={styles.toolbar}>
      <div className={styles.titleGroup}>
        <Link href="/ota-tracker/" className={styles.backLink}>← OTA Tracker</Link>
        <div>
          <span>YEAR REVIEW</span>
          <h1>OTA Performance</h1>
        </div>
      </div>
      <div className={styles.controls}>
        <select aria-label="Year" value={year} onChange={(event) => setYear(Number(event.target.value))}>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label="TC" value={selectedTc} onChange={(event) => setSelectedTc(event.target.value)}>
          <option value="all">All TCs</option>
          {tcNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <button type="button" className={styles.secondaryButton} onClick={() => void refresh()} disabled={loading}>Refresh</button>
        <button type="button" className={styles.exportButton} onClick={exportPdf}>Export PDF</button>
      </div>
    </section>

    <div className={styles.metaLine}>
      <span>{year} · {reportScope}</span>
      <span>{mode === "viewer" ? "Team view" : "Full access"}{lastSync ? ` · Updated ${lastSync}` : ""}</span>
    </div>

    {error && <div className={styles.errorBanner}>{error}</div>}

    <section className={`${styles.reportPage} ${styles.executivePage}`}>
      <div className={styles.printHeading}>
        <div>
          <span>ADVANTAGE TECHNOLOGIES</span>
          <h2>OTA Performance · {year}</h2>
        </div>
        <strong>{reportScope}</strong>
      </div>

      <div className={styles.kpis}>
        <article className={styles.kpi}>
          <span>Total OTAs set</span>
          <strong>{stats.total}</strong>
          <small>Counted by onsite set date</small>
        </article>
        <article className={styles.kpi}>
          <span>Top TC</span>
          <strong className={styles.nameValue}>{stats.topTc?.name || "—"}</strong>
          <small>{stats.topTc ? `${stats.topTc.total} OTAs` : "No set dates yet"}</small>
        </article>
        <article className={styles.kpi}>
          <span>Avg / month</span>
          <strong>{stats.avgPerMonth.toFixed(1)}</strong>
          <small>{year === currentYear ? "Year to date pace" : "Full-year average"}</small>
        </article>
        <article className={styles.kpi}>
          <span>vs {year - 1}</span>
          <strong className={yoy !== null && yoy < 0 ? styles.negative : styles.positive}>{signedPercent(yoy)}</strong>
          <small>{priorStats.total ? `${priorStats.total} prior-year OTAs` : "No prior-year baseline"}</small>
        </article>
        <article className={`${styles.kpi} ${stats.missingSetDate || stats.missingTc ? styles.qualityKpi : ""}`}>
          <span>Needs backfill</span>
          <strong>{stats.missingSetDate + stats.missingTc}</strong>
          <small>{stats.missingSetDate} set dates · {stats.missingTc} TC names</small>
        </article>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div><span>ANNUAL TIMELINE</span><h2>OTAs set by month</h2></div>
          <strong>{stats.total} total</strong>
        </div>
        <div className={styles.timeline}>
          {OTA_STATS_MONTHS.map((month, monthIndex) => {
            const monthTotal = stats.monthly[monthIndex];
            const barHeight = monthTotal ? Math.max(10, (monthTotal / stats.maxMonthlyTotal) * 100) : 3;
            return <div className={styles.monthColumn} key={month}>
              <div className={styles.monthTotal}>{monthTotal || ""}</div>
              <div className={styles.barWell} title={`${month}: ${monthTotal} OTAs`}>
                <div className={styles.stackedBar} style={{ height: `${barHeight}%` }}>
                  {stats.tcStats.map((tc, tcIndex) => tc.monthly[monthIndex] > 0 && <span
                    key={`${tc.name}-${month}`}
                    style={{ flex: tc.monthly[monthIndex], background: tcColor(tcIndex) }}
                    title={`${tc.name}: ${tc.monthly[monthIndex]}`}
                  />)}
                </div>
              </div>
              <strong>{month}</strong>
            </div>;
          })}
        </div>
        <div className={styles.legend}>
          {stats.tcStats.map((tc, index) => <span key={tc.name}><i style={{ background: tcColor(index) }} />{tc.name}<b>{tc.total}</b></span>)}
        </div>
      </section>

      <div className={styles.quarters}>
        {stats.quarterly.map((count, index) => {
          const prior = index > 0 ? stats.quarterly[index - 1] : null;
          const change = prior && prior > 0 ? ((count - prior) / prior) * 100 : null;
          const quarterTop = stats.tcStats.toSorted((a, b) => b.quarterly[index] - a.quarterly[index])[0];
          return <article key={index}>
            <span>Q{index + 1}</span>
            <strong>{count}</strong>
            <small>{change === null ? "" : `${signedPercent(change)} vs Q${index}`}</small>
            <em>{quarterTop?.quarterly[index] ? `${quarterTop.name} · ${quarterTop.quarterly[index]}` : "No OTAs"}</em>
          </article>;
        })}
      </div>
    </section>

    <section className={`${styles.reportPage} ${styles.performancePage}`}>
      <div className={styles.printHeading}>
        <div><span>TC PERFORMANCE</span><h2>{year} leaderboard</h2></div>
        <strong>{reportScope}</strong>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div><span>RANKING</span><h2>Appointment-setting production</h2></div>
          <small>Based only on set date</small>
        </div>
        <div className={styles.leaderboard}>
          {stats.tcStats.length ? stats.tcStats.map((tc, index) => <div className={styles.leaderRow} key={tc.name}>
            <span className={styles.rank}>{index + 1}</span>
            <div className={styles.leaderName}><strong>{tc.name}</strong><small>{pct(tc.share)} of {year} OTAs</small></div>
            <div className={styles.progressTrack}><span style={{ width: `${Math.max(3, (tc.total / maxTcTotal) * 100)}%`, background: tcColor(index) }} /></div>
            <strong className={styles.leaderTotal}>{tc.total}</strong>
            <span className={styles.bestMonth}>{OTA_STATS_MONTHS[tc.bestMonthIndex]} · {tc.bestMonthCount}</span>
          </div>) : <div className={styles.empty}>No OTAs with set dates for this selection.</div>}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div><span>HEATMAP</span><h2>Who was active when?</h2></div>
          <small>Darker cells = more OTAs</small>
        </div>
        <div className={styles.heatmapWrap}>
          <div className={styles.heatmap}>
            <div className={styles.heatCorner}>TC</div>
            {OTA_STATS_MONTHS.map((month) => <strong key={month}>{month}</strong>)}
            {stats.tcStats.map((tc) => <div className={styles.heatRow} key={tc.name}>
              <span>{tc.name}</span>
              {tc.monthly.map((count, monthIndex) => {
                const alpha = count ? 0.18 + (count / stats.maxHeatValue) * 0.72 : 0.035;
                return <i key={monthIndex} style={{ background: `rgba(86, 224, 183, ${alpha})` }} title={`${OTA_STATS_MONTHS[monthIndex]}: ${count}`}><b>{count || ""}</b></i>;
              })}
            </div>)}
          </div>
        </div>
      </section>
    </section>

    <section className={`${styles.reportPage} ${styles.breakdownPage}`}>
      <div className={styles.printHeading}>
        <div><span>BREAKDOWN</span><h2>{year} quarterly detail</h2></div>
        <strong>{reportScope}</strong>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div><span>QUARTERS</span><h2>TC breakdown</h2></div>
          <strong>{stats.total} annual OTAs</strong>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.summaryTable}>
            <thead><tr><th>TC</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Year</th><th>Share</th><th>Best month</th></tr></thead>
            <tbody>
              {stats.tcStats.map((tc) => <tr key={tc.name}>
                <td>{tc.name}</td>
                {tc.quarterly.map((count, index) => <td key={index}>{count}</td>)}
                <td><strong>{tc.total}</strong></td>
                <td>{pct(tc.share)}</td>
                <td>{OTA_STATS_MONTHS[tc.bestMonthIndex]} · {tc.bestMonthCount}</td>
              </tr>)}
              <tr className={styles.totalRow}><td>All</td>{stats.quarterly.map((count, index) => <td key={index}>{count}</td>)}<td>{stats.total}</td><td>100%</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div><span>MONTHLY TOTALS</span><h2>Year at a glance</h2></div>
          <small>OTAs set in each month</small>
        </div>
        <div className={styles.monthGrid}>
          {OTA_STATS_MONTHS.map((month, index) => <article key={month}><span>{month}</span><strong>{stats.monthly[index]}</strong></article>)}
        </div>
      </section>

      {(stats.missingSetDate > 0 || stats.missingTc > 0) && <section className={styles.dataQuality}>
        <strong>Backfill check</strong>
        <span>{stats.missingSetDate} OTA{stats.missingSetDate === 1 ? "" : "s"} with an appointment in {year} still need a set date.</span>
        <span>{stats.missingTc} OTA{stats.missingTc === 1 ? "" : "s"} counted in {year} still need a TC assignment.</span>
      </section>}

      <footer className={styles.reportFooter}>Generated {new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date())} · OTA production is counted by onsite set date.</footer>
    </section>
  </main>;
}
