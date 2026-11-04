#!/usr/bin/env node
// Focused benchmark for the local fallback scoring hot path (walkFiles + scoreFile).
//
// It builds a throwaway project of markdown notes, then reports wall-clock time and
// the number of bytes the scoring path actually reads. Comparing the reported
// match counts between two revisions is what shows whether a speed-up kept the
// ranking behaviour intact.
//
// Usage:
//   node scripts/bench-fallback-scoring.mjs [--files 1000] [--file-kb 32] [--file-kb-max 96]
//                                          [--tail-ratio 0.05] [--tail-kb 1024]
//                                          [--early-match-ratio 0.05] [--late-match-ratio 0.1]
//                                          [--runs 5] [--terms product,export,decision]
//
// --runs must be a positive integer. The guard runs before the fixture is built, so an
// invalid value exits without creating a temporary directory.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

function parseArgs(argv) {
  const out = {
    files: 1000,
    fileKb: 32,
    fileKbMax: 96,
    tailRatio: 0,
    tailKb: 1024,
    earlyMatchRatio: 0.05,
    lateMatchRatio: 0.1,
    runs: 5,
    terms: 'product,export,decision'
  };
  const numeric = new Set(['files', 'fileKb', 'fileKbMax', 'tailRatio', 'tailKb', 'earlyMatchRatio', 'lateMatchRatio', 'runs']);
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    const name = key.replace(/^--/, '').replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
    if (!value || !name) continue;
    if (numeric.has(name)) { out[name] = Number(value); i += 1; }
    else if (name === 'terms') { out.terms = String(value); i += 1; }
  }
  return out;
}

// Deterministic pseudo-random so fixture sizes are stable across revisions.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fillerFor(bytes, random) {
  const chunk = 'Generic benchmark filler line without query keywords for adaptive search.\n';
  return chunk.repeat(Math.ceil(bytes / chunk.length));
}

function buildFixture(root, options) {
  const random = mulberry32(20261104);
  const termList = options.terms.split(',').map((term) => term.trim()).filter(Boolean);
  let totalBytes = 0;
  const counts = { earlyMatch: 0, lateMatch: 0 };
  for (let i = 0; i < options.files; i += 1) {
    const dir = path.join(root, 'docs', `bucket-${i % 20}`, `sub-${i % 7}`);
    fs.mkdirSync(dir, { recursive: true });
    const kb = random() < options.tailRatio ? options.tailKb : options.fileKb + Math.floor(random() * Math.max(1, options.fileKbMax - options.fileKb + 1));
    const targetBytes = kb * 1024;
    const term = termList[i % termList.length];
    const roll = random();
    let body = `${'# Fixture note\n\n'}` + fillerFor(targetBytes, random);
    if (roll < options.earlyMatchRatio) {
      // Query term sits inside the leading prefix, so any prefix-based scan finds it.
      body = `# Fixture note\n\nThe ${term} decision summary lives here.\n${fillerFor(targetBytes, random)}`;
      counts.earlyMatch += 1;
    } else if (roll < options.earlyMatchRatio + options.lateMatchRatio) {
      // Query term sits past the leading prefix: only a full-document scan finds it.
      const head = fillerFor(Math.max(targetBytes - 2048, 4096), random);
      body = `# Fixture note\n\n${head}\nThe ${term} decision appears far below the opening section.\n`;
      counts.lateMatch += 1;
    }
    totalBytes += Buffer.byteLength(body);
    fs.writeFileSync(path.join(dir, `note-${i}.md`), body, 'utf8');
  }
  return { totalBytes, counts };
}

const options = parseArgs(process.argv.slice(2));

// A run count of zero (or a negative/non-numeric value) would leave `samples` empty, so
// there is no median to report. Reject it before mkdtempSync so the process neither throws
// inside the report nor leaves a temporary fixture behind.
function invalidRunsMessage(runs) {
  if (Number.isInteger(runs) && runs > 0) return null;
  const shown = Number.isNaN(runs) ? 'a non-numeric value' : String(runs);
  return `--runs must be a positive integer, got ${shown}`;
}

const invalidRuns = invalidRunsMessage(options.runs);
if (invalidRuns) {
  console.error(`bench-fallback-scoring: ${invalidRuns}`);
  console.error('No fixture was created. Pass --runs <positive integer>, for example --runs 5.');
  process.exit(1);
}

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'qmd-bench-'));
const root = path.join(workdir, 'fixture');
fs.mkdirSync(root, { recursive: true });
const fixture = buildFixture(root, options);

// Count bytes read through node:fs (both readFileSync and open/readSync paths) so
// the measurement reflects the I/O the scoring path really performs instead of an
// estimate from the fixture size.
let bytesRead = 0;
const realReadFileSync = fs.readFileSync;
const realReadSync = fs.readSync;
fs.readFileSync = function instrumentedReadFileSync(...args) {
  const data = realReadFileSync.apply(this, args);
  bytesRead += typeof data === 'string' ? Buffer.byteLength(data) : (data?.byteLength || 0);
  return data;
};
fs.readSync = function instrumentedReadSync(...args) {
  const read = realReadSync.apply(this, args);
  bytesRead += typeof read === 'number' ? read : 0;
  return read;
};

const { walkFiles, scoreFile } = await import(pathToFileURL(path.join(repoRoot, 'dist', 'src', 'search.js')).href);
const config = { fileGlobs: ['**/*.md'], excludeGlobs: [] };
const terms = options.terms.split(',').map((term) => term.trim()).filter(Boolean);

function measuredPass() {
  const discovered = walkFiles(root, config);
  bytesRead = 0;
  const matched = [];
  for (const rel of discovered) {
    const result = scoreFile(root, rel, terms, [], 'auto', []);
    if (result.score > 0) matched.push(rel);
  }
  return { files: discovered.length, matched, bytesRead };
}

measuredPass();
const samples = [];
let last;
for (let run = 0; run < options.runs; run += 1) {
  const started = process.hrtime.bigint();
  last = measuredPass();
  samples.push(Number(process.hrtime.bigint() - started) / 1e6);
}
samples.sort((a, b) => a - b);
const median = samples[Math.floor(samples.length / 2)];

console.log(JSON.stringify({
  fixture: {
    files: options.files,
    sizeRangeKb: [options.fileKb, options.fileKbMax],
    tailFiles: options.tailRatio > 0 ? Math.round(options.files * options.tailRatio) : 0,
    tailSizeKb: options.tailRatio > 0 ? options.tailKb : null,
    totalMiB: Number((fixture.totalBytes / 1024 / 1024).toFixed(1)),
    earlyMatchFiles: fixture.counts.earlyMatch,
    lateMatchFiles: fixture.counts.lateMatch
  },
  runs: options.runs,
  walkAndScoreMs: samples.map((value) => Number(value.toFixed(1))),
  medianMs: Number(median.toFixed(1)),
  matchedFiles: last.matched.length,
  contentBytesRead: last.bytesRead,
  contentBytesReadMiB: Number((last.bytesRead / 1024 / 1024).toFixed(1)),
  matchedSample: last.matched.slice(0, 5)
}, null, 2));

fs.rmSync(workdir, { recursive: true, force: true });
