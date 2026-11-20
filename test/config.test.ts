import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyPreset, initProject, loadConfig } from '../src/config.js';
import { DEFAULT_CONFIG } from '../src/defaults.js';

function tempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmd-config-'));
  initProject(root);
  return root;
}

function configPath(root: string) {
  return path.join(root, '.qmd-adaptive-search', 'config.json');
}

test('applyPreset dry-run returns a proposal without changing config bytes', () => {
  const root = tempProject();
  try {
    const customized = loadConfig(root);
    customized.search.defaultMaxResults = 23;
    customized.indexing.update.auto = true;
    customized.changeDetection.manifestEnabled = true;
    fs.writeFileSync(configPath(root), JSON.stringify(customized, null, 2), 'utf8');
    const beforeBytes = fs.readFileSync(configPath(root));

    const result = applyPreset(root, 'privacy', { dryRun: true });

    assert.equal(result.preset, 'privacy');
    assert.deepEqual(result.before, customized);
    assert.equal(result.after.search.defaultMaxResults, 23);
    assert.equal(result.after.indexing.update.auto, false);
    assert.equal(result.after.changeDetection.manifestEnabled, false);
    assert.deepEqual(fs.readFileSync(configPath(root)), beforeBytes);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('applyPreset reset restores customized unspecified values to defaults', () => {
  const root = tempProject();
  try {
    const customized = loadConfig(root);
    customized.qmdCommand = 'custom-qmd';
    customized.collectionRoots = { notes: '/custom/notes' };
    customized.search.defaultMaxResults = 23;
    customized.indexing.embed.auto = false;
    customized.changeDetection.manifestEnabled = false;
    customized.learning.sharedScope = 'local';
    fs.writeFileSync(configPath(root), JSON.stringify(customized, null, 2), 'utf8');

    const result = applyPreset(root, 'code', { reset: true });
    const persisted = JSON.parse(fs.readFileSync(configPath(root), 'utf8'));

    assert.equal(result.reset, true);
    assert.equal(result.before.qmdCommand, 'custom-qmd');
    assert.deepEqual(result.before.collectionRoots, { notes: '/custom/notes' });
    assert.equal(result.after.qmdCommand, DEFAULT_CONFIG.qmdCommand);
    assert.deepEqual(result.after.collectionRoots, DEFAULT_CONFIG.collectionRoots);
    assert.equal(result.after.search.defaultMaxResults, DEFAULT_CONFIG.search.defaultMaxResults);
    assert.equal(result.after.search.defaultModeBias, 'precision');
    assert.equal(result.after.indexing.embed.auto, DEFAULT_CONFIG.indexing.embed.auto);
    assert.equal(result.after.indexing.embed.confirmWhenPendingOver, 100);
    assert.equal(result.after.changeDetection.manifestEnabled, DEFAULT_CONFIG.changeDetection.manifestEnabled);
    assert.equal(result.after.learning.sharedScope, DEFAULT_CONFIG.learning.sharedScope);
    assert.deepEqual(persisted, result.after);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
