export interface AdaptiveSearchResultItem {
  path: string;
  title: string;
  score: number;
  source: string[];
  why?: ReadonlyArray<string | unknown>;
  lead?: string;
  highlights?: string[];
}

export interface AdaptiveSearchResult {
  results: AdaptiveSearchResultItem[];
  warnings?: string[];
  backgroundJobs?: unknown[];
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

export function compactSearchDetails(value: AdaptiveSearchResult): CompactSearchDetails {
  const results = (value.results || []).map((result) => ({
    path: result.path,
    title: result.title,
    score: result.score,
    source: result.source || [],
    why: normalizeWhy(result.why)
  }));

  return {
    resultCount: results.length,
    resultPaths: results.map((result) => result.path),
    warnings: value.warnings || [],
    results
  };
}

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

  return lines.join('\n');
}

export function formatAdaptiveSearchToolResult(value: AdaptiveSearchResult) {
  return {
    content: [{ type: 'text', text: formatCompactSearchText(value) }],
    details: compactSearchDetails(value)
  };
}
