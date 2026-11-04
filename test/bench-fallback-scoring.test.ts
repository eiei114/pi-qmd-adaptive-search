import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const benchScript = path.join(repoRoot, 'scripts', 'bench-fallback-scoring.mjs');

function benchFixtures() {
  return new Set(
    fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('qmd-bench-'))
  );
}

function newFixtures(before: Set<string>) {
  return [...benchFixtures()].filter((name) => !before.has(name));
}

function runBench(args: string[]) {
  return spawnSync(process.execPath, [benchScript, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 120_000
  });
}

// A --runs value that cannot produce one sample used to reach the report with an empty
// `samples` array, throw on `median.toFixed(1)`, and skip the fixture cleanup that runs
// after the report. The guard must reject the value before any fixture exists.
test('bench-fallback-scoring rejects a non-positive --runs before creating a fixture', () => {
  const before = benchFixtures();
  for (const value of ['0', '-3', 'abc', '2.5']) {
    const result = runBench(['--runs', value, '--files', '2', '--file-kb', '1', '--file-kb-max', '1']);
    assert.equal(result.status, 1, `--runs ${value} should exit 1 (stderr: ${result.stderr})`);
    assert.match(result.stderr, /--runs must be a positive integer/);
    assert.match(result.stderr, /No fixture was created/);
    assert.equal(result.stdout, '');
    assert.doesNotMatch(result.stderr, /TypeError/);
    assert.deepEqual(newFixtures(before), [], `--runs ${value} leaked a temporary fixture`);
  }
});

test('bench-fallback-scoring still reports a median and cleans up its fixture', () => {
  const before = benchFixtures();
  const result = runBench(['--runs', '1', '--files', '2', '--file-kb', '1', '--file-kb-max', '1']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.runs, 1);
  assert.equal(report.walkAndScoreMs.length, 1);
  assert.equal(typeof report.medianMs, 'number');
  assert.equal(Number.isFinite(report.medianMs), true);
  assert.deepEqual(newFixtures(before), []);
});
