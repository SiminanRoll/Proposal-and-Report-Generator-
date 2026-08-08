import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const nav = fs.readFileSync("src/components/compass-navigation-rail.tsx", "utf8");
const manager = fs.readFileSync("src/components/segment-manager-page.tsx", "utf8");
const editor = fs.readFileSync("src/components/segment-editor-dialog.tsx", "utf8");
const detail = fs.readFileSync("src/components/segment-detail-page.tsx", "utf8");
const engine = fs.readFileSync("src/lib/segments/engine.ts", "utf8");
const store = fs.readFileSync("src/lib/segments/store.ts", "utf8");
const generatorCss = fs.readFileSync("src/app/generator-home-v199.css", "utf8");

test("1.0.9.28 keeps managed segments in the left navigation", () => {
  assert.equal(pkg.version, "1.0.9.28");
  assert.match(nav, /Segment Manager/);
  assert.match(nav, /compass-segment-hot-button/);
  assert.match(nav, /segment\.color/);
  assert.match(nav, /SegmentIcon name=\{segment\.icon\}/);
});

test("segment manager cards flip from enrollment to selected business stats", () => {
  assert.match(manager, /segment-flip-card/);
  assert.match(manager, /enrolled client/);
  assert.match(manager, /Total estimated need/);
  assert.match(manager, /segment\.stats\.map/);
  assert.match(manager, /moveSegment/);
});

test("segments can be customized by title color icon rules stats and overrides", () => {
  assert.match(editor, /Segment title/);
  assert.match(editor, /type="color"/);
  assert.match(editor, /Color &amp; icon/);
  assert.match(editor, /Match/);
  assert.match(editor, /Always include/);
  assert.match(editor, /Always exclude/);
  assert.match(editor, /Tracked stats/);
});

test("segment rule engine supports state size need timing and activity use cases", () => {
  assert.match(engine, /location-contains/);
  assert.match(engine, /managed-assets/);
  assert.match(engine, /replace-now/);
  assert.match(engine, /estimated-value/);
  assert.match(engine, /account-review-age-days/);
  assert.match(engine, /activity-tracked/);
  assert.match(engine, /segment\.includeClientIds/);
  assert.match(engine, /segment\.excludeClientIds/);
});

test("segment definitions persist independently and emit live navigation changes", () => {
  assert.match(store, /client-compass\.segments\.v1/);
  assert.match(store, /client-compass-segments-changed/);
  assert.match(store, /upsertSegment/);
  assert.match(store, /moveSegment/);
});

test("segment detail exposes health value history and existing client/report actions", () => {
  assert.match(detail, /segment-client-health/);
  assert.match(detail, /estimatedValue/);
  assert.match(detail, /lastAccountReview/);
  assert.match(detail, /activityTracked/);
  assert.match(detail, /CompassClientWorkspace/);
  assert.match(detail, /type: "client-report"/);
});

test("report generator title is intentionally muted and pressed into the page", () => {
  assert.match(generatorCss, /generator-home-header h1/);
  assert.match(generatorCss, /color:rgba\(68,88,111,\.27\)/);
  assert.match(generatorCss, /text-shadow:0 1px 0 rgba\(255,255,255,\.96\),0 -1px 0 rgba\(42,61,83,\.13\)/);
});

test("segment detail routing is compatible with static export", () => {
  assert.equal(fs.existsSync("src/app/segments/[segmentId]/page.tsx"), false);
  assert.equal(fs.existsSync("src/app/segments/view/page.tsx"), true);
  assert.match(nav, /\/segments\/view\/\?id=/);
  assert.match(manager, /\/segments\/view\/\?id=/);
  assert.match(detail, /URLSearchParams\(window\.location\.search\)/);
  assert.doesNotMatch(detail, /useParams/);
});
