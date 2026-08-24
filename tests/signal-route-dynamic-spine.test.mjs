import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const js = fs.readFileSync('public/captains-log-dashboard/dashboard-signal-map-phase2.js', 'utf8');
const css = fs.readFileSync('public/captains-log-dashboard/dashboard-signal-map-phase2.css', 'utf8');
const version = JSON.parse(fs.readFileSync('public/captains-log-dashboard/version.json', 'utf8'));

test('Signal Route uses measured DOM geometry instead of fixed connector coordinates', () => {
  assert.match(js, /getBoundingClientRect\(\)/);
  assert.match(js, /ResizeObserver/);
  assert.match(js, /MutationObserver/);
  assert.match(js, /map-route-spine/);
  assert.match(js, /mergeX/);
  assert.match(js, /routeY/);
  assert.match(js, /networkSvg\.viewBox/);
  assert.doesNotMatch(js, /const mergeY=172/);
  assert.doesNotMatch(js, /M220 \$\{y\}/);
});

test('Signal Route has one visible spine with a fading intake and no separate intake tail', () => {
  assert.match(css, /\.map-route-spine\s*\{/);
  assert.match(css, /transparent 0%/);
  assert.match(css, /\.map-intake-waypoint::before,\s*\n\.map-intake-waypoint::after/);
  assert.match(css, /content: none !important/);
  assert.match(css, /\.map-flow-rail\s*\{[\s\S]*background: transparent !important/);
});

test('release metadata identifies dynamic spine release', () => {
  assert.equal(version.version, '1.2.85');
  assert.equal(version.release, 'signal-route-dynamic-spine');
});
