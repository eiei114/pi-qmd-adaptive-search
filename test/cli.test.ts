import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../src/cli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ── parseArgs unit tests ─────────────────────────────────────────────── */

test('parseArgs returns empty _ for no arguments', () => {
  assert.deepEqual(parseArgs([]), { _: [] });
});

test('parseArgs handles positional arguments', () => {
  assert.deepEqual(parseArgs(['search', 'query-text']), { _: ['search', 'query-text'] });
});

test('parseArgs handles boolean flags', () => {
  assert.deepEqual(parseArgs(['--help']), { _: [], help: true });
  assert.deepEqual(parseArgs(['--dry-run']), { _: [], 'dry-run': true });
  assert.deepEqual(parseArgs(['--yes']), { _: [], yes: true });
  assert.deepEqual(parseArgs(['--force']), { _: [], force: true });
});

test('parseArgs handles key-value arguments', () => {
  assert.deepEqual(parseArgs(['--mode', 'auto']), { _: [], mode: 'auto' });
  assert.deepEqual(parseArgs(['--max', '10']), { _: [], max: '10' });
  assert.deepEqual(parseArgs(['--scope', 'src']), { _: [], scope: 'src' });
  assert.deepEqual(parseArgs(['--manager', 'npm']), { _: [], manager: 'npm' });
});

test('parseArgs handles mixed positional and key-value args', () => {
  assert.deepEqual(
    parseArgs(['search', 'hello world', '--mode', 'auto', '--max', '5']),
    { _: ['search', 'hello world'], mode: 'auto', max: '5' }
  );
});

test('parseArgs handles multiple boolean flags', () => {
  assert.deepEqual(parseArgs(['--help', '--version']), { _: [], help: true, version: true });
  assert.deepEqual(parseArgs(['--dry-run', '--yes']), { _: [], 'dry-run': true, yes: true });
});

test('parseArgs handles trailing boolean after key-value', () => {
  assert.deepEqual(parseArgs(['--mode', 'auto', '--dry-run']), { _: [], mode: 'auto', 'dry-run': true });
});

test('parseArgs treats value starting with -- as next boolean flag', () => {
  // When next arg starts with --, the current flag is treated as boolean
  assert.deepEqual(parseArgs(['--scope', '--path']), { _: [], scope: true, path: true });
});

test('parseArgs handles MCP-style tool names as positional', () => {
  assert.deepEqual(parseArgs(['qmd_adaptive_search']), { _: ['qmd_adaptive_search'] });
  assert.deepEqual(parseArgs(['qmd_search_feedback']), { _: ['qmd_search_feedback'] });
  assert.deepEqual(parseArgs(['qmd_adaptive_status']), { _: ['qmd_adaptive_status'] });
});

test('parseArgs handles colon commands as positional', () => {
  assert.deepEqual(parseArgs(['/qmd-adaptive-init']), { _: ['/qmd-adaptive-init'] });
  assert.deepEqual(parseArgs(['/qmd-adaptive-status']), { _: ['/qmd-adaptive-status'] });
  assert.deepEqual(parseArgs(['/qmd-adaptive-configure']), { _: ['/qmd-adaptive-configure'] });
});

test('parseArgs does not interpret -- as separator', () => {
  // The parser does not support -- as positional separator
  // -- becomes key '' with value 'search', and 'foo' is positional
  assert.deepEqual(parseArgs(['--', 'search', 'foo']), { _: ['foo'], '': 'search' });
});

test('parseArgs with all CLI flags from help output', () => {
  const result = parseArgs([
    'search', 'query', '--mode', 'auto', '--scope', 'docs', '--max', '20',
    'feedback', '--selected', 'a.md,b.md', '--rating', 'good', '--force'
  ]);
  assert.deepEqual(result._.slice(0, 2), ['search', 'query']);
  assert.equal(result.mode, 'auto');
  assert.equal(result.scope, 'docs');
  assert.equal(result.max, '20');
});

/* ── CLI subprocess helpers ───────────────────────────────────────────── */

const binScript = path.resolve(__dirname, '../../bin/qmd-adaptive-search.js');

function spawnCli(args: string[], options: { cwd?: string; env?: Record<string, string> } = {}) {
  const result = spawnSync(process.execPath, [binScript, ...args], {
    encoding: 'utf8',
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...options.env },
    timeout: 15000
  });
  return {
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    status: result.status,
    signal: result.signal,
    error: result.error
  };
}

function tempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `qmd-cli-${prefix}-`));
}

/* ── CLI --help output ────────────────────────────────────────────────── */

test('CLI --help prints usage information', () => {
  const { stdout, status } = spawnCli(['--help']);
  assert.equal(status, 0);
  assert.match(stdout, /qmd-adaptive-search/);
  assert.match(stdout, /Usage:/);
  assert.match(stdout, /search/);
  assert.match(stdout, /feedback/);
  assert.match(stdout, /status/);
  assert.match(stdout, /init/);
  assert.match(stdout, /configure/);
  assert.match(stdout, /maintain/);
  assert.match(stdout, /install-qmd/);
});

test('CLI help command prints usage information', () => {
  const { stdout, status } = spawnCli(['help']);
  assert.equal(status, 0);
  assert.match(stdout, /Usage:/);
});

test('CLI with no arguments prints usage', () => {
  const { stdout, status } = spawnCli([]);
  assert.equal(status, 0);
  assert.match(stdout, /Usage:/);
});

test('CLI help output includes MCP-style tool names', () => {
  const { stdout, status } = spawnCli(['--help']);
  assert.equal(status, 0);
  assert.match(stdout, /qmd_adaptive_search/);
  assert.match(stdout, /qmd_search_feedback/);
  assert.match(stdout, /qmd_adaptive_status/);
});

/* ── Non-zero exit paths ──────────────────────────────────────────────── */

test('CLI unknown command exits with code 1', () => {
  const { stderr, status } = spawnCli(['nonexistent-command']);
  assert.equal(status, 1);
  assert.match(stderr, /Unknown command/);
});

test('CLI search without query exits with code 1', () => {
  const { stderr, status } = spawnCli(['search']);
  assert.equal(status, 1);
  assert.match(stderr, /query is required/);
});

test('CLI feedback without --selected exits with code 1', () => {
  const { stderr, status } = spawnCli(['feedback']);
  assert.equal(status, 1);
  assert.match(stderr, /--selected is required/);
});

test('CLI search with empty query string exits with code 1', () => {
  const { stderr, status } = spawnCli(['search', '']);
  assert.equal(status, 1);
  assert.match(stderr, /query is required/);
});

test('CLI configure with unknown preset warns or errors gracefully', () => {
  const root = tempDir('cfg-unknown');
  const { stdout, status } = spawnCli(['configure', '--preset', 'invalid'], { cwd: root });
  // applyPreset throws on unknown preset; exit code should be 1
  assert.equal(status, 1);
  const { stderr: fallbackStderr } = spawnCli(['configure', '--preset', 'invalid'], { cwd: root });
  assert.ok(fallbackStderr);
});

/* ── Dry-run and confirmation messages ────────────────────────────────── */

test('CLI maintain --dry-run shows plan without modifying state', () => {
  const root = tempDir('maint-dry');
  const { stdout, status } = spawnCli(['maintain', '--dry-run'], { cwd: root });
  assert.equal(status, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.dryRun, true);
  assert.ok(Array.isArray(payload.plan.actions));
  // Should not have created project files
  assert.equal(fs.existsSync(path.join(root, '.qmd-adaptive-search')), false);
});

test('CLI maintain dry-run with learned state shows expected cleanup', () => {
  const root = tempDir('maint-learned');
  // Create project with learned state
  spawnCli(['init'], { cwd: root });
  const localDir = path.join(root, '.qmd-adaptive-search', 'local');
  fs.mkdirSync(localDir, { recursive: true });
  fs.writeFileSync(
    path.join(localDir, 'learned-aliases.json'),
    JSON.stringify({ aliases: { content: ['data'], templates: ['views'] } }, null, 2),
    'utf8'
  );

  const { stdout, status } = spawnCli(['maintain', 'learned-aliases', '--dry-run'], { cwd: root });
  assert.equal(status, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.dryRun, true);
  assert.equal(payload.plan.actions.length, 1);
  assert.equal(payload.plan.actions[0].beforeCount, 2);
  // State should remain unchanged after dry-run
  const aliases = JSON.parse(fs.readFileSync(path.join(localDir, 'learned-aliases.json'), 'utf8'));
  assert.equal(Object.keys(aliases.aliases).length, 2);
});

