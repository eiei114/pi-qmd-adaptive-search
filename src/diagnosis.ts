import { paths, loadConfig } from './config.js';
import { detectQmd, runCommand } from './qmd.js';
import { readJson, readJsonLines } from './fs-utils.js';
import { readJobState } from './job-state.js';

/**
 * Tokens that carry little semantic value when used as learned aliases.
 * If many of these dominate the learned alias store, ranking drifts toward
 * generic matches and search quality degrades.
 */
const GENERIC_TOKENS: ReadonlySet<string> = new Set([
  'content', 'templates', 'single', 'post', 'data', 'index', 'main',
  'file', 'new', 'old', 'test', 'copy', 'backup', 'temp', 'tmp',
  'draft', 'note', 'doc', 'docs', 'readme', 'src', 'lib', 'util',
  'utils', 'helper', 'helpers', 'common', 'shared', 'config',
  'setup', 'item', 'items', 'list', 'page', 'section', 'part',
  'update', 'add', 'remove', 'change', 'log', 'info'
]);

/* ── Thresholds ─────────────────────────────────────────────────── */

const ALIAS_WARN = 30;
const ALIAS_CRIT = 60;
const BOOST_WARN = 30;
const BOOST_CRIT = 50;
const SUGGESTION_WARN = 10;
const SUGGESTION_CRIT = 20;
const GENERIC_RATIO_WARN = 0.2;
const GENERIC_RATIO_CRIT = 0.4;
const RUNAWAY_BOOST_THRESHOLD = 0.5;
const CONSECUTIVE_FAILURE_WARN = 1;
const CONSECUTIVE_FAILURE_CRIT = 3;
const EMBED_DEBT_PERCENT_WARN = 20;
const EMBED_DEBT_PERCENT_CRIT = 50;
const EMBED_DEBT_ABS_WARN = 100;

/* ── Helpers ────────────────────────────────────────────────────── */

function classifySeverity(value: number, warn: number, crit: number): Severity {
  if (value >= crit) return 'critical';
  if (value >= warn) return 'warning';
  return 'ok';
}

type Severity = 'ok' | 'warning' | 'critical';

export interface DiagnosisBucket {
  name: string;
  severity: Severity;
  message: string;
  recoveryAction: string | null;
  details: Record<string, unknown>;
}

export interface DiagnosisSummary {
  health: Severity;
  buckets: DiagnosisBucket[];
}

/* ── Bucket analysers ───────────────────────────────────────────── */

function analyzeLearnedAliases(root: string): DiagnosisBucket {
  const p = paths(root);
  const store = readJson(p.learnedAliases, { aliases: {} });
  const aliases: Record<string, unknown> = store.aliases || {};
  const keys = Object.keys(aliases);
  const count = keys.length;
  const genericKeys = keys.filter((key) => GENERIC_TOKENS.has(key.toLowerCase()));
  const genericRatio = count > 0 ? genericKeys.length / count : 0;

  let severity: Severity;
  if (genericRatio >= GENERIC_RATIO_CRIT && count >= ALIAS_WARN) {
    severity = 'critical';
  } else if (genericRatio >= GENERIC_RATIO_WARN && count >= ALIAS_WARN / 2) {
    severity = 'warning';
  } else {
    severity = classifySeverity(count, ALIAS_WARN, ALIAS_CRIT);
  }

  let message = `${count} learned alias(es).`;
  let recoveryAction: string | null = null;

  if (genericKeys.length > 0) {
    const sample = genericKeys.slice(0, 5).join(', ');
    message += ` ${genericKeys.length} generic alias(es) detected (${sample}${genericKeys.length > 5 ? ' …' : ''}).`;
  }

  if (severity === 'critical') {
    message += ' Learned aliases are heavily polluted with generic terms that degrade search ranking.';
    recoveryAction = 'Review and prune generic learned aliases: edit .qmd-adaptive-search/local/learned-aliases.json to remove low-information entries, or delete the file to reset all learned aliases.';
  } else if (severity === 'warning') {
    message += ' Some generic aliases may be reducing search quality.';
    recoveryAction = 'Consider reviewing learned aliases for generic terms: run qmd-adaptive-search status and inspect aliases.learned. Prune via .qmd-adaptive-search/local/learned-aliases.json.';
  }

  return {
    name: 'learned-alias-pollution',
    severity,
    message,
    recoveryAction,
    details: { count, genericCount: genericKeys.length, genericRatio: Math.round(genericRatio * 100) / 100 }
  };
}

function analyzeLearnedBoosts(root: string): DiagnosisBucket {
  const p = paths(root);
  const store = readJson(p.learnedBoosts, { boosts: {} });
  const boosts: Record<string, number> = store.boosts || {};
  const entries = Object.entries(boosts);
  const count = entries.length;
  const runaway = entries.filter(([, value]) => Math.abs(Number(value)) >= RUNAWAY_BOOST_THRESHOLD);

  const severity: Severity = runaway.length > 0
    ? 'critical'
    : classifySeverity(count, BOOST_WARN, BOOST_CRIT);

  let message = `${count} learned boost(s).`;
  let recoveryAction: string | null = null;

  if (runaway.length > 0) {
    const sample = runaway.slice(0, 3).map(([k]) => k).join(', ');
    message += ` ${runaway.length} runaway boost(s) (|value| >= ${RUNAWAY_BOOST_THRESHOLD}): ${sample}${runaway.length > 3 ? ' …' : ''}.`;
    recoveryAction = 'Review and cap runaway learned boosts: edit .qmd-adaptive-search/local/learned-boosts.json to reduce or remove high-magnitude entries, or delete the file to reset all learned boosts.';
  } else if (severity === 'warning') {
    message += ' Boost count is high; some entries may no longer be relevant.';
    recoveryAction = 'Consider reviewing learned boosts for stale entries: inspect .qmd-adaptive-search/local/learned-boosts.json.';
  }

  return {
    name: 'learned-boost-pollution',
    severity,
    message,
    recoveryAction,
    details: { count, runawayCount: runaway.length }
  };
}

function analyzePendingSuggestions(root: string): DiagnosisBucket {
  const p = paths(root);
  const count = readJsonLines(p.pendingSuggestions).length;
  const severity = classifySeverity(count, SUGGESTION_WARN, SUGGESTION_CRIT);

  let message = `${count} pending suggestion(s).`;
  let recoveryAction: string | null = null;

  if (severity === 'critical') {
    message += ' Large backlog of unreviewed suggestions may delay ranking improvements.';
    recoveryAction = 'Review and approve or reject pending suggestions: run qmd-adaptive-search review, then qmd-adaptive-search review --approve to promote good suggestions.';
  } else if (severity === 'warning') {
    message += ' Some suggestions are waiting for review.';
    recoveryAction = 'Consider reviewing pending suggestions: run qmd-adaptive-search review.';
  }

  return {
    name: 'pending-suggestion-backlog',
    severity,
    message,
    recoveryAction,
    details: { count }
  };
}

function analyzeEmbedDebt(root: string, config: any, qmd: any): DiagnosisBucket {
  if (!qmd.available) {
    return {
      name: 'missing-embeddings',
      severity: 'ok',
      message: 'qmd is not available; embed debt cannot be assessed.',
      recoveryAction: 'Install qmd to enable embedding-based search: run qmd-adaptive-search install-qmd.',
      details: { available: false }
    };
  }

  // Try to get embed debt from qmd status output
  const statusResult = runCommand(qmd.command, ['status'], { cwd: root, timeoutMs: 10000 });
  const statusText = (statusResult.stdout || '') + (statusResult.stderr || '');

  // Common patterns from qmd status:
  //   "792 documents (68%) need embeddings"
  //   "792 docs (68%) need embeddings"
  const needsEmbedMatch = statusText.match(/(\d+)\s+(?:documents?|docs?|chunks?)\s*\((\d+)%\)\s*(?:need|needs?|missing)\s*embeddings?/i);
  const bareNeedsMatch = statusText.match(/(\d+)\s+(?:documents?|docs?|chunks?)\s*(?:need|needs?|missing)\s*embeddings?/i);

  let needsEmbeddings: number | null = null;
  let embedDebtPercent: number | null = null;

  if (needsEmbedMatch) {
    needsEmbeddings = Number(needsEmbedMatch[1]);
    embedDebtPercent = Number(needsEmbedMatch[2]);
  } else if (bareNeedsMatch) {
    needsEmbeddings = Number(bareNeedsMatch[1]);
  }

  let severity: Severity = 'ok';
  let message = 'qmd is available.';
  let recoveryAction: string | null = null;

  if (needsEmbeddings !== null && embedDebtPercent !== null) {
    severity = classifySeverity(embedDebtPercent, EMBED_DEBT_PERCENT_WARN, EMBED_DEBT_PERCENT_CRIT);
    if (severity === 'critical') {
      message = `${needsEmbeddings} documents (${embedDebtPercent}%) need embeddings.`;
      recoveryAction = 'Run embeddings to reduce embed debt: qmd-adaptive-search qmd embed --dry-run, then qmd-adaptive-search qmd embed --yes.';
    } else if (severity === 'warning') {
      message = `${needsEmbeddings} documents (${embedDebtPercent}%) need embeddings.`;
      recoveryAction = 'Consider running embeddings for better search quality: qmd-adaptive-search qmd embed --dry-run.';
    } else {
      message = `Embed debt is low: ${needsEmbeddings} documents (${embedDebtPercent}%) need embeddings.`;
    }
  } else if (needsEmbeddings !== null) {
    severity = classifySeverity(needsEmbeddings, EMBED_DEBT_ABS_WARN, EMBED_DEBT_ABS_WARN * 3);
    if (severity !== 'ok') {
      message = `${needsEmbeddings} documents need embeddings.`;
      recoveryAction = 'Consider running embeddings: qmd-adaptive-search qmd embed --dry-run.';
    } else {
      message = `${needsEmbeddings} documents need embeddings.`;
    }
  } else {
    message = 'qmd is available but embed debt could not be parsed from qmd status output.';
    recoveryAction = 'Run qmd status to check embedding status manually.';
  }

  return {
    name: 'missing-embeddings',
    severity,
    message,
    recoveryAction,
    details: { available: true, needsEmbeddings, embedDebtPercent }
  };
}

