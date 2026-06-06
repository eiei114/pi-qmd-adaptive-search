import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initProject, loadConfig } from '../src/config.js';
import { diagnoseSearchQuality, GENERIC_TOKENS } from '../src/diagnosis.js';
import { readJobState, writeJobState } from '../src/job-state.js';

function tempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmd-diag-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'ProductSpec.md'), '# Product Spec\nData portability decisions.\n', 'utf8');
  fs.writeFileSync(path.join(root, 'README.md'), '# Test Project\n', 'utf8');
  return root;
}

function writeLearnedAliases(root, aliases) {
  const p = path.join(root, '.qmd-adaptive-search', 'local', 'learned-aliases.json');
  fs.writeFileSync(p, JSON.stringify({ aliases }, null, 2), 'utf8');
}

function writeLearnedBoosts(root, boosts) {
  const p = path.join(root, '.qmd-adaptive-search', 'local', 'learned-boosts.json');
  fs.writeFileSync(p, JSON.stringify({ boosts }, null, 2), 'utf8');
}

function appendPendingSuggestion(root, count) {
  const p = path.join(root, '.qmd-adaptive-search', 'local', 'pending-suggestions.jsonl');
  for (let i = 0; i < count; i++) {
    fs.appendFileSync(p, JSON.stringify({ id: `sug-${i}`, rating: 'good', selectedPaths: ['README.md'], anchors: ['test'], confidence: 0.5 }) + '\n', 'utf8');
  }
}

function writeSearchJobState(root, jobs) {
  const state = readJobState(root);
  state.recentJobs = jobs;
  writeJobState(root, state);
}

/* ── Healthy state ──────────────────────────────────────────────── */

test('diagnosis returns ok for a fresh project with no learned state', () => {
  const root = tempProject();
  initProject(root);
  const config = loadConfig(root);
  const diagnosis = diagnoseSearchQuality(root, config, { available: false, command: null });

  assert.equal(diagnosis.health, 'ok');
  assert.equal(diagnosis.buckets.length, 5);
  for (const bucket of diagnosis.buckets) {
    assert.equal(bucket.severity, 'ok', `${bucket.name} should be ok`);
    assert.ok(bucket.message);
    assert.ok(bucket.name);
    assert.ok(bucket.details);
  }
});

/* ── Learned alias pollution ────────────────────────────────────── */

test('diagnosis warns when learned alias count is high', () => {
  const root = tempProject();
  initProject(root);
  const aliases = {};
  for (let i = 0; i < 35; i++) aliases[`alias-${i}`] = [`term-${i}`];
  writeLearnedAliases(root, aliases);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const bucket = diagnosis.buckets.find((b) => b.name === 'learned-alias-pollution');

  assert.equal(bucket!.severity, 'warning');
  assert.equal(bucket!.details.count, 35);
  assert.ok(bucket!.recoveryAction);
  assert.ok(diagnosis.health === 'warning' || diagnosis.health === 'critical');
});

test('diagnosis flags critical when generic aliases dominate', () => {
  const root = tempProject();
  initProject(root);
  const aliases = {};
  // Mix of generic and specific
  for (const generic of ['content', 'templates', 'single', 'post', 'data', 'index', 'main', 'file', 'new', 'old',
    'test', 'copy', 'backup', 'temp', 'tmp', 'draft', 'note', 'doc', 'docs', 'readme',
    'src', 'lib', 'util', 'utils', 'helper', 'helpers', 'common', 'shared', 'config', 'setup',
    'item', 'items', 'list', 'page', 'section', 'part', 'update', 'add', 'remove', 'change']) {
    aliases[generic] = ['synonym'];
  }
  // Only 10 specific aliases out of 50 total => 80% generic
  for (let i = 0; i < 10; i++) aliases[`specific-alias-${i}`] = [`specific-term-${i}`];
  writeLearnedAliases(root, aliases);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const bucket = diagnosis.buckets.find((b) => b.name === 'learned-alias-pollution');

  assert.equal(bucket!.severity, 'critical');
  assert.ok((bucket!.details.genericRatio as number) >= 0.4);
  assert.ok(bucket!.recoveryAction!.includes('learned-aliases.json'));
});

