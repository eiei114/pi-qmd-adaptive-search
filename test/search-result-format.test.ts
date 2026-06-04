import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compactSearchDetails,
  formatAdaptiveSearchToolResult,
  formatCompactSearchText
} from '../src/search-result-format.js';

const sampleResult = {
  results: [
    {
      path: 'docs/ProductSpec.md',
      title: 'ProductSpec',
      score: 0.45,
      source: ['filename', 'path'],
      why: ['matched alias: product', 'scope boost: docs'],
      lead: 'Workout product decisions.',
      highlights: ['Workout product decisions.']
    },
    {
      path: 'README.md',
      title: 'README',
      score: 0.12,
      source: ['path'],
      why: ['scope boost: docs'],
      lead: 'Project overview.',
      highlights: ['Project overview.']
    }
  ],
  warnings: ['qmd was not found; using fallback search only.'],
  backgroundJobStatus: {
    pendingCount: 0,
    failedCount: 0,
    running: false,
    lastSearchStatus: 'skipped',
    qmdFallbackUsed: true,
    qmdAvailable: false
  }
};

test('formatCompactSearchText is path-first and excludes snippets', () => {
  const text = formatCompactSearchText(sampleResult);

  assert.match(text, /^qmd_adaptive_search: 2 result\(s\)/);
  assert.match(text, /1\. docs\/ProductSpec\.md/);
  assert.match(text, /title: ProductSpec \| score: 0\.45 \| source: filename, path/);
  assert.match(text, /why: matched alias: product; scope boost: docs/);
  assert.match(text, /Warnings:/);
  assert.match(text, /qmd was not found/);
  assert.doesNotMatch(text, /Workout product decisions/);
  assert.doesNotMatch(text, /Project overview/);
});

test('compactSearchDetails keeps result paths without snippet duplication', () => {
  const details = compactSearchDetails(sampleResult);

  assert.equal(details.resultCount, 2);
  assert.deepEqual(details.resultPaths, ['docs/ProductSpec.md', 'README.md']);
  assert.deepEqual(details.warnings, sampleResult.warnings);
  assert.equal(details.results.length, 2);
  assert.equal(details.results[0].path, 'docs/ProductSpec.md');
  assert.equal(Object.hasOwn(details.results[0], 'lead'), false);
  assert.equal(Object.hasOwn(details.results[0], 'highlights'), false);
  assert.equal(Object.hasOwn(details, 'backgroundJobs'), false);
  assert.deepEqual(details.backgroundJobStatus, sampleResult.backgroundJobStatus);
});

test('formatAdaptiveSearchToolResult returns compact text and lightweight details', () => {
  const toolResult = formatAdaptiveSearchToolResult(sampleResult);

  assert.equal(toolResult.content.length, 1);
  assert.equal(toolResult.content[0].type, 'text');
  assert.match(toolResult.content[0].text, /docs\/ProductSpec\.md/);
  assert.deepEqual(toolResult.details.resultPaths, ['docs/ProductSpec.md', 'README.md']);
  assert.equal(typeof toolResult.details.resultCount, 'number');
});

test('formatCompactSearchText handles empty results', () => {
  const text = formatCompactSearchText({ results: [], warnings: [] });

  assert.match(text, /0 result\(s\)/);
  assert.match(text, /No matching files found\./);
});

test('formatCompactSearchText summarizes non-trivial background job status', () => {
  const text = formatCompactSearchText(sampleResult);

  assert.match(text, /Background jobs: qmd fallback used/);
  assert.match(text, /qmd_adaptive_status for details/);
});

test('formatCompactSearchText does not show background jobs for pending count only', () => {
  const text = formatCompactSearchText({
    results: [],
    warnings: [],
    backgroundJobStatus: {
      pendingCount: 2,
      failedCount: 0,
      running: true,
      lastSearchStatus: null,
      qmdFallbackUsed: false,
      qmdAvailable: null
    }
  });

  assert.doesNotMatch(text, /Background jobs:/);
});

test('formatCompactSearchText includes pending count when failure or fallback status is shown', () => {
  const text = formatCompactSearchText({
    results: [],
    warnings: [],
    backgroundJobStatus: {
      pendingCount: 2,
      failedCount: 1,
      running: true,
      lastSearchStatus: 'failed',
      qmdFallbackUsed: false,
      qmdAvailable: true
    }
  });

  assert.match(text, /Background jobs: 2 pending, 1 failed/);
});

test('formatAdaptiveSearchToolResult excludes verbose background job arrays from details', () => {
  const toolResult = formatAdaptiveSearchToolResult(sampleResult);

  assert.equal(Object.hasOwn(toolResult.details, 'backgroundJobs'), false);
  assert.equal(toolResult.details.backgroundJobStatus?.lastSearchStatus, 'skipped');
});
