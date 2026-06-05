import { randomUUID } from 'node:crypto';
import { paths } from './config.js';
import { readJson, writeJson } from './fs-utils.js';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'skipped']);
const MAX_FAILED_JOBS = 5;
const MAX_RECENT_JOBS = 10;

function emptyJobState() {
  return {
    currentJob: null,
    pendingJobs: [],
    failedJobs: [],
    recentJobs: [],
    lastJob: null,
    lastSetupJob: null,
    lastSearchJob: null,
    lastUpdateJob: null,
    lastEmbedJob: null,
    suppressions: {}
  };
}

function normalizeJobState(raw: any = {}) {
  const base = emptyJobState();
  return {
    ...base,
    ...raw,
    pendingJobs: Array.isArray(raw.pendingJobs) ? raw.pendingJobs : [],
    failedJobs: Array.isArray(raw.failedJobs) ? raw.failedJobs : [],
    recentJobs: Array.isArray(raw.recentJobs) ? raw.recentJobs : [],
    suppressions: raw.suppressions || {}
  };
}

function readJobState(root = process.cwd()) {
  return normalizeJobState(readJson(paths(root).jobState, emptyJobState()));
}

function writeJobState(root, state) {
  writeJson(paths(root).jobState, normalizeJobState(state));
}

function compactJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    type: job.type,
    operation: job.operation || job.input?.operation || null,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt || null,
    qmd: job.qmd || null,
    result: job.result || null,
    error: job.error || null,
    recoveryHint: job.recoveryHint || null
  };
}

function recoveryHintFor(job) {
  if (!job) return null;
  if (job.status === 'skipped') {
    return 'qmd is not available. Install qmd or set qmdCommand in .qmd-adaptive-search/config.json; fallback search remains safe.';
  }
  if (job.status === 'failed') {
    return 'Run qmd-adaptive-search status, qmd status, then qmd search "<query>" -n 5. If qmd is slow, increase search.qmdSearchTimeoutMs or search.qmdQueryTimeoutMs.';
  }
  if (job.status === 'running') {
    return 'A previous qmd operation may still be running or may have been interrupted. Retry the command; if this entry is stale, delete .qmd-adaptive-search/local/job-state.json.';
  }
  return null;
}

function startBackgroundJob(root, input: any = {}) {
  const state = readJobState(root);
  const now = new Date().toISOString();
  const job = {
    id: randomUUID(),
    type: input.type || 'qmd-search',
    status: 'running',
    startedAt: now,
    input: input.input || null,
    qmd: input.qmd || null,
    result: null,
    error: null,
    recoveryHint: recoveryHintFor({ status: 'running' })
  };

  const pendingJobs = [
    ...(state.currentJob && !TERMINAL_STATUSES.has(state.currentJob.status) ? [state.currentJob] : []),
    ...(state.pendingJobs || []).filter((pending) => pending.id !== job.id),
    job
  ];

  writeJobState(root, { ...state, currentJob: job, pendingJobs });
  return job;
}

function finishBackgroundJob(root, runningJob, patch: any = {}) {
  const state = readJobState(root);
  const finished = {
    ...runningJob,
    ...patch,
    finishedAt: patch.finishedAt || new Date().toISOString()
  };
  finished.recoveryHint = patch.recoveryHint || recoveryHintFor(finished);

  const pendingJobs = (state.pendingJobs || []).filter((job) => job.id !== runningJob.id);
  const failedJobs = finished.status === 'failed'
    ? [finished, ...(state.failedJobs || []).filter((job) => job.id !== finished.id)].slice(0, MAX_FAILED_JOBS)
    : (state.failedJobs || []);
  const recentJobs = [finished, ...(state.recentJobs || []).filter((job) => job.id !== finished.id)].slice(0, MAX_RECENT_JOBS);

  const next = {
    ...state,
    currentJob: state.currentJob?.id === runningJob.id ? null : state.currentJob,
    pendingJobs,
    failedJobs,
    recentJobs,
    lastJob: finished,
    lastSetupJob: finished.type === 'qmd-setup' ? finished : state.lastSetupJob,
    lastSearchJob: ['qmd-search', 'qmd-query'].includes(finished.type) ? finished : state.lastSearchJob,
    lastUpdateJob: finished.type === 'qmd-update' ? finished : state.lastUpdateJob,
    lastEmbedJob: finished.type === 'qmd-embed' ? finished : state.lastEmbedJob
  };
  writeJobState(root, next);
  return finished;
}

function startQmdSearchJob(root, input: any = {}) {
  return startBackgroundJob(root, { type: 'qmd-search', input });
}

function finishQmdSearchJob(root, runningJob, qmdResult: any = {}) {
  const detected = qmdResult.detected || {};
  const status = !detected.available ? 'skipped' : (qmdResult.error ? 'failed' : 'completed');
  const type = qmdResult.method === 'query' ? 'qmd-query' : 'qmd-search';
  const error = qmdResult.error ? String(qmdResult.error).slice(0, 500) : null;
  return finishBackgroundJob(root, runningJob, {
    type,
    status,
    qmd: {
      available: !!detected.available,
      command: detected.command || null,
      method: qmdResult.method || null
    },
    result: {
      ok: status === 'completed',
      resultCount: Array.isArray(qmdResult.results) ? qmdResult.results.length : 0,
      usedFallback: status !== 'completed'
    },
    error
  });
}

function uniqueJobs(jobs) {
  const seen = new Set();
  const out = [];
  for (const job of jobs.filter(Boolean)) {
    if (seen.has(job.id)) continue;
    seen.add(job.id);
    out.push(compactJob(job));
  }
  return out;
}

function backgroundJobStatusSummary(state) {
  const normalized = normalizeJobState(state);
  const currentJob = normalized.currentJob;
  const pendingJobs = (normalized.pendingJobs || []).filter((pending) => pending.id !== currentJob?.id);
  const running = currentJob?.status === 'running';
  const pendingCount = pendingJobs.length + (running ? 1 : 0);
  const failedCount = (normalized.failedJobs || []).length;
  const lastSearch = normalized.lastSearchJob;
  const lastSearchStatus = lastSearch?.status || null;

  return {
    pendingCount,
    failedCount,
    running,
    lastSearchStatus,
    qmdFallbackUsed: lastSearch?.result?.usedFallback === true,
    qmdAvailable: lastSearch?.qmd?.available ?? null
  };
}

function backgroundJobSummary(state) {
  const normalized = normalizeJobState(state);
  const recoveryHints = uniqueJobs([
    normalized.currentJob,
    ...(normalized.pendingJobs || []),
    normalized.lastJob,
    ...(normalized.failedJobs || [])
  ])
    .filter((job) => job.recoveryHint)
    .map((job) => ({ jobId: job.id, type: job.type, status: job.status, hint: job.recoveryHint }));

  return {
    currentJob: compactJob(normalized.currentJob),
    pending: (normalized.pendingJobs || []).map(compactJob),
    failed: (normalized.failedJobs || []).map(compactJob),
    recent: (normalized.recentJobs || []).map(compactJob),
    lastJob: compactJob(normalized.lastJob),
    lastSetupJob: compactJob(normalized.lastSetupJob),
    lastSearchJob: compactJob(normalized.lastSearchJob),
    lastUpdateJob: compactJob(normalized.lastUpdateJob),
    lastEmbedJob: compactJob(normalized.lastEmbedJob),
    recoveryHints
  };
}

export {
  emptyJobState,
  normalizeJobState,
  readJobState,
  writeJobState,
  startBackgroundJob,
  finishBackgroundJob,
  startQmdSearchJob,
  finishQmdSearchJob,
  backgroundJobStatusSummary,
  backgroundJobSummary
};