test('diagnosis reports generic aliases with low count as ok', () => {
  const root = tempProject();
  initProject(root);
  const aliases = { content: ['data'], templates: ['views'] };
  writeLearnedAliases(root, aliases);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const bucket = diagnosis.buckets.find((b) => b.name === 'learned-alias-pollution');

  // Only 2 aliases, both generic, but count is well below thresholds
  assert.equal(bucket!.severity, 'ok');
});

/* ── Learned boost pollution ────────────────────────────────────── */

test('diagnosis warns when learned boost count is high', () => {
  const root = tempProject();
  initProject(root);
  const boosts = {};
  for (let i = 0; i < 35; i++) boosts[`path/file-${i}.md`] = 0.1;
  writeLearnedBoosts(root, boosts);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const bucket = diagnosis.buckets.find((b) => b.name === 'learned-boost-pollution');

  assert.equal(bucket!.severity, 'warning');
  assert.equal(bucket!.details.count, 35);
  assert.ok(bucket!.recoveryAction);
});

test('diagnosis flags critical for runaway boosts', () => {
  const root = tempProject();
  initProject(root);
  writeLearnedBoosts(root, {
    'path/a.md': 0.8,
    'path/b.md': -0.6,
    'path/c.md': 0.1
  });

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const bucket = diagnosis.buckets.find((b) => b.name === 'learned-boost-pollution');

  assert.equal(bucket!.severity, 'critical');
  assert.equal(bucket!.details.runawayCount, 2);
  assert.ok(bucket!.recoveryAction!.includes('learned-boosts.json'));
});

/* ── Pending suggestion backlog ─────────────────────────────────── */

test('diagnosis warns for moderate pending suggestion backlog', () => {
  const root = tempProject();
  initProject(root);
  appendPendingSuggestion(root, 12);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const bucket = diagnosis.buckets.find((b) => b.name === 'pending-suggestion-backlog');

  assert.equal(bucket!.severity, 'warning');
  assert.equal(bucket!.details.count, 12);
  assert.ok(bucket!.recoveryAction!.includes('review'));
});

test('diagnosis flags critical for large pending suggestion backlog', () => {
  const root = tempProject();
  initProject(root);
  appendPendingSuggestion(root, 25);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const bucket = diagnosis.buckets.find((b) => b.name === 'pending-suggestion-backlog');

  assert.equal(bucket!.severity, 'critical');
  assert.ok(bucket!.recoveryAction!.includes('review --approve'));
});

/* ── Missing embeddings ─────────────────────────────────────────── */

test('diagnosis reports ok when qmd is unavailable', () => {
  const root = tempProject();
  initProject(root);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const bucket = diagnosis.buckets.find((b) => b.name === 'missing-embeddings');

  assert.equal(bucket!.severity, 'ok');
  assert.equal(bucket!.details.available, false);
  assert.ok(bucket!.recoveryAction!.includes('install-qmd'));
});

test('diagnosis reports ok when qmd is available but status output is unparseable', () => {
  const root = tempProject();
  initProject(root);

  // Use a fake qmd that returns unparseable status
  const fakeQmd = path.join(root, 'fake-qmd.cjs');
  fs.writeFileSync(fakeQmd, `
if (process.argv[2] === 'status') { console.log('qmd ready, no embed info'); process.exit(0); }
process.exit(1);
`, 'utf8');

  const diagnosis = diagnoseSearchQuality(root, undefined, {
    available: true,
    command: [process.execPath, fakeQmd]
  });
  const bucket = diagnosis.buckets.find((b) => b.name === 'missing-embeddings');

  assert.equal(bucket!.severity, 'ok');
  assert.equal(bucket!.details.available, true);
  assert.ok(bucket!.message.includes('could not be parsed'));
});

test('diagnosis warns for moderate embed debt', () => {
  const root = tempProject();
  initProject(root);

  const fakeQmd = path.join(root, 'fake-qmd.cjs');
  fs.writeFileSync(fakeQmd, `
if (process.argv[2] === 'status') { console.log('150 documents (30%) need embeddings'); process.exit(0); }
process.exit(1);
`, 'utf8');

  const diagnosis = diagnoseSearchQuality(root, undefined, {
    available: true,
    command: [process.execPath, fakeQmd]
  });
  const bucket = diagnosis.buckets.find((b) => b.name === 'missing-embeddings');

  assert.equal(bucket!.severity, 'warning');
  assert.equal(bucket!.details.needsEmbeddings, 150);
  assert.equal(bucket!.details.embedDebtPercent, 30);
  assert.ok(bucket!.recoveryAction!.includes('embed'));
});

