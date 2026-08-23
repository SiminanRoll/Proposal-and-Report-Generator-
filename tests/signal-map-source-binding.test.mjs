import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboard = path.join(root, "public", "captains-log-dashboard");
const read = (name) => readFileSync(path.join(dashboard, name), "utf8");
const html = read("index.html");
const script = read("dashboard-signal-map.js");
const styles = read("dashboard-signal-map.css");
const mapStart = html.indexOf('<section class="signal-map-entry"');
const mapEnd = html.indexOf('<div class="detail-dashboard"', mapStart);
const mapMarkup = html.slice(mapStart, mapEnd);

test("every normalized source lane has honest binding slots", () => {
  assert.equal((mapMarkup.match(/data-source-state="loading"/g) || []).length, 6);
  assert.equal((mapMarkup.match(/data-source-monitored/g) || []).length, 6);
  assert.equal((mapMarkup.match(/data-source-signals/g) || []).length, 6);
  assert.equal((mapMarkup.match(/data-source-surfaced/g) || []).length, 6);
  assert.equal((mapMarkup.match(/data-source-health-label/g) || []).length, 6);
  assert.equal((mapMarkup.match(/aria-busy="true"/g) || []).length, 1);
});

test("source rendering is keyed only by the six normalized public IDs", () => {
  assert.match(script, /const sourceIds=\['facebook_groups','reddit_groups','linkedin_groups','company_page_engagement','permit_offices','npi_new_practice'\]/);
  assert.match(script, /sourceIds\.includes\(source\.id\)/);
  assert.match(script, /renderSources\(map\)/);
  assert.doesNotMatch(script, /one_stop_social|reddit_atom|meta_page|linkedin_page/);
});

test("zero remains a real count while null remains unavailable", () => {
  assert.match(script, /value!==null&&value!==undefined/);
  assert.match(script, /count===null\?'—'/);
  assert.match(script, /source\?\.availability==='available'/);
  assert.match(script, /partial=available&&\[source\.monitored_count,source\.signals,source\.surfaced\]/);
  assert.match(script, /Source is unavailable/i);
});

test("monitoring health is presented independently from production", () => {
  assert.match(script, /if\(health==='healthy'\)return 'Healthy'/);
  assert.match(script, /if\(health==='warning'\)return 'Review status'/);
  assert.match(script, /if\(health==='error'\)return 'Monitoring issue'/);
  assert.match(script, /node\.dataset\.sourceHealth=health/);
  assert.match(styles, /data-source-health="healthy"/);
  assert.match(styles, /data-source-health="warning"/);
  assert.match(styles, /data-source-health="error"/);
});

test("the source binding uses safe text updates and preserves the last successful state on errors", () => {
  assert.match(script, /target\.textContent=value/);
  assert.doesNotMatch(script, /innerHTML|insertAdjacentHTML/);
  assert.match(script, /if\(!mapState\.data\)\{renderSourcesUnavailable\(\);renderDestinationUnavailable\(\)\}/);
  assert.match(script, /Last update/);
  assert.doesNotMatch(script, /service_role|SERVICE_ROLE|runner_secret|webhook_secret/i);
});

test("the compact sales node binds only normalized opportunity totals", () => {
  assert.match(script, /opportunities\.total/);
  assert.match(script, /opportunities\.hot/);
  assert.match(script, /opportunities\.warm/);
  assert.match(script, /opportunities\.producing_sources/);
  assert.match(script, /destination\[key\]\.textContent=formatCount\(value\)/);
});

test("source selection binds real entity performance, stages, and provenance", () => {
  assert.match(script, /source\.entities/);
  assert.match(script, /source\.stages/);
  assert.match(script, /row\.source_id===sourceId/);
  assert.match(script, /renderEntities\(source\)/);
  assert.match(script, /renderLatest\(source\)/);
  assert.match(script, /strongestSource\(map\)/);
  assert.doesNotMatch(script, /innerHTML|insertAdjacentHTML/);
});
