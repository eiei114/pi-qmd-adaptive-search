import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adaptiveSearch, recordFeedback, reviewSuggestions, approveSuggestions, adaptiveStatus, initProject, qmdOperationPlan, runQmdOperation } from '../src/index.js';
import { detectQmd, parseQmdSearchOutput } from '../src/qmd.js';

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

function writeFakeQmd(root, options: any = {}) {
  const script = path.join(root, 'fake-qmd.mjs');
  fs.writeFileSync(script, `
const command = process.argv[2];
if (command === 'status' || command === '--version') {
  console.log('fake qmd ready');
  process.exit(0);
}
if (command === 'search') {
  ${options.searchStatus === 1 ? `console.error(${JSON.stringify(options.searchStderr || 'search failed')}); process.exit(1);` : `console.log(${JSON.stringify(options.searchStdout || '')}); process.exit(0);`}
}
if (command === 'query') {
  ${options.queryStatus === 1 ? `console.error(${JSON.stringify(options.queryStderr || 'query failed')}); process.exit(1);` : `console.log(${JSON.stringify(options.queryStdout || '')}); process.exit(0);`}
}
console.error('unexpected command: ' + command);
process.exit(1);
`, 'utf8');
  return [process.execPath, script];
}

function configureFakeQmd(root, options: any = {}) {
  initProject(root);
  const configPath = path.join(root, '.qmd-adaptive-search', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.qmdCommand = writeFakeQmd(root, options);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function withPathPrefix(prefix, run) {
  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') || 'PATH';
  const oldPath = process.env[pathKey];
  process.env[pathKey] = `${prefix}${path.delimiter}${oldPath || ''}`;
  try {
    return run();
  } finally {
    if (oldPath === undefined) delete process.env[pathKey];
    else process.env[pathKey] = oldPath;
  }
}

function readAllFiles(root) {
  const values = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else values.push(fs.readFileSync(abs, 'utf8'));
    }
  }
  walk(root);
  return values.join('\n');
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
  assert.equal(Object.hasOwn(recent.searches[0], 'queryHash'), false);
  const boosts = JSON.parse(fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'local', 'learned-boosts.json'), 'utf8'));
  assert.ok(boosts.boosts['docs/ProductSpec.md'] > 0);
});

test('forced positive feedback can be reviewed and promoted to shared learning', () => {
  const root = tempProject();
  initProject(root);

  const feedback = recordFeedback({ selectedPath: 'docs/ProductSpec.md', rating: 'good', force: true, query: 'export decisions' }, { root });
  assert.equal(feedback.ok, true);
  assert.ok(feedback.warnings.some((warning) => warning.includes('forced feedback')));

  const review = reviewSuggestions({ root });
  assert.equal(review.count, 1);
  assert.equal(review.suggestions[0].confidence, 0.25);

  const approved = approveSuggestions({ root });
  assert.equal(approved.ok, true);
  assert.equal(approved.approved, 1);

  const sharedAliases = JSON.parse(fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'shared-aliases.json'), 'utf8'));
  const sharedBoosts = JSON.parse(fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'shared-boosts.json'), 'utf8'));
  assert.ok(sharedBoosts.boosts['docs/ProductSpec.md'] > 0);
  assert.ok(sharedAliases.aliases.export.includes('productspec'));
  assert.equal(reviewSuggestions({ root }).count, 0);
});

test('privacy store excludes exact raw query and query hash', () => {
  const root = tempProject();
  const query = 'product decisions raw privacy sentinel';
  adaptiveSearch({ query, maxResults: 5 }, { root });
  recordFeedback({ selectedPath: 'docs/ProductSpec.md', rating: 'good' }, { root });

  const stored = readAllFiles(path.join(root, '.qmd-adaptive-search'));
  const queryHash = createHash('sha256').update(query).digest('hex');
  assert.equal(stored.includes(query), false);
  assert.equal(stored.includes(queryHash), false);
});

test('status reports core counts', () => {
  const root = tempProject();
  initProject(root);
  const status = adaptiveStatus({ root });
  assert.equal(status.aliases.shared, 0);
  assert.equal(status.boosts.learned, 0);
  assert.equal(status.manifest.enabled, true);
  assert.equal(typeof status.qmdNextOperation.command, 'string');
});