test('diagnosis flags critical for heavy embed debt', () => {
  const root = tempProject();
  initProject(root);

  const fakeQmd = path.join(root, 'fake-qmd.cjs');
  fs.writeFileSync(fakeQmd, `
if (process.argv[2] === 'status') { console.log('792 documents (68%) need embeddings'); process.exit(0); }
process.exit(1);
`, 'utf8');

  const diagnosis = diagnoseSearchQuality(root, undefined, {
    available: true,
    command: [process.execPath, fakeQmd]
  });
  const bucket = diagnosis.buckets.find((b) => b.name === 'missing-embeddings');

  assert.equal(bucket!.severity, 'critical');
  assert.equal(bucket!.details.needsEmbeddings, 792);
  assert.equal(bucket!.details.embedDebtPercent, 68);
});

/* ── Search history ─────────────────────────────────────────────── */

test('diagnosis reports healthy search history with recent completed searches', () => {
  const root = tempProject();
  initProject(root);
  writeSearchJobState(root, [
    { id: 'j1', type: 'qmd-search', status: 'completed', finishedAt: new Date().toISOString(), result: { usedFallback: false } }
  ]);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const bucket = diagnosis.buckets.find((b) => b.name === 'search-history');

  assert.equal(bucket!.severity, 'ok');
  assert.equal(bucket!.details.consecutiveFallbackOrFailure, 0);
  assert.equal(bucket!.details.staleHistory, false);
});

test('diagnosis warns on consecutive fallback searches', () => {
  const root = tempProject();
  initProject(root);
  writeSearchJobState(root, [
    { id: 'j1', type: 'qmd-search', status: 'completed', finishedAt: new Date().toISOString(), result: { usedFallback: true } },
    { id: 'j2', type: 'qmd-search', status: 'completed', finishedAt: new Date().toISOString(), result: { usedFallback: true } }
  ]);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const bucket = diagnosis.buckets.find((b) => b.name === 'search-history');

  assert.equal(bucket!.severity, 'warning');
  assert.equal(bucket!.details.consecutiveFallbackOrFailure, 2);
});

test('diagnosis flags critical on many consecutive failures', () => {
  const root = tempProject();
  initProject(root);
  writeSearchJobState(root, [
    { id: 'j1', type: 'qmd-search', status: 'failed', finishedAt: new Date().toISOString(), result: { usedFallback: true } },
    { id: 'j2', type: 'qmd-search', status: 'failed', finishedAt: new Date().toISOString(), result: { usedFallback: true } },
    { id: 'j3', type: 'qmd-search', status: 'failed', finishedAt: new Date().toISOString(), result: { usedFallback: true } },
    { id: 'j4', type: 'qmd-search', status: 'failed', finishedAt: new Date().toISOString(), result: { usedFallback: true } }
  ]);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const bucket = diagnosis.buckets.find((b) => b.name === 'search-history');

  assert.equal(bucket!.severity, 'critical');
  assert.equal(bucket!.details.consecutiveFallbackOrFailure, 4);
  assert.ok(bucket!.recoveryAction!.includes('qmd status'));
});

test('diagnosis detects stale history when all searches failed', () => {
  const root = tempProject();
  initProject(root);
  writeSearchJobState(root, [
    { id: 'j1', type: 'qmd-search', status: 'failed', finishedAt: new Date().toISOString(), result: {} },
    { id: 'j2', type: 'qmd-update', status: 'completed', finishedAt: new Date().toISOString() }
  ]);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const bucket = diagnosis.buckets.find((b) => b.name === 'search-history');

  assert.equal(bucket!.details.staleHistory, true);
  assert.ok(bucket!.severity !== 'ok');
});

