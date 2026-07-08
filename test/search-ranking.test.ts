import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initProject } from '../src/config.js';
import { inferMode, scoreFile, rrfFuseCandidates } from '../src/search.js';

function tempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmd-rank-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'archive'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'docs', 'ProductSpec.md'),
    '# Product Spec\nData portability and export decisions.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, 'docs', 'ArticleDraft.md'),
    '# Article Draft\nEssay notes about training.\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, 'archive', 'OldProductSpec.md'),
    '# Old Product Spec\nData portability archive copy.\n',
    'utf8'
  );
  fs.writeFileSync(path.join(root, 'src', 'helper.ts'), 'export const helper = true;\n', 'utf8');
  initProject(root);
  return root;
}

test('inferMode infers article, project, recall, and precision from query cues', () => {
  assert.equal(inferMode('draft essay note', 'auto'), 'article');
  assert.equal(inferMode('仕様 決定 ADR', 'auto'), 'project');
  assert.equal(inferMode('similar related docs', 'auto'), 'recall');
  assert.equal(inferMode('where is the file path', 'auto'), 'precision');
  assert.equal(inferMode('anything', 'project'), 'project');
});

test('scoreFile applies pathPrefix boost for scope hints', () => {
  const root = tempProject();
  const docs = scoreFile(root, 'docs/ProductSpec.md', ['product'], ['docs'], 'auto', []);
  const src = scoreFile(root, 'src/helper.ts', ['product'], ['docs'], 'auto', []);

  assert.ok(docs.score > src.score);
  assert.ok(docs.why.some((line) => line.includes('scope boost: docs')));
});

test('scoreFile applies archive penalty to archived paths', () => {
  const root = tempProject();
  const active = scoreFile(root, 'docs/ProductSpec.md', ['product'], [], 'auto', []);
  const archived = scoreFile(root, 'archive/OldProductSpec.md', ['product'], [], 'auto', []);

  assert.ok(archived.why.includes('archive penalty'));
  assert.ok(active.score > archived.score);
});

test('scoreFile applies mode adjustment for article and project modes', () => {
  const root = tempProject();
  const articleDoc = scoreFile(root, 'docs/ArticleDraft.md', ['article'], [], 'article', []);
  const articleSrc = scoreFile(root, 'src/helper.ts', ['article'], [], 'article', []);
  const projectDoc = scoreFile(root, 'docs/ProductSpec.md', ['product'], [], 'project', []);
  const projectSrc = scoreFile(root, 'src/helper.ts', ['product'], [], 'project', []);

  assert.ok(articleDoc.score > articleSrc.score);
  assert.ok(projectDoc.score > projectSrc.score);
});

test('scoreFile edge case keeps non-negative score after archive penalty', () => {
  const root = tempProject();
  const archived = scoreFile(root, 'archive/OldProductSpec.md', ['x'], [], 'auto', []);
  assert.ok(archived.score >= 0);
});

test('rrfFuseCandidates merges qmd and local scores then reranks by total', () => {
  const fused = rrfFuseCandidates(
    [
      { path: 'docs/ProductSpec.md', score: 0.75, source: ['qmd'], why: ['qmd search match'] },
      { path: 'docs/ArticleDraft.md', score: 0.75, source: ['qmd'], why: ['qmd search match'] }
    ],
    [
      { path: 'docs/ProductSpec.md', score: 0.34, source: ['filename', 'path'], why: [] },
      { path: 'docs/ArticleDraft.md', score: 0.1, source: ['filename'], why: [] }
    ],
    ['matched alias: product']
  );

  assert.equal(fused[0].path, 'docs/ProductSpec.md');
  assert.ok(fused[0].score > fused[1].score);
  assert.ok(fused[0].source.includes('qmd'));
  assert.ok(fused[0].source.includes('filename'));
  assert.ok(fused[0].why.includes('matched alias: product'));
});

test('rrfFuseCandidates keeps local-only matches and drops zero-score rows', () => {
  const fused = rrfFuseCandidates(
    [],
    [
      { path: 'docs/ProductSpec.md', score: 0.2, source: ['path'], why: [] },
      { path: 'src/helper.ts', score: 0, source: [], why: [] }
    ]
  );

  assert.equal(fused.length, 1);
  assert.equal(fused[0].path, 'docs/ProductSpec.md');
});

test('rrfFuseCandidates lets strong local scores outrank weaker qmd-only matches', () => {
  const fused = rrfFuseCandidates(
    [{ path: 'docs/ArticleDraft.md', score: 0.75, source: ['qmd'], why: [] }],
    [{ path: 'docs/ProductSpec.md', score: 0.8, source: ['filename', 'path'], why: [] }]
  );

  assert.equal(fused[0].path, 'docs/ProductSpec.md');
  assert.ok(fused[0].score > fused[1].score);
});