test('CLI qmd setup --dry-run shows plan without executing', () => {
  const root = tempDir('qmd-dry');
  spawnCli(['init'], { cwd: root });
  fs.writeFileSync(
    path.join(root, '.qmd-adaptive-search', 'config.json'),
    JSON.stringify({ qmdCommand: [process.execPath, '-e', 'process.exit(0)'] }, null, 2),
    'utf8'
  );
  const { stdout, status } = spawnCli(['qmd', 'setup', '--dry-run'], { cwd: root });
  assert.equal(status, 0);
  const payload = JSON.parse(stdout);
  assert.ok(payload.plan);
  assert.equal(payload.plan.operation, 'setup');
});

/* ── CLI init and status ──────────────────────────────────────────────── */

test('CLI init creates project config', () => {
  const root = tempDir('init');
  const { stdout, status } = spawnCli(['init'], { cwd: root });
  assert.equal(status, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.ok, true);
  assert.equal(fs.existsSync(path.join(root, '.qmd-adaptive-search', 'config.json')), true);
});

test('CLI init with --force reinitializes', () => {
  const root = tempDir('init-force');
  spawnCli(['init'], { cwd: root });
  // Modify config to test re-init
  const configPath = path.join(root, '.qmd-adaptive-search', 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({ custom: true }, null, 2), 'utf8');
  const { stdout, status } = spawnCli(['init', '--force'], { cwd: root });
  assert.equal(status, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.ok, true);
});

test('CLI status returns JSON with aliases and boosts', () => {
  const root = tempDir('status');
  spawnCli(['init'], { cwd: root });
  const { stdout, status } = spawnCli(['status'], { cwd: root });
  assert.equal(status, 0);
  const payload = JSON.parse(stdout);
  // Status should contain core fields
  assert.ok('aliases' in payload);
  assert.ok('boosts' in payload);
  assert.ok('qmd' in payload);
  assert.ok('manifest' in payload);
  assert.ok('diagnosis' in payload);
  assert.equal(payload.aliases.shared, 0);
  assert.equal(payload.aliases.learned, 0);
  assert.equal(payload.boosts.shared, 0);
  assert.equal(payload.boosts.learned, 0);
});

test('CLI status from uninitialized directory auto-initializes', () => {
  const root = tempDir('status-auto');
  const { stdout, status } = spawnCli(['status'], { cwd: root });
  assert.equal(status, 0);
  const payload = JSON.parse(stdout);
  assert.ok('aliases' in payload);
  // Should have auto-initialized
  assert.equal(fs.existsSync(path.join(root, '.qmd-adaptive-search', 'config.json')), true);
});

test('CLI /qmd-adaptive-init colon command works', () => {
  const root = tempDir('colon-init');
  const { stdout, status } = spawnCli(['/qmd-adaptive-init'], { cwd: root });
  assert.equal(status, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.ok, true);
});

test('CLI configure --preset docs applies the preset', () => {
  const root = tempDir('cfg-docs');
  spawnCli(['init'], { cwd: root });
  const { stdout, status } = spawnCli(['configure', '--preset', 'docs'], { cwd: root });
  assert.equal(status, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.preset, 'docs');
});

test('CLI configure with positional preset works', () => {
  const root = tempDir('cfg-pos');
  spawnCli(['init'], { cwd: root });
  const { stdout, status } = spawnCli(['configure', 'privacy'], { cwd: root });
  assert.equal(status, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.preset, 'privacy');
});

test('CLI configure --reset applies defaults before preset', () => {
  const root = tempDir('cfg-reset');
  spawnCli(['init'], { cwd: root });
  const { stdout, status } = spawnCli(['configure', '--preset', 'code', '--reset'], { cwd: root });
  assert.equal(status, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.preset, 'code');
});

/* ── MCP-style tool name aliases for init, status, configure ──────────── */

test('CLI /qmd-adaptive-status colon command returns status', () => {
  const root = tempDir('colon-status');
  spawnCli(['init'], { cwd: root });
  const { stdout, status } = spawnCli(['/qmd-adaptive-status'], { cwd: root });
  assert.equal(status, 0);
  const payload = JSON.parse(stdout);
  assert.ok('aliases' in payload);
});

test('CLI /qmd-adaptive-configure colon command works', () => {
  const root = tempDir('colon-cfg');
  spawnCli(['init'], { cwd: root });
  const { stdout, status } = spawnCli(['/qmd-adaptive-configure', 'mixed'], { cwd: root });
  assert.equal(status, 0);
  const payload = JSON.parse(stdout);
  assert.equal(payload.preset, 'mixed');
});