test('qmd setup plan shows target side effects and confirmation command', () => {
  const root = tempProject();
  const plan = qmdOperationPlan('setup', { name: 'docs', mask: '**/*.md' }, { root, qmd: { available: true, command: ['qmd'] } });
  assert.deepEqual(plan.command, ['qmd', 'collection', 'add', '.', '--name', 'docs', '--mask', '**/*.md']);
  assert.ok(plan.sideEffects.some((item) => item.includes('collection')));
  assert.equal(plan.dryRunCommand, 'qmd-adaptive-search qmd setup --dry-run');
  assert.equal(plan.confirmCommand, 'qmd-adaptive-search qmd setup --yes');
});

test('qmd operation dry run does not execute heavy command', () => {
  const root = tempProject();
  const result = runQmdOperation('embed', { dryRun: true }, { root, qmd: { available: true, command: ['definitely-must-not-run'] } });
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.deepEqual(result.plan.command, ['definitely-must-not-run', 'embed']);
});

test('confirmed qmd update records job state', () => {
  const root = tempProject();
  const fakeQmd = path.join(root, 'fake-qmd.cjs');
  fs.writeFileSync(fakeQmd, 'console.log(process.argv.slice(2).join(" "));\n', 'utf8');
  const result = runQmdOperation('update', { yes: true }, { root, qmd: { available: true, command: ['node', fakeQmd] } });
  assert.equal(result.ok, true);
  assert.match(result.stdout, /update/);
  const jobState = JSON.parse(fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'local', 'job-state.json'), 'utf8'));
  assert.equal(jobState.currentJob, null);
  assert.equal(jobState.lastUpdateJob.operation, 'update');
});

