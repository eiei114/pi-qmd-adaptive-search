import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adaptiveSearch, recordFeedback, adaptiveStatus, initProject, qmdOperationPlan, runQmdOperation } from '../src/index.js';
import { parseQmdSearchOutput } from '../src/qmd.js';
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
    assert.equal(typeof status.qmdNextOperation.command, 'string');
});
test('qmd setup plan shows target side effects and confirmation command', () => {
    const root = tempProject();
    const plan = qmdOperationPlan('setup', { name: 'docs', mask: '**/*.md' }, { root, qmd: { available: true, command: ['qmd'] } });
    assert.deepEqual(plan.command, ['qmd', 'collection', 'add', '.', '--name', 'docs', '--mask', '**/*.md']);
    assert.ok(plan.sideEffects.some((item) => item.includes('collection')));
    assert.equal(plan.dryRunCommand, 'qmd-adaptive-search qmd setup --dry-run');
    assert.equal(plan.confirmCommand, 'qmd-adaptive-search qmd setup --yes');
});
test('qmd operation dry run does not execute heavy command', () => {
    const root = tempProject();
    const result = runQmdOperation('embed', { dryRun: true }, { root, qmd: { available: true, command: ['definitely-must-not-run'] } });
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.deepEqual(result.plan.command, ['definitely-must-not-run', 'embed']);
});
test('confirmed qmd update records job state', () => {
    const root = tempProject();
    const fakeQmd = path.join(root, 'fake-qmd.cjs');
    fs.writeFileSync(fakeQmd, 'console.log(process.argv.slice(2).join(" "));\n', 'utf8');
    const result = runQmdOperation('update', { yes: true }, { root, qmd: { available: true, command: ['node', fakeQmd] } });
    assert.equal(result.ok, true);
    assert.match(result.stdout, /update/);
    const jobState = JSON.parse(fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'local', 'job-state.json'), 'utf8'));
    assert.equal(jobState.currentJob, null);
    assert.equal(jobState.lastUpdateJob.operation, 'update');
});
test('qmd URI paths resolve to local paths with underscores and spaces', () => {
    const root = tempProject();
    fs.mkdirSync(path.join(root, '4_Project', 'Roblox-Market-Research'), { recursive: true });
    fs.writeFileSync(path.join(root, '4_Project', 'Roblox-Market-Research', 'CONTEXT.md'), '# Roblox Market Research\n', 'utf8');
    fs.mkdirSync(path.join(root, '1_Fleeting'), { recursive: true });
    fs.writeFileSync(path.join(root, '1_Fleeting', 'Memo_0503.md'), '# Memo\n', 'utf8');
    const results = parseQmdSearchOutput([
        'qmd://obsidian-note/4-Project/Roblox-Market-Research/CONTEXT.md:3 #abc',
        'qmd://obsidian-note/1-Fleeting/Memo-0503.md:1 #def'
    ].join('\n'), root);
    assert.deepEqual(results.map((result) => result.path), [
        '4_Project/Roblox-Market-Research/CONTEXT.md',
        '1_Fleeting/Memo_0503.md'
    ]);
});
//# sourceMappingURL=search.test.js.map