export interface AdaptiveSearchResultItem {
  path: string;
  title: string;
  score: number;
  source: string[];
  why?: ReadonlyArray<string | unknown>;
  lead?: string;
  highlights?: string[];
}

export interface BackgroundJobStatusSummary {
  pendingCount: number;
  failedCount: number;
  running: boolean;
  lastSearchStatus: string | null;
  qmdFallbackUsed: boolean;
  qmdAvailable: boolean | null;
}

export interface AdaptiveSearchResult {
  results: AdaptiveSearchResultItem[];
  warnings?: string[];
  backgroundJobStatus?: BackgroundJobStatusSummary;
}

export interface CompactSearchResultItem {
  path: string;
  title: string;
  score: number;
  source: string[];
  why: string[];
}

export interface CompactSearchDetails {
  resultCount: number;
  resultPaths: string[];
  warnings: string[];
  results: CompactSearchResultItem[];
  backgroundJobStatus?: BackgroundJobStatusSummary;
}

function normalizeWhy(why: ReadonlyArray<string | unknown> = []): string[] {
  return why.map((entry) => String(entry)).filter(Boolean);
}

function summarizeWhy(why: ReadonlyArray<string | unknown> = [], maxLength = 120): string {
  const summary = normalizeWhy(why).join('; ');
  if (!summary) return '—';
  if (summary.length <= maxLength) return summary;
  return `${summary.slice(0, maxLength - 1)}…`;
}

function formatSource(source: string[] = []): string {
  return source.length ? source.join(', ') : 'fallback';
}

/** Summarize adaptive search hits into structured counts, paths, warnings, and per-result metadata. */
export function compactSearchDetails(value: AdaptiveSearchResult): CompactSearchDetails {
  const results = (value.results || []).map((result) => ({
    path: result.path,
    title: result.title,
    score: result.score,
    source: result.source || [],
    why: normalizeWhy(result.why)
  }));

  const details: CompactSearchDetails = {
    resultCount: results.length,
    resultPaths: results.map((result) => result.path),
    warnings: value.warnings || [],
    results
  };
  if (value.backgroundJobStatus) {
    details.backgroundJobStatus = value.backgroundJobStatus;
  }
  return details;
}

/** Render adaptive search results as a compact, path-first plain-text summary for tool output. */
export function formatCompactSearchText(value: AdaptiveSearchResult): string {
  const results = value.results || [];
  const lines = [`qmd_adaptive_search: ${results.length} result(s)`];

  if (results.length === 0) {
    lines.push('No matching files found.');
  } else {
    for (const [index, result] of results.entries()) {
      lines.push(
        `${index + 1}. ${result.path}`,
        `   title: ${result.title} | score: ${result.score} | source: ${formatSource(result.source)}`,
        `   why: ${summarizeWhy(result.why)}`
      );
    }
  }

  const warnings = value.warnings || [];
  if (warnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of warnings) {
      lines.push(`- ${String(warning).replace(/\s+/g, ' ').trim()}`);
    }
  }

  const jobStatus = value.backgroundJobStatus;
  if (jobStatus && (jobStatus.failedCount > 0 || jobStatus.qmdFallbackUsed)) {
    const parts = [];
    if (jobStatus.qmdFallbackUsed) parts.push('qmd fallback used');
    if (jobStatus.pendingCount > 0) parts.push(`${jobStatus.pendingCount} pending`);
    if (jobStatus.failedCount > 0) parts.push(`${jobStatus.failedCount} failed`);
    lines.push('', `Background jobs: ${parts.join(', ')} (use qmd_adaptive_status for details).`);
  }

  return lines.join('\n');
}

/** Build the Pi tool result payload with compact text content and structured search details. */
export function formatAdaptiveSearchToolResult(value: AdaptiveSearchResult) {
  return {
    content: [{ type: 'text', text: formatCompactSearchText(value) }],
    details: compactSearchDetails(value)
  };
}
