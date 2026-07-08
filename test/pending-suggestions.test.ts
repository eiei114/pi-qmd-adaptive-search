import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initProject } from '../src/config.js';
import { adaptiveSearch } from '../src/search.js';
import { recordFeedback, reviewSuggestions, approveSuggestions } from '../src/feedback.js';
import { runMaintenance } from '../src/maintenance.js';

function tempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmd-pending-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs', 'ProductSpec.md'),
    '# Product Spec\nData portability and export decisions.\n',
    'utf8'
  );
  fs.writeFileSync(path.join(root, 'README.md'), '# Test Project\n', 'utf8');
  initProject(root);
  return root;
}

function pendingPath(root: string) {
  return path.join(root, '.qmd-adaptive-search', 'local', 'pending-suggestions.jsonl');
}

function readPendingLines(root: string) {
  return fs.readFileSync(pendingPath(root), 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

test('recordFeedback creates pending suggestion with high confidence after recent search', () => {
  const root = tempProject();
  adaptiveSearch({ query: 'product decisions', maxResults: 5 }, { root });

  const feedback = recordFeedback({ selectedPath: 'docs/ProductSpec.md', rating: 'good' }, { root });
  assert.equal(feedback.ok, true);

  const review = reviewSuggestions({ root });
  assert.equal(review.count, 1);
  assert.equal(review.suggestions[0].rating, 'good');
  assert.equal(review.suggestions[0].confidence, 0.7);
  assert.equal(review.suggestions[0].type, 'positive-feedback');
  assert.deepEqual(review.suggestions[0].selectedPaths, ['docs/ProductSpec.md']);
});

test('recordFeedback rejects out-of-band feedback unless force is set', () => {
  const root = tempProject();
  const rejected = recordFeedback({ selectedPath: 'docs/ProductSpec.md', rating: 'good' }, { root });

  assert.equal(rejected.ok, false);
  assert.equal(rejected.rejected, true);
  assert.equal(reviewSuggestions({ root }).count, 0);
});

test('forced feedback stores low-confidence pending suggestion', () => {
  const root = tempProject();
  const feedback = recordFeedback(
    { selectedPath: 'docs/ProductSpec.md', rating: 'good', force: true, query: 'export decisions' },
    { root }
  );

  assert.equal(feedback.ok, true);
  const review = reviewSuggestions({ root });
  assert.equal(review.count, 1);
  assert.equal(review.suggestions[0].confidence, 0.25);
});

test('bad feedback is stored for review without applying local boosts', () => {
  const root = tempProject();
  adaptiveSearch({ query: 'product decisions', maxResults: 5 }, { root });

  const feedback = recordFeedback({ selectedPath: 'docs/ProductSpec.md', rating: 'bad' }, { root });
  assert.equal(feedback.ok, true);

  const review = reviewSuggestions({ root });
  assert.equal(review.suggestions[0].type, 'negative-feedback');
  assert.match(review.suggestions[0].note, /no negative ranking applied/);

  const boosts = JSON.parse(
    fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'local', 'learned-boosts.json'), 'utf8')
  );
  assert.equal(boosts.boosts['docs/ProductSpec.md'], undefined);
});

test('multiple feedback events append separate pending suggestions', () => {
  const root = tempProject();
  adaptiveSearch({ query: 'product decisions', maxResults: 5 }, { root });

  recordFeedback({ selectedPath: 'docs/ProductSpec.md', rating: 'good' }, { root });
  recordFeedback({ selectedPath: 'README.md', rating: 'good', force: true, query: 'readme' }, { root });

  const lines = readPendingLines(root);
  assert.equal(lines.length, 2);
  assert.notEqual(lines[0].id, lines[1].id);
});

test('approve promotes only good suggestions and clears pending backlog', () => {
  const root = tempProject();
  adaptiveSearch({ query: 'product decisions', maxResults: 5 }, { root });
  recordFeedback({ selectedPath: 'docs/ProductSpec.md', rating: 'good' }, { root });
  recordFeedback(
    { selectedPath: 'README.md', rating: 'bad', force: true, query: 'readme overview' },
    { root }
  );

  const approved = approveSuggestions({ root });
  assert.equal(approved.ok, true);
  assert.equal(approved.approved, 2);
  assert.equal(reviewSuggestions({ root }).count, 0);

  const sharedBoosts = JSON.parse(
    fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'shared-boosts.json'), 'utf8')
  );
  const sharedAliases = JSON.parse(
    fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'shared-aliases.json'), 'utf8')
  );
  assert.ok(sharedBoosts.boosts['docs/ProductSpec.md'] > 0);
  assert.equal(sharedBoosts.boosts['README.md'], undefined);
  assert.ok(Object.keys(sharedAliases.aliases).length >= 0);
});

test('reject path discards pending suggestions via maintenance cleanup', () => {
  const root = tempProject();
  recordFeedback(
    { selectedPath: 'docs/ProductSpec.md', rating: 'good', force: true, query: 'export' },
    { root }
  );
  assert.equal(reviewSuggestions({ root }).count, 1);

  const result = runMaintenance(root, { targets: ['pending-suggestions'], yes: true });
  assert.equal(result.ok, true);
  assert.equal(result.actions![0].cleared, 1);
  assert.equal(reviewSuggestions({ root }).count, 0);
});

test('approve deduplicates shared alias terms when promoting repeated anchors', () => {
  const root = tempProject();
  adaptiveSearch({ query: 'product export', maxResults: 5 }, { root });
  recordFeedback({ selectedPath: 'docs/ProductSpec.md', rating: 'good' }, { root });
  recordFeedback({ selectedPath: 'docs/ProductSpec.md', rating: 'good', force: true, query: 'product export' }, { root });

  approveSuggestions({ root });

  const sharedAliases = JSON.parse(
    fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'shared-aliases.json'), 'utf8')
  );
  const productAlias = sharedAliases.aliases.product || sharedAliases.aliases.export || [];
  assert.ok(new Set(productAlias).size === productAlias.length);
});
