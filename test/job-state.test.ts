import test from 'node:test';
import assert from 'node:assert/strict';
import { backgroundJobStatusSummary } from '../src/job-state.js';

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
