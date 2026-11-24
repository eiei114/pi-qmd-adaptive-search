import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { paths } from '../src/config.js';
import { backgroundJobStatusSummary, finishBackgroundJob, startBackgroundJob } from '../src/job-state.js';

test('backgroundJobStatusSummary counts current running job only once', () => {
  const currentJob = { id: 'running-job', type: 'qmd-search', status: 'running' };
  const queuedJob = { id: 'queued-job', type: 'qmd-update', status: 'running' };

  const summary = backgroundJobStatusSummary({
    currentJob,
    pendingJobs: [currentJob, queuedJob],
    failedJobs: [],
    lastSearchJob: null
  });

  assert.equal(summary.running, true);
  assert.equal(summary.pendingCount, 2);
});

test('backgroundJobStatusSummary counts duplicate older jobs once', () => {
  const older = { id: 'older', status: 'running' };
  const currentJob = { id: 'newest', status: 'running' };
  assert.deepEqual(backgroundJobStatusSummary({
    currentJob,
    pendingJobs: [older, currentJob, older]
  }), {
    pendingCount: 2,
    failedCount: 0,
    running: true,
    lastSearchStatus: null,
    qmdFallbackUsed: false,
    qmdAvailable: null
  });
});

test('overlapping jobs stay unique when the oldest finishes first', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmd-job-state-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const readPersistedState = () => JSON.parse(fs.readFileSync(paths(root).jobState, 'utf8'));
  const oldest = startBackgroundJob(root, { type: 'qmd-search' });
  const middle = startBackgroundJob(root, { type: 'qmd-update' });
  const newest = startBackgroundJob(root, { type: 'qmd-embed' });

  const started = readPersistedState();
  assert.deepEqual(started.pendingJobs.map((job) => job.id).sort(), [oldest.id, middle.id, newest.id].sort());
  assert.ok(started.pendingJobs.every((job) => job.status === 'running'));
  assert.equal(backgroundJobStatusSummary(started).pendingCount, 3);

  finishBackgroundJob(root, oldest, { status: 'completed' });

  const finished = readPersistedState();
  assert.deepEqual(finished.pendingJobs.map((job) => job.id).sort(), [middle.id, newest.id].sort());
  assert.deepEqual(finished.currentJob, newest);
  assert.equal(backgroundJobStatusSummary(finished).pendingCount, 2);
});
