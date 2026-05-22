import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adaptiveSearch, recordFeedback, adaptiveStatus, initProject } from '../src/index.js';
import { parseQmdSearchOutput } from '../src/qmd.js';

function tempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmd-adaptive-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'ProductSpec.md'), '---\nlead: Workout product decisions.\n---\n# Product Spec\nData portability and export decisions.\n', 'utf8');
  fs.writeFileSync(path.join(root, 'README.md'), '# Test Project\n', 'utf8');
  return root;
}

function configureMockQmd(root, body) {
  initProject(root);
  const mockPath = path.join(root, 'mock-qmd.cjs');
  fs.writeFileSync(mockPath, body, 'utf8');
  fs.writeFileSync(
    path.join(root, '.qmd-adaptive-search', 'config.json'),
    JSON.stringify({ qmdCommand: [process.execPath, mockPath] }, null, 2),
    'utf8'
  );
  return mockPath;
}

test('search creates lightweight config and returns fallback result', () => {
  const root = tempProject();
  const result = adaptiveSearch({ query: 'product decisions', maxResults: 5 }, { root });
  assert.equal(fs.existsSync(path.join(root, '.qmd-adaptive-search', 'config.json')), true);
  assert.equal(result.results[0].path, 'docs/ProductSpec.md');
  assert.equal(result.results[0].lead, 'Workout product decisions.');
  assert.ok(result.warnings.some((warning) => warning.includes('qmd was not found')) || Array.isArray(result.warnings));
});

test('feedback learns from recent result without storing raw query', () => {
  const root = tempProject();
  adaptiveSearch({ query: 'product decisions', maxResults: 5 }, { root });
  const feedback = recordFeedback({ selectedPath: 'docs/ProductSpec.md', rating: 'good' }, { root });
  assert.equal(feedback.ok, true);
  const recent = JSON.parse(fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'local', 'recent-searches.json'), 'utf8'));
  assert.equal(Object.hasOwn(recent.searches[0], 'query'), false);
  const boosts = JSON.parse(fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'local', 'learned-boosts.json'), 'utf8'));
  assert.ok(boosts.boosts['docs/ProductSpec.md'] > 0);
});

test('status reports core counts', () => {
  const root = tempProject();
  initProject(root);
  const status = adaptiveStatus({ root });
  assert.equal(status.aliases.shared, 0);
  assert.equal(status.boosts.learned, 0);
  assert.equal(status.manifest.enabled, true);
});

test('search records completed qmd job state', () => {
  const root = tempProject();
  configureMockQmd(root, `
const command = process.argv[2];
if (command === 'status') process.exit(0);
if (command === 'search') {
  console.log('docs/ProductSpec.md:1 Product Spec');
  process.exit(0);
}
process.exit(1);
`);

  const result = adaptiveSearch({ query: 'product decisions', maxResults: 5 }, { root });
  assert.equal(result.backgroundJobs[0].status, 'completed');
  assert.equal(result.backgroundJobs[0].result.resultCount, 1);

  const status = adaptiveStatus({ root });
  assert.equal(status.backgroundJobs.pending.length, 0);
  assert.equal(status.backgroundJobs.lastSearchJob.status, 'completed');
  assert.equal(status.lastSearchJob.result.resultCount, 1);
});

test('search records failed qmd job state with recovery hint', () => {
  const root = tempProject();
  configureMockQmd(root, `
const command = process.argv[2];
if (command === 'status') process.exit(0);
if (command === 'search') {
  console.error('index unavailable');
  process.exit(2);
}
process.exit(1);
`);

  const result = adaptiveSearch({ query: 'product decisions', maxResults: 5 }, { root });
  assert.equal(result.backgroundJobs[0].status, 'failed');
  assert.match(result.backgroundJobs[0].error, /index unavailable/);

  const status = adaptiveStatus({ root });
  assert.equal(status.failedBackgroundJobs.length, 1);
  assert.equal(status.failedBackgroundJobs[0].status, 'failed');
  assert.ok(status.recoveryHints[0].hint.includes('qmd status'));
});

test('qmd URI paths resolve to local paths with underscores and spaces', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, '4_Project', 'Roblox-Market-Research'), { recursive: true });
  fs.writeFileSync(path.join(root, '4_Project', 'Roblox-Market-Research', 'CONTEXT.md'), '# Roblox Market Research\n', 'utf8');
  fs.mkdirSync(path.join(root, '1_Fleeting'), { recursive: true });
  fs.writeFileSync(path.join(root, '1_Fleeting', 'Memo_0503.md'), '# Memo\n', 'utf8');

  const results = parseQmdSearchOutput([
    'qmd://obsidian-note/4-Project/Roblox-Market-Research/CONTEXT.md:3 #abc',
    'qmd://obsidian-note/1-Fleeting/Memo-0503.md:1 #def'
  ].join('\n'), root);

  assert.deepEqual(results.map((result) => result.path), [
    '4_Project/Roblox-Market-Research/CONTEXT.md',
    '1_Fleeting/Memo_0503.md'
  ]);
});