test('diagnosis stops counting consecutive failures at a completed search', () => {
  const root = tempProject();
  initProject(root);
  writeSearchJobState(root, [
    { id: 'j1', type: 'qmd-search', status: 'failed', finishedAt: new Date().toISOString(), result: { usedFallback: true } },
    { id: 'j2', type: 'qmd-search', status: 'completed', finishedAt: new Date().toISOString(), result: { usedFallback: false } },
    { id: 'j3', type: 'qmd-search', status: 'failed', finishedAt: new Date().toISOString(), result: { usedFallback: true } }
  ]);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const bucket = diagnosis.buckets.find((b) => b.name === 'search-history');

  // Only j1 is consecutive failure (j2 is completed, stops the chain)
  assert.equal(bucket!.details.consecutiveFallbackOrFailure, 1);
  assert.equal(bucket!.severity, 'warning');
});

/* ── Overall health ─────────────────────────────────────────────── */

test('diagnosis overall health reflects worst bucket severity', () => {
  const root = tempProject();
  initProject(root);

  // Create a warning condition (alias count)
  const aliases = {};
  for (let i = 0; i < 35; i++) aliases[`alias-${i}`] = [`term-${i}`];
  writeLearnedAliases(root, aliases);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  assert.equal(diagnosis.health, 'warning');
});

test('diagnosis health is critical when any bucket is critical', () => {
  const root = tempProject();
  initProject(root);

  // Create a critical condition (runaway boosts)
  writeLearnedBoosts(root, { 'path/a.md': 0.9, 'path/b.md': 0.1 });

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  assert.equal(diagnosis.health, 'critical');
});

/* ── GENERIC_TOKENS sanity ──────────────────────────────────────── */

test('GENERIC_TOKENS contains expected low-information tokens', () => {
  for (const token of ['content', 'templates', 'single', 'post']) {
    assert.ok(GENERIC_TOKENS.has(token), `Expected ${token} in GENERIC_TOKENS`);
  }
});

/* ── Recovery guidance presence ─────────────────────────────────── */

test('all non-ok buckets have non-null recovery actions', () => {
  const root = tempProject();
  initProject(root);

  // Create warning/critical conditions
  const aliases = {};
  for (let i = 0; i < 35; i++) aliases[`alias-${i}`] = [`term-${i}`];
  writeLearnedAliases(root, aliases);

  const boosts = {};
  for (let i = 0; i < 35; i++) boosts[`path-${i}.md`] = 0.1;
  writeLearnedBoosts(root, boosts);

  appendPendingSuggestion(root, 15);

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });

  for (const bucket of diagnosis.buckets) {
    if (bucket.severity !== 'ok') {
      assert.ok(bucket.recoveryAction, `${bucket.name} with severity=${bucket.severity} should have recoveryAction`);
      assert.ok(bucket.recoveryAction.length > 20, `${bucket.name} recovery action should be descriptive`);
    }
  }
});

/* ── Status integration ─────────────────────────────────────────── */

test('adaptiveStatus includes diagnosis summary', async () => {
  const { adaptiveStatus } = await import('../src/index.js');
  const root = tempProject();
  initProject(root);

  const status = adaptiveStatus({ root });
  assert.ok(status.diagnosis, 'status should include diagnosis');
  assert.ok(status.diagnosis.health, 'diagnosis should have health');
  assert.ok(Array.isArray(status.diagnosis.buckets), 'diagnosis should have buckets array');
  assert.equal(status.diagnosis.buckets.length, 5);
});

/* ── Privacy ────────────────────────────────────────────────────── */

test('diagnosis output does not contain raw queries or file contents', () => {
  const root = tempProject();
  initProject(root);

  // Even with some learned state, diagnosis should not leak query/content
  writeLearnedAliases(root, { content: ['data'], specific: ['unique'] });
  writeLearnedBoosts(root, { 'path/a.md': 0.1 });

  const diagnosis = diagnoseSearchQuality(root, undefined, { available: false, command: null });
  const serialized = JSON.stringify(diagnosis);

  // Should contain structural fields but no raw queries or file contents
  assert.ok(!serialized.includes('query'), 'diagnosis should not contain query text');
  assert.ok(!serialized.includes('snippet'), 'diagnosis should not contain snippets');
  assert.ok(!serialized.includes('fileContent'), 'diagnosis should not contain file contents');
});
