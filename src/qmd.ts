import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { toPosix } from './fs-utils.js';

function commandCandidates(config) {
  const candidates = [];
  if (Array.isArray(config.qmdCommand) && config.qmdCommand.length > 0) candidates.push(config.qmdCommand);
  const discovered = discoverWindowsQmdNodeEntrypoint();
  if (discovered) candidates.push(discovered);
  candidates.push(['qmd']);
  return candidates;
}

function discoverWindowsQmdNodeEntrypoint() {
  if (process.platform !== 'win32') return null;
  const where = spawnSync('where.exe', ['qmd.cmd'], { encoding: 'utf8', shell: false, timeout: 2000 });
  if (where.status !== 0 || !where.stdout) return null;
  for (const shim of where.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
    try {
      const text = fs.readFileSync(shim, 'utf8');
      const match = text.match(/\bnode(?:\.exe)?\s+"([^"]*\\node_modules\\@tobilu\\qmd\\dist\\cli\\qmd\.js)"/i)
        || text.match(/\bnode(?:\.exe)?\s+"([^"]*\/node_modules\/@tobilu\/qmd\/dist\/cli\/qmd\.js)"/i);
      if (match && fs.existsSync(match[1])) return ['node', match[1]];
    } catch {}
  }
  return null;
}

function runCommand(command, args, options: any = {}) {
  const [bin, ...prefix] = command;
  const bins = process.platform === 'win32' && !path.extname(bin) ? [bin, `${bin}.cmd`, `${bin}.exe`] : [bin];
  let last;
  for (const candidate of bins) {
    const shell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(candidate);
    last = spawnSync(candidate, [...prefix, ...args], {
      cwd: options.cwd || process.cwd(),
      encoding: 'utf8',
      shell,
      timeout: options.timeoutMs || 8000
    });
    if (!last.error || !['ENOENT', 'EINVAL'].includes(last.error.code)) return last;
  }
  return last;
}

function canonicalPathKey(value) {
  return toPosix(value)
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

function collectFiles(root, dir = root, output = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return output;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = toPosix(path.relative(root, abs));
    if (rel === '.git' || rel.startsWith('.git/') || rel === 'node_modules' || rel.includes('/node_modules/')) continue;
    if (entry.isDirectory()) collectFiles(root, abs, output);
    else if (entry.isFile()) output.push(rel);
  }
  return output;
}

function createPathResolver(root) {
  const byCanonical = new Map();
  return function resolve(raw) {
    const direct = toPosix(path.isAbsolute(raw) ? path.relative(root, raw) : raw).replace(/^\.\//, '').replace(/:\d+$/, '');
    if (fs.existsSync(path.join(root, direct))) return direct;

    const numberedFolder = direct.replace(/^(\d+)-([^/]+)/, '$1_$2');
    if (fs.existsSync(path.join(root, numberedFolder))) return numberedFolder;

    if (byCanonical.size === 0) {
      for (const rel of collectFiles(root)) byCanonical.set(canonicalPathKey(rel), rel);
    }
    const directKey = canonicalPathKey(direct).replace(/^[a-z]:/i, '').replace(/^\/+/, '');
    const exact = byCanonical.get(directKey);
    if (exact) return exact;
    for (const [key, rel] of byCanonical.entries()) {
      if (directKey.endsWith(`/${key}`)) return rel;
    }
    return direct;
  };
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
  const resolvePath = createPathResolver(root);
  const lines = String(output || '').split(/\r?\n/);
  for (const line of lines) {
    const qmdMatch = line.match(/qmd:\/\/[^/]+\/(.+?\.(?:md|txt|ts|tsx|js|py|json|ya?ml))(?:[:\s]|$)/i);
    const mdPathMatch = line.match(/((?:[\w .()\-[\]@]+[\\/])+[\w .()\-[\]@]+\.(?:md|txt|ts|tsx|js|py|json|ya?ml))/i);
    const raw = qmdMatch ? qmdMatch[1] : (mdPathMatch ? mdPathMatch[1] : null);
    if (!raw) continue;
    const rel = resolvePath(raw);
    if (!fs.existsSync(path.join(root, rel))) continue;
    if (seen.has(rel)) continue;
    seen.add(rel);
    results.push({ path: rel, source: ['qmd'], score: 0.75, why: ['qmd search match'] });
  }
  return results;
}

function qmdSearch(query, maxResults, config, root = process.cwd(), options: any = {}) {
  const detected = detectQmd(config, root);
  if (!detected.available) return { detected, results: [], error: 'qmd not found' };
  const search = runCommand(detected.command, ['search', query, '-n', String(maxResults)], { cwd: root, timeoutMs: config.search?.qmdSearchTimeoutMs || 15000 });
  if (search.status !== 0) return { detected, results: [], error: search.stderr || String(search.error || 'qmd search failed'), method: 'search' };

  const searchResults = parseQmdSearchOutput(search.stdout, root);
  if (searchResults.length > 0) return { detected, results: searchResults, raw: search.stdout, method: 'search' };

  if (!options.useQueryFallback) return { detected, results: [], raw: search.stdout, method: 'search' };

  const semantic = runCommand(detected.command, ['query', query, '-n', String(maxResults)], { cwd: root, timeoutMs: config.search?.qmdQueryTimeoutMs || 45000 });
  if (semantic.status !== 0) return { detected, results: [], error: semantic.stderr || String(semantic.error || 'qmd query failed'), raw: search.stdout, method: 'query' };
  return {
    detected,
    results: parseQmdSearchOutput(semantic.stdout, root).map((result) => ({ ...result, why: ['qmd query match'] })),
    raw: semantic.stdout,
    method: 'query'
  };
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

export { detectQmd, qmdSearch, parseQmdSearchOutput, installInstructions };