test('failed qmd operation records failed job and recovery hint', () => {
  const root = tempProject();
  const fakeQmd = path.join(root, 'failing-qmd.cjs');
  fs.writeFileSync(fakeQmd, 'console.error("fatal embed failure"); process.exit(9);\n', 'utf8');

  const result = runQmdOperation('embed', { yes: true, timeoutMs: 1000 }, { root, qmd: { available: true, command: [process.execPath, fakeQmd] } });
  assert.equal(result.ok, false);
  assert.equal(result.status, 9);
  assert.match(result.humanMessage, /fatal embed failure/);

  const status = adaptiveStatus({ root });
  assert.equal(status.failedBackgroundJobs.length, 1);
  assert.equal(status.failedBackgroundJobs[0].type, 'qmd-embed');
  assert.match(status.failedBackgroundJobs[0].recoveryHint, /qmd embed failed/);
  assert.equal(status.lastEmbedJob.status, 'failed');
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

test('qmd output resolves Windows, macOS, and Linux style paths back to project files', () => {
  const root = tempProject();
  fs.mkdirSync(path.join(root, 'notes'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'Windows Note.md'), '# Windows\n', 'utf8');
  fs.writeFileSync(path.join(root, 'docs', 'Mac Note.md'), '# Mac\n', 'utf8');
  fs.writeFileSync(path.join(root, 'notes', 'linux-guide.md'), '# Linux\n', 'utf8');

  const results = parseQmdSearchOutput([
    'qmd://obsidian-note/C:/Users/alice/Vault/docs/Windows Note.md:12 match',
    'qmd://obsidian-note/Users/alice/Vault/docs/Mac Note.md:4 match',
    'qmd://obsidian-note/home/alice/vault/notes/linux-guide.md:7 match'
  ].join('\n'), root);

  assert.deepEqual(results.map((result) => result.path), [
    'docs/Windows Note.md',
    'docs/Mac Note.md',
    'notes/linux-guide.md'
  ]);
});

test('detects qmd from configured command', () => {
  const root = tempProject();
  const command = writeFakeQmd(root);
  const detected = detectQmd({ qmdCommand: command }, root);

  assert.equal(detected.available, true);
  assert.deepEqual(detected.command, command);
});

test('detects qmd on macOS/Linux PATH', { skip: process.platform === 'win32' }, () => {
  const root = tempProject();
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const script = path.join(bin, 'qmd');
  fs.writeFileSync(script, `#!/usr/bin/env node\nif (process.argv[2] === 'status') { console.log('ok'); process.exit(0); } process.exit(1);\n`, 'utf8');
  fs.chmodSync(script, 0o755);

  withPathPrefix(bin, () => {
    const detected = detectQmd({ qmdCommand: null }, root);
    assert.equal(detected.available, true);
    assert.deepEqual(detected.command, ['qmd']);
  });
});

test('detects qmd from Windows npm shim', { skip: process.platform !== 'win32' }, () => {
  const root = tempProject();
  const bin = path.join(root, 'bin');
  const qmdDir = path.join(root, 'node_modules', '@tobilu', 'qmd', 'dist', 'cli');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(qmdDir, { recursive: true });
  const qmdJs = path.join(qmdDir, 'qmd.js');
  fs.writeFileSync(qmdJs, `if (process.argv[2] === 'status') { console.log('ok'); process.exit(0); } process.exit(1);\n`, 'utf8');
  fs.writeFileSync(path.join(bin, 'qmd.cmd'), `@ECHO OFF\r\nnode "${qmdJs.replace(/\//g, '\\')}" %*\r\n`, 'utf8');

  withPathPrefix(bin, () => {
    const detected = detectQmd({ qmdCommand: null }, root);
    assert.equal(detected.available, true);
    assert.deepEqual(detected.command, ['node', qmdJs]);
  });
});

test('fallback handles Japanese query content in docs', () => {
  const root = tempProject();
  configureFakeQmd(root, { searchStatus: 1, searchStderr: 'skip real qmd for fallback test' });
  fs.writeFileSync(path.join(root, 'docs', '検索メモ.md'), '# 検索メモ\n日本語検索の仕様決定をここに保存する。\n', 'utf8');

  const result = adaptiveSearch({ query: '日本語 仕様 決定', maxResults: 5 }, { root });

  assert.equal(result.results[0].path, 'docs/検索メモ.md');
  assert.ok(result.results[0].highlights.some((highlight) => highlight.includes('日本語検索')));
});

test('fallback ranks docs scope above archive matches', () => {
  const root = tempProject();
  configureFakeQmd(root, { searchStatus: 1, searchStderr: 'skip real qmd for fallback test' });
  fs.mkdirSync(path.join(root, 'archive'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'archive', 'ProductSpec.md'), '# Old Product Spec\nData portability and export decisions.\n', 'utf8');
  fs.writeFileSync(path.join(root, 'src', 'ProductSpec.md'), '# Source Product Spec\nData portability and export decisions.\n', 'utf8');

  const result = adaptiveSearch({ query: 'product decisions', mode: 'project', scopeHint: 'docs', maxResults: 10 }, { root });
  const archived = result.results.find((item) => item.path === 'archive/ProductSpec.md');

  assert.equal(result.results[0].path, 'docs/ProductSpec.md');
  assert.ok(result.results[0].why.includes('scope boost: docs'));
  assert.ok(archived?.why.includes('archive penalty'));
  assert.ok(result.results[0].score > (archived?.score || 0));
});

test('qmd query fallback is used for project searches when qmd search has no parseable paths', () => {
  const root = tempProject();
  initProject(root);
  const configPath = path.join(root, '.qmd-adaptive-search', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.qmdCommand = writeFakeQmd(root, {
    searchStdout: 'no file paths here',
    queryStdout: 'qmd://obsidian-note/docs/ProductSpec.md:1 semantic match'
  });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

  const result = adaptiveSearch({ query: 'export decisions', mode: 'project', maxResults: 5 }, { root });

  assert.equal(result.results[0].path, 'docs/ProductSpec.md');
  assert.ok(result.results[0].source.includes('qmd'));
  assert.ok(result.results[0].why.includes('qmd query match'));
});

test('qmd search failure still returns fallback results with warning', () => {
  const root = tempProject();
  initProject(root);
  const configPath = path.join(root, '.qmd-adaptive-search', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.qmdCommand = writeFakeQmd(root, { searchStatus: 1, searchStderr: 'boom' });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

  const result = adaptiveSearch({ query: 'product decisions', maxResults: 5 }, { root });

  assert.equal(result.results[0].path, 'docs/ProductSpec.md');
  assert.ok(result.warnings.some((warning) => warning.includes('qmd search failed; fallback used')));
});
