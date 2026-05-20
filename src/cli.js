'use strict';

const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const { initProject, applyPreset } = require('./config');
const { adaptiveSearch } = require('./search');
const { recordFeedback, reviewSuggestions, approveSuggestions } = require('./feedback');
const { adaptiveStatus } = require('./status');
const { detectQmd, installInstructions } = require('./qmd');
const { loadConfig } = require('./config');
const { spawnSync } = require('node:child_process');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) out._.push(arg);
    else {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i += 1; }
    }
  }
  return out;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function help() {
  console.log(`qmd-adaptive-search 0.1.0

Usage:
  qmd-adaptive-search search <query> [--mode auto|precision|recall|article|project] [--scope <path>] [--max 10]
  qmd-adaptive-search feedback --selected <path[,path]> [--rating good|bad] [--force]
  qmd-adaptive-search status
  qmd-adaptive-search init
  qmd-adaptive-search configure --preset docs|mixed|code|privacy [--reset]
  qmd-adaptive-search review [--approve]
  qmd-adaptive-search install-qmd [--manager bun|npm|pnpm|yarn] [--yes]

MCP-style tool names:
  qmd_adaptive_search, qmd_search_feedback, qmd_adaptive_status
`);
}

async function confirm(message) {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(`${message} [y/N] `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function installQmd(args) {
  const managers = {
    bun: ['bun', ['add', '-g', '@tobilu/qmd']],
    npm: ['npm', ['install', '-g', '@tobilu/qmd']],
    pnpm: ['pnpm', ['add', '-g', '@tobilu/qmd']],
    yarn: ['yarn', ['global', 'add', '@tobilu/qmd']]
  };
  const manager = args.manager || 'bun';
  if (!managers[manager]) throw new Error(`Unknown manager: ${manager}`);
  const [bin, cmdArgs] = managers[manager];
  console.log(`Planned install command: ${bin} ${cmdArgs.join(' ')}`);
  if (!args.yes && !(await confirm('Run global qmd install?'))) return { ok: false, cancelled: true };
  const result = spawnSync(bin, cmdArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) return { ok: false, status: result.status };
  return { ok: true, qmd: detectQmd(loadConfig(process.cwd()), process.cwd()) };
}

async function runCli(argv) {
  const args = parseArgs(argv);
  const command = args._[0];
  if (!command || command === '--help' || command === 'help') return help();

  if (command === 'init' || command === '/qmd-adaptive-init') return printJson(initProject(process.cwd(), { force: !!args.force }));
  if (command === 'status' || command === 'qmd_adaptive_status' || command === '/qmd-adaptive-status') return printJson(adaptiveStatus());
  if (command === 'configure' || command === '/qmd-adaptive-configure') {
    const preset = args.preset || args._[1] || 'mixed';
    return printJson(applyPreset(process.cwd(), preset, { reset: !!args.reset, dryRun: !!args['dry-run'] }));
  }
  if (command === 'search' || command === 'qmd_adaptive_search') {
    const query = args.query || args._.slice(1).join(' ');
    if (!query) throw new Error('query is required');
    return printJson(adaptiveSearch({ query, mode: args.mode || 'auto', scopeHint: args.scope, maxResults: args.max ? Number(args.max) : undefined }));
  }
  if (command === 'feedback' || command === 'qmd_search_feedback') {
    const selected = args.selected || args.selectedPath || args.selectedPaths || args._[1];
    if (!selected) throw new Error('--selected is required');
    return printJson(recordFeedback({ selectedPaths: selected.split(',').map((s) => s.trim()).filter(Boolean), rating: args.rating || 'good', force: !!args.force }));
  }
  if (command === 'review' || command === '/qmd-adaptive-review') {
    if (args.approve) return printJson(approveSuggestions());
    return printJson(reviewSuggestions());
  }
  if (command === 'install-qmd' || command === '/qmd-adaptive-install-qmd') return printJson(await installQmd(args));
  if (command === 'install-instructions') return console.log(installInstructions());
  throw new Error(`Unknown command: ${command}`);
}

module.exports = { runCli, parseArgs };
