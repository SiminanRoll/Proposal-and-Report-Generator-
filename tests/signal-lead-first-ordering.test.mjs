import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimePath = 'public/captains-log-dashboard/dashboard-runtime-fixes.js';
const source = fs.readFileSync(runtimePath, 'utf8');
const start = source.indexOf('  function isReplyRow(row){');
const end = source.indexOf('\n  function renderSocialLatest(source,map){', start);
assert.ok(start >= 0 && end > start, 'social latest helpers must remain discoverable');
const helperSource = source.slice(start, end);

function loadSocialLatestRows() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${helperSource}\nthis.socialLatestRows=socialLatestRows;`, context);
  return context.socialLatestRows;
}

test('mixed signal list puts all available leads before replies for the selected source', () => {
  const socialLatestRows = loadSocialLatestRows();
  const map = {
    opportunities: {
      latest: [
        { id: 'other-source-lead', source_id: 'reddit_groups', occurred_at: '2026-08-26T13:00:00Z', title: 'Other source lead', opportunity_kind: 'buyer' },
        { id: 'lead-older', source_id: 'facebook_groups', occurred_at: '2026-08-20T12:00:00Z', title: 'Older lead', opportunity_kind: 'buyer' },
        { id: 'lead-newer', source_id: 'facebook_groups', occurred_at: '2026-08-22T12:00:00Z', title: 'Newer lead', opportunity_kind: 'buyer' },
      ],
    },
    reply_opportunities: {
      latest: [
        { id: 'reply-newest', source_id: 'facebook_groups', occurred_at: '2026-08-26T12:00:00Z', title: 'Newest reply', opportunity_kind: 'conversation' },
        { id: 'reply-2', source_id: 'facebook_groups', occurred_at: '2026-08-25T12:00:00Z', title: 'Reply 2', opportunity_kind: 'conversation' },
        { id: 'reply-3', source_id: 'facebook_groups', occurred_at: '2026-08-24T12:00:00Z', title: 'Reply 3', opportunity_kind: 'conversation' },
        { id: 'reply-4', source_id: 'facebook_groups', occurred_at: '2026-08-23T12:00:00Z', title: 'Reply 4', opportunity_kind: 'conversation' },
      ],
    },
  };

  const rows = socialLatestRows(map, 'facebook_groups');
  assert.deepEqual(Array.from(rows, row => row.id), ['lead-newer', 'lead-older', 'reply-newest', 'reply-2']);
  assert.deepEqual(Array.from(rows, row => row.__kind), ['buyer', 'buyer', 'reply', 'reply']);
});

test('lead-first list remains newest-first within each opportunity type', () => {
  const block = source.slice(source.indexOf('  function socialLatestRows'), end);
  const kindIndex = block.indexOf("const kindDelta=(a.__kind==='buyer'?0:1)-(b.__kind==='buyer'?0:1);");
  const timeIndex = block.indexOf("String(b.occurred_at||'').localeCompare(String(a.occurred_at||''))");
  assert.ok(kindIndex >= 0, 'buyer/reply priority comparator is required');
  assert.ok(timeIndex > kindIndex, 'timestamp ordering must run after buyer/reply priority');
});