function analyzeSearchHistory(root: string): DiagnosisBucket {
  const jobState = readJobState(root);
  const recentJobs = jobState.recentJobs || [];

  // Count consecutive fallback/failure in search-type jobs from most recent backward
  let consecutiveFallbackOrFailure = 0;
  for (const job of recentJobs) {
    if (['qmd-search', 'qmd-query'].includes(job.type)) {
      if (job.status === 'failed' || (job.result && job.result.usedFallback === true)) {
        consecutiveFallbackOrFailure++;
      } else {
        break;
      }
    }
  }

  const lastCompleted = recentJobs.find((job) =>
    ['qmd-search', 'qmd-query'].includes(job.type) && job.status === 'completed'
  );

  const failedSearchJobs = recentJobs.filter((job) =>
    ['qmd-search', 'qmd-query'].includes(job.type) && job.status === 'failed'
  );

  const staleHistory = recentJobs.length > 0 && !lastCompleted;

  let severity: Severity = 'ok';
  let message = 'Search history looks healthy.';
  let recoveryAction: string | null = null;

  if (consecutiveFallbackOrFailure >= CONSECUTIVE_FAILURE_CRIT) {
    severity = 'critical';
    message = `${consecutiveFallbackOrFailure} consecutive search failure(s) or fallback(s). Search quality is likely degraded.`;
    recoveryAction = 'Check qmd availability and index health: run qmd-adaptive-search status and qmd status. If qmd is broken, fix qmd before relying on search results.';
  } else if (consecutiveFallbackOrFailure >= CONSECUTIVE_FAILURE_WARN) {
    severity = 'warning';
    message = `${consecutiveFallbackOrFailure} recent search failure(s) or fallback(s). Some results may be fallback-only.`;
    recoveryAction = 'Monitor search quality. If results seem off, check qmd status and qmd-adaptive-search status.';
  }

  if (staleHistory && failedSearchJobs.length > 0) {
    if (severity === 'ok') severity = 'warning';
    message = 'No completed searches in recent history; all recent searches failed or used fallback.';
    recoveryAction = 'Check qmd availability: run qmd status.';
  }

  return {
    name: 'search-history',
    severity,
    message,
    recoveryAction,
    details: {
      consecutiveFallbackOrFailure,
      lastCompletedAt: lastCompleted?.finishedAt || null,
      staleHistory
    }
  };
}

/* ── Public API ─────────────────────────────────────────────────── */

/**
 * Run a diagnosis pass on the learned state, embed debt, and search history.
 * Returns a compact summary suitable for the status flow and maintainer review.
 *
 * @param root Project root directory
 * @param config Optional pre-loaded config (avoided re-read if caller already has it)
 * @param qmd   Optional pre-detected qmd info (avoided re-detect if caller already has it)
 */
function diagnoseSearchQuality(root: string, config?: any, qmd?: any): DiagnosisSummary {
  const effectiveConfig = config || loadConfig(root);
  const effectiveQmd = qmd || detectQmd(effectiveConfig, root);

  const aliasBucket = analyzeLearnedAliases(root);
  const boostBucket = analyzeLearnedBoosts(root);
  const suggestionBucket = analyzePendingSuggestions(root);
  const embedBucket = analyzeEmbedDebt(root, effectiveConfig, effectiveQmd);
  const searchHistoryBucket = analyzeSearchHistory(root);

  const buckets = [aliasBucket, boostBucket, suggestionBucket, embedBucket, searchHistoryBucket];

  const severities: Severity[] = buckets.map((b) => b.severity);
  const health: Severity = severities.includes('critical')
    ? 'critical'
    : severities.includes('warning')
      ? 'warning'
      : 'ok';

  return { health, buckets };
}

export { diagnoseSearchQuality, GENERIC_TOKENS };
