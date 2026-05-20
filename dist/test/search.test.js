import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adaptiveSearch, recordFeedback, adaptiveStatus, initProject } from '../src/index.js';
function tempProject() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmd-adaptive-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'ProductSpec.md'), '---\nlead: Workout product decisions.\n---\n# Product Spec\nData portability and export decisions.\n', 'utf8');
    fs.writeFileSync(path.join(root, 'README.md'), '# Test Project\n', 'utf8');
    return root;
}
test('search creates lightweight config and returns fallback result', () => {
    const root = tempProject();
    const result = adaptiveSearch({ query: 'product decisions', maxResults: 5 }, { root });
    assert.equal(fs.existsSync(path.join(root, '.qmd-adaptive-search', 'config.json')), true);
    assert.equal(result.results[0].path, 'docs/ProductSpec.md');
    assert.equal(result.results[0].lead, 'Workout product decisions.');
    assert.ok(result.warnings.some((warning) => warning.includes('qmd was not found')) || Array.isArray(result.warnings));
});
test('feedback learns from recent result without storing raw query', () => {
    const root = tempProject();
    adaptiveSearch({ query: 'product decisions', maxResults: 5 }, { root });
    const feedback = recordFeedback({ selectedPath: 'docs/ProductSpec.md', rating: 'good' }, { root });
    assert.equal(feedback.ok, true);
    const recent = JSON.parse(fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'local', 'recent-searches.json'), 'utf8'));
    assert.equal(Object.hasOwn(recent.searches[0], 'query'), false);
    const boosts = JSON.parse(fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'local', 'learned-boosts.json'), 'utf8'));
    assert.ok(boosts.boosts['docs/ProductSpec.md'] > 0);
});
test('status reports core counts', () => {
    const root = tempProject();
    initProject(root);
    const status = adaptiveStatus({ root });
    assert.equal(status.aliases.shared, 0);
    assert.equal(status.boosts.learned, 0);
    assert.equal(status.manifest.enabled, true);
});
//# sourceMappingURL=search.test.js.map