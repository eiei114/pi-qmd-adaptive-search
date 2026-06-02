import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initProject } from '../src/index.js';
import {
  QMD_A_COLON_COMMANDS,
  QMD_A_LEGACY_COMMANDS,
  registerQmdAdaptiveCommands,
  registerQmdAdaptiveTools,
  type ExtensionAPILike,
  type ExtensionCommandContext
} from '../src/extension-commands.js';

function createMockPi() {
  const commands = new Map<string, { description: string; handler: (args: string, ctx: ExtensionCommandContext) => Promise<unknown> }>();
  const tools = new Map<string, { execute: (...args: unknown[]) => Promise<unknown> }>();
  const pi: ExtensionAPILike = {
    registerCommand(name, options) {
      commands.set(name, options);
    },
    registerTool(options: { name: string; execute: (...args: unknown[]) => Promise<unknown> }) {
      tools.set(options.name, options);
    }
  };
  return { pi, commands, tools };
}

function tempProjectRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmd-adaptive-ext-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'README.md'), '# Test\n', 'utf8');
  initProject(root);
  return root;
}

test('registerQmdAdaptiveCommands registers all qmd-a colon commands', () => {
  const { pi, commands } = createMockPi();
  registerQmdAdaptiveCommands(pi);
  for (const name of QMD_A_COLON_COMMANDS) {
    assert.equal(commands.has(name), true, `missing colon command ${name}`);
  }
  assert.equal(commands.has('qmd:init'), false, 'must not register broad /qmd:* namespace');
});

test('registerQmdAdaptiveCommands registers legacy hyphen aliases', () => {
  const { pi, commands } = createMockPi();
  registerQmdAdaptiveCommands(pi);
  for (const name of QMD_A_LEGACY_COMMANDS) {
    assert.equal(commands.has(name), true, `missing legacy command ${name}`);
  }
});

test('legacy qmd-adaptive-review approve dispatches to approve handler', async () => {
  const { pi, commands } = createMockPi();
  registerQmdAdaptiveCommands(pi);
  const root = tempProjectRoot();
  const review = commands.get('qmd-adaptive-review');
  assert.ok(review);
  const result = await review.handler('approve', { cwd: root, ui: { notify: () => {} } });
  const payload = JSON.parse(String((result as { content: { text: string }[] }).content[0].text));
  assert.equal(payload.ok, true);
  assert.equal(payload.approved, 0);
});

test('colon qmd-a:approve dispatches without legacy approve subcommand', async () => {
  const { pi, commands } = createMockPi();
  registerQmdAdaptiveCommands(pi);
  const root = tempProjectRoot();
  const approve = commands.get('qmd-a:approve');
  assert.ok(approve);
  const result = await approve.handler('', { cwd: root, ui: { notify: () => {} } });
  const payload = JSON.parse(String((result as { content: { text: string }[] }).content[0].text));
  assert.equal(payload.ok, true);
});

test('legacy qmd-adaptive-qmd-setup --yes runs operation; colon setup-run matches', async () => {
  const { pi, commands } = createMockPi();
  registerQmdAdaptiveCommands(pi);
  const root = tempProjectRoot();
  const ctx = { cwd: root, ui: { notify: () => {} } };

  const legacy = commands.get('qmd-adaptive-qmd-setup');
  const colonRun = commands.get('qmd-a:setup-run');
  const colonPlan = commands.get('qmd-a:setup');
  assert.ok(legacy && colonRun && colonPlan);

  const rootLegacy = tempProjectRoot();
  const rootColonRun = tempProjectRoot();
  const notify = () => {};
  const legacyResult = await legacy.handler('--yes', { cwd: rootLegacy, ui: { notify } });
  const colonRunResult = await colonRun.handler('', { cwd: rootColonRun, ui: { notify } });
  const colonPlanResult = await colonPlan.handler('', ctx);

  const legacyPayload = JSON.parse(String((legacyResult as { content: { text: string }[] }).content[0].text));
  const colonRunPayload = JSON.parse(String((colonRunResult as { content: { text: string }[] }).content[0].text));
  const colonPlanPayload = JSON.parse(String((colonPlanResult as { content: { text: string }[] }).content[0].text));

  assert.equal(colonPlanPayload.plan?.operation, 'setup');
  assert.equal(colonPlanPayload.ok, undefined);
  assert.equal('status' in colonPlanPayload, false);

  assert.equal(typeof legacyPayload.ok, 'boolean');
  assert.equal(typeof colonRunPayload.ok, 'boolean');
  assert.equal(legacyPayload.ok, colonRunPayload.ok);
  assert.equal(legacyPayload.plan?.operation, 'setup');
  assert.equal(colonRunPayload.plan?.operation, 'setup');
});

test('qmd_adaptive_search tool returns compact text and lightweight details', async () => {
  const { pi, tools } = createMockPi();
  registerQmdAdaptiveTools(pi);
  const root = tempProjectRoot();
  fs.writeFileSync(path.join(root, 'docs', 'ProductSpec.md'), '# Product Spec\nWorkout product decisions.\n', 'utf8');

  const searchTool = tools.get('qmd_adaptive_search');
  assert.ok(searchTool);

  const result = await searchTool.execute('tool-call-1', { query: 'product decisions', maxResults: 5 }, null, null, {
    cwd: root
  });
  const payload = result as { content: { type: string; text: string }[]; details: { resultPaths: string[]; results: unknown[] } };

  assert.equal(payload.content.length, 1);
  assert.match(payload.content[0].text, /qmd_adaptive_search: \d+ result\(s\)/);
  assert.doesNotMatch(payload.content[0].text, /^\{/);
  assert.ok(Array.isArray(payload.details.resultPaths));
  assert.ok(payload.details.resultPaths.length > 0);
  assert.ok(Array.isArray(payload.details.results));
  assert.equal(Object.hasOwn((payload.details.results[0] || {}) as object, 'lead'), false);
});
