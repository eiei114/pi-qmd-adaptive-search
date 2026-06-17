import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initProject, loadConfig } from '../src/index.js';
import {
  QMD_A_COLON_COMMANDS,
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

test('qmd-a:configure with no args prompts for a preset and applies the selection', async () => {
  const { pi, commands } = createMockPi();
  registerQmdAdaptiveCommands(pi);
  const root = tempProjectRoot();
  const configure = commands.get('qmd-a:configure');
  assert.ok(configure);

  const notifications: string[] = [];
  let selectTitle = '';
  let selectOptions: string[] = [];
  const result = await configure.handler('', {
    cwd: root,
    hasUI: true,
    ui: {
      notify: (text) => notifications.push(text),
      select: async (title, options) => {
        selectTitle = title;
        selectOptions = options;
        return 'privacy';
      }
    }
  });

  const payload = JSON.parse(String((result as { content: { text: string }[] }).content[0].text));
  const config = loadConfig(root);

  assert.equal(selectTitle, 'Choose qmd adaptive preset:');
  assert.deepEqual(selectOptions, ['docs', 'mixed', 'code', 'privacy']);
  assert.equal(payload.preset, 'privacy');
  assert.equal(config.changeDetection.manifestEnabled, false);
  assert.deepEqual(notifications, ['qmd adaptive preset applied: privacy']);
});

test('colon qmd-a:maintain shows cleanup plan without modifying state', async () => {
  const { pi, commands } = createMockPi();
  registerQmdAdaptiveCommands(pi);
  const root = tempProjectRoot();
  const maintain = commands.get('qmd-a:maintain');
  assert.ok(maintain);

  const learnedAliases = path.join(root, '.qmd-adaptive-search', 'local', 'learned-aliases.json');
  fs.writeFileSync(learnedAliases, JSON.stringify({ aliases: { content: ['data'] } }, null, 2), 'utf8');

  const result = await maintain.handler('', { cwd: root, ui: { notify: () => {} } });
  const payload = JSON.parse(String((result as { content: { text: string }[] }).content[0].text));
  assert.equal(payload.actions.length, 3);
  assert.equal(JSON.parse(fs.readFileSync(learnedAliases, 'utf8')).aliases.content.length, 1);
});

test('qmd-a:configure with no args in headless mode notifies that TUI selection is required', async () => {
  const { pi, commands } = createMockPi();
  registerQmdAdaptiveCommands(pi);
  const root = tempProjectRoot();
  const configure = commands.get('qmd-a:configure');
  assert.ok(configure);

  const notifications: { text: string; level: string }[] = [];
  const result = await configure.handler('', {
    cwd: root,
    hasUI: false,
    ui: { notify: (text, level) => notifications.push({ text, level }) }
  });

  const payload = JSON.parse(String((result as { content: { text: string }[] }).content[0].text));
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'ui_required');
  assert.match(payload.message, /Preset selection requires the Pi TUI/);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].level, 'warning');
  assert.match(notifications[0].text, /qmd-adaptive-search configure --preset/);
});

test('qmd-a:setup-run runs operation; qmd-a:setup returns plan only', async () => {
  const { pi, commands } = createMockPi();
  registerQmdAdaptiveCommands(pi);
  const root = tempProjectRoot();
  const ctx = { cwd: root, ui: { notify: () => {} } };

  const colonRun = commands.get('qmd-a:setup-run');
  const colonPlan = commands.get('qmd-a:setup');
  assert.ok(colonRun && colonPlan);

  const rootColonRun = tempProjectRoot();
  const notify = () => {};
  const colonRunResult = await colonRun.handler('', { cwd: rootColonRun, ui: { notify } });
  const colonPlanResult = await colonPlan.handler('', ctx);

  const colonRunPayload = JSON.parse(String((colonRunResult as { content: { text: string }[] }).content[0].text));
  const colonPlanPayload = JSON.parse(String((colonPlanResult as { content: { text: string }[] }).content[0].text));

  assert.equal(colonPlanPayload.plan?.operation, 'setup');
  assert.equal(colonPlanPayload.ok, undefined);
  assert.equal('status' in colonPlanPayload, false);

  assert.equal(typeof colonRunPayload.ok, 'boolean');
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
  const payload = result as {
    content: { type: string; text: string }[];
    details: { resultPaths: string[]; results: unknown[]; backgroundJobStatus?: { lastSearchStatus: string | null } };
  };

  assert.equal(payload.content.length, 1);
  assert.match(payload.content[0].text, /qmd_adaptive_search: \d+ result\(s\)/);
  assert.doesNotMatch(payload.content[0].text, /^\{/);
  assert.ok(Array.isArray(payload.details.resultPaths));
  assert.ok(payload.details.resultPaths.length > 0);
  assert.ok(Array.isArray(payload.details.results));
  assert.equal(Object.hasOwn((payload.details.results[0] || {}) as object, 'lead'), false);
  assert.equal(Object.hasOwn(payload.details, 'backgroundJobs'), false);
  assert.equal(typeof payload.details.backgroundJobStatus?.lastSearchStatus, 'string');
});
