'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { toPosix } = require('./fs-utils');

function commandCandidates(config) {
  const candidates = [];
  if (Array.isArray(config.qmdCommand) && config.qmdCommand.length > 0) candidates.push(config.qmdCommand);
  candidates.push(['qmd']);
  return candidates;
}

function runCommand(command, args, options = {}) {
  const [bin, ...prefix] = command;
  const bins = process.platform === 'win32' && !path.extname(bin) ? [bin, `${bin}.cmd`, `${bin}.exe`] : [bin];
  let last;
  for (const candidate of bins) {
    last = spawnSync(candidate, [...prefix, ...args], {
      cwd: options.cwd || process.cwd(),
      encoding: 'utf8',
      shell: false,
      timeout: options.timeoutMs || 8000
    });
    if (!last.error || last.error.code !== 'ENOENT') return last;
  }
  return last;
}

function detectQmd(config, root = process.cwd()) {
  const errors = [];
  for (const candidate of commandCandidates(config)) {
    const status = runCommand(candidate, ['status'], { cwd: root, timeoutMs: 5000 });
    if (status.status === 0) return { available: true, command: candidate, statusText: status.stdout || status.stderr || '' };
    const version = runCommand(candidate, ['--version'], { cwd: root, timeoutMs: 3000 });
    if (version.status === 0) return { available: true, command: candidate, statusText: version.stdout || version.stderr || '' };
    errors.push({ command: candidate.join(' '), error: (status.stderr || version.stderr || status.error || '').toString().trim() });
  }
  return { available: false, command: null, errors };
}

function parseQmdSearchOutput(output, root) {
  const results = [];
  const seen = new Set();
  const lines = String(output || '').split(/\r?\n/);
  for (const line of lines) {
    const qmdMatch = line.match(/qmd:\/\/[^/]+\/(.+?)(?:\s|$)/);
    const mdPathMatch = line.match(/((?:[\w .()\-[\]@]+[\\/])+[\w .()\-[\]@]+\.(?:md|txt|ts|tsx|js|py|json|ya?ml))/i);
    const raw = qmdMatch ? qmdMatch[1] : (mdPathMatch ? mdPathMatch[1] : null);
    if (!raw) continue;
    const rel = toPosix(path.isAbsolute(raw) ? path.relative(root, raw) : raw).replace(/^\.\//, '').replace(/:\d+$/, '');
    if (!fs.existsSync(path.join(root, rel))) continue;
    if (seen.has(rel)) continue;
    seen.add(rel);
    results.push({ path: rel, source: ['qmd'], score: 0.75, why: ['qmd search match'] });
  }
  return results;
}

function qmdSearch(query, maxResults, config, root = process.cwd()) {
  const detected = detectQmd(config, root);
  if (!detected.available) return { detected, results: [], error: 'qmd not found' };
  const run = runCommand(detected.command, ['search', query, '-n', String(maxResults)], { cwd: root, timeoutMs: 15000 });
  if (run.status !== 0) return { detected, results: [], error: run.stderr || String(run.error || 'qmd search failed') };
  return { detected, results: parseQmdSearchOutput(run.stdout, root), raw: run.stdout };
}

function installInstructions() {
  return [
    'qmd was not found.',
    '',
    'qmd_adaptive_search can run filename/content fallback, but semantic search needs qmd.',
    '',
    'Install options:',
    '  bun add -g @tobilu/qmd',
    '  npm install -g @tobilu/qmd',
    '  pnpm add -g @tobilu/qmd',
    '  yarn global add @tobilu/qmd',
    '',
    'or configure qmdCommand in .qmd-adaptive-search/config.json:',
    '{ "qmdCommand": ["node", "path/to/qmd.js"] }'
  ].join('\n');
}

module.exports = { detectQmd, qmdSearch, parseQmdSearchOutput, installInstructions };
