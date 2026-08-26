import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/captains-log-dashboard/dashboard-runtime-fixes.js', 'utf8');

test('Permit Offices uses project terminology instead of social lead/reply terminology', () => {
  const start = source.indexOf('  function renderNetworkTaxonomy(map){');
  const end = source.indexOf('\n  function renderSourceCards(map){', start);
  assert.ok(start >= 0 && end > start, 'network taxonomy renderer must remain discoverable');
  const block = source.slice(start, end);
  assert.match(block, /isPermitSource\(source\)/);
  assert.match(block, /textContent='Permit Outputs'/);
  assert.match(block, /textContent='Qualified Projects'/);
  assert.match(block, /textContent='Permit Opportunities'/);
  assert.match(block, /textContent='Working Now'/);
  assert.match(block, /textContent='Active Permit Projects'/);
  assert.match(block, /buyerNode\.textContent=formatCount\(source\.surfaced\)/);
  assert.match(block, /replyNode\.textContent=formatCount\(source\.working\)/);
});

test('social output copy is restored for non-permit selections', () => {
  const start = source.indexOf('  function renderNetworkTaxonomy(map){');
  const end = source.indexOf('\n  function renderSourceCards(map){', start);
  const block = source.slice(start, end);
  assert.match(block, /textContent='Social Outputs'/);
  assert.match(block, /textContent='Leads'/);
  assert.match(block, /textContent='Replies'/);
  assert.match(block, /dataset\.outputTaxonomy='social'/);
});
