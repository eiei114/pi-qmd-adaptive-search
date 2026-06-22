import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initProject } from '../src/config.js';
import { runCli } from '../src/cli.js';
import { countLearnedState, maintenancePlan, normalizeTargets, runMaintenance } from '../src/maintenance.js';
function tempProject() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmd-maint-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'README.md'), '# Test Project\n', 'utf8');
    initProject(root);
    return root;
}
function writeLearnedAliases(root, aliases) {
    const p = path.join(root, '.qmd-adaptive-search', 'local', 'learned-aliases.json');
    fs.writeFileSync(p, JSON.stringify({ aliases }, null, 2), 'utf8');
}
function writeLearnedBoosts(root, boosts) {
    const p = path.join(root, '.qmd-adaptive-search', 'local', 'learned-boosts.json');
    fs.writeFileSync(p, JSON.stringify({ boosts }, null, 2), 'utf8');
}
function writeSharedAliases(root, aliases) {
    const p = path.join(root, '.qmd-adaptive-search', 'shared-aliases.json');
    fs.writeFileSync(p, JSON.stringify({ aliases }, null, 2), 'utf8');
}
function writeSharedBoosts(root, boosts) {
    const p = path.join(root, '.qmd-adaptive-search', 'shared-boosts.json');
    fs.writeFileSync(p, JSON.stringify({ boosts }, null, 2), 'utf8');
}
function appendPendingSuggestion(root, count) {
    const p = path.join(root, '.qmd-adaptive-search', 'local', 'pending-suggestions.jsonl');
    for (let i = 0; i < count; i++) {
        fs.appendFileSync(p, JSON.stringify({ id: `sug-${i}`, rating: 'good', selectedPaths: ['README.md'], anchors: ['test'], confidence: 0.5 }) + '\n', 'utf8');
    }
}
test('normalizeTargets defaults to all local cleanup targets', () => {
    assert.deepEqual(normalizeTargets(undefined), ['learned-aliases', 'learned-boosts', 'pending-suggestions']);
    assert.deepEqual(normalizeTargets('all'), ['learned-aliases', 'learned-boosts', 'pending-suggestions']);
});
test('normalizeTargets rejects unknown targets', () => {
    assert.throws(() => normalizeTargets('shared-aliases'), /Unknown maintenance target/);
});
test('maintenance plan uses diagnosis bucket vocabulary', () => {
    const root = tempProject();
    writeLearnedAliases(root, { content: ['data'] });
    writeLearnedBoosts(root, { 'docs/a.md': 0.8 });
    appendPendingSuggestion(root, 3);
    const plan = maintenancePlan(root);
    assert.equal(plan.actions.length, 3);
    assert.equal(plan.actions[0].diagnosisBucket, 'learned-alias-pollution');
    assert.equal(plan.actions[1].diagnosisBucket, 'learned-boost-pollution');
    assert.equal(plan.actions[2].diagnosisBucket, 'pending-suggestion-backlog');
    assert.ok(plan.warnings.some((warning) => warning.includes('never modified')));
    assert.ok(plan.dryRunCommand.includes('maintain'));
});
test('maintenance plan does not initialize project files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmd-maint-plan-only-'));
    const plan = maintenancePlan(root);
    assert.equal(plan.actions.length, 3);
    assert.equal(fs.existsSync(path.join(root, '.qmd-adaptive-search')), false);
});
test('runMaintenance dry-run does not initialize project files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmd-maint-dry-only-'));
    const result = runMaintenance(root, { dryRun: true });
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(fs.existsSync(path.join(root, '.qmd-adaptive-search')), false);
});
test('runMaintenance requires confirmation before destructive cleanup', () => {
    const root = tempProject();
    writeLearnedAliases(root, { content: ['data'], templates: ['views'] });
    const result = runMaintenance(root, { targets: ['learned-aliases'] });
    assert.equal(result.ok, false);
    assert.equal(result.confirmationRequired, true);
    assert.equal(countLearnedState(root).learnedAliases, 2);
});
test('runMaintenance skips confirmation when selected cleanup is non-destructive', () => {
    const root = tempProject();
    const result = runMaintenance(root, { targets: ['learned-aliases'] });
    assert.equal(result.ok, true);
    assert.equal(result.confirmationRequired, undefined);
    assert.equal(result.actions[0].cleared, 0);
});
test('runMaintenance dry-run does not modify learned state', () => {
    const root = tempProject();
    writeLearnedAliases(root, { content: ['data'] });
    writeLearnedBoosts(root, { 'docs/a.md': 0.2 });
    appendPendingSuggestion(root, 2);
    const result = runMaintenance(root, { dryRun: true });
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(countLearnedState(root).learnedAliases, 1);
    assert.equal(countLearnedState(root).learnedBoosts, 1);
    assert.equal(countLearnedState(root).pendingSuggestions, 2);
});
test('runMaintenance clears selected local targets with --yes', () => {
    const root = tempProject();
    writeLearnedAliases(root, { content: ['data'], templates: ['views'] });
    writeLearnedBoosts(root, { 'docs/a.md': 0.8, 'docs/b.md': 0.1 });
    appendPendingSuggestion(root, 4);
    writeSharedAliases(root, { product: ['spec'] });
    writeSharedBoosts(root, { 'docs/ProductSpec.md': 0.2 });
    const result = runMaintenance(root, { yes: true });
    assert.equal(result.ok, true);
    assert.equal(result.before.learnedAliases, 2);
    assert.equal(result.before.learnedBoosts, 2);
    assert.equal(result.before.pendingSuggestions, 4);
    assert.equal(result.after.learnedAliases, 0);
    assert.equal(result.after.learnedBoosts, 0);
    assert.equal(result.after.pendingSuggestions, 0);
    const sharedAliases = JSON.parse(fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'shared-aliases.json'), 'utf8'));
    const sharedBoosts = JSON.parse(fs.readFileSync(path.join(root, '.qmd-adaptive-search', 'shared-boosts.json'), 'utf8'));
    assert.deepEqual(sharedAliases.aliases, { product: ['spec'] });
    assert.deepEqual(sharedBoosts.boosts, { 'docs/ProductSpec.md': 0.2 });
    assert.equal(result.status.aliases.learned, 0);
    assert.equal(result.status.boosts.learned, 0);
    assert.equal(result.status.pendingSuggestions, 0);
    assert.equal(result.diagnosis.buckets.find((b) => b.name === 'learned-alias-pollution').severity, 'ok');
});
test('runMaintenance reports per-target cleared counts', () => {
    const root = tempProject();
    writeLearnedAliases(root, { content: ['data'] });
    const result = runMaintenance(root, { targets: ['learned-aliases'], yes: true });
    assert.equal(result.actions.length, 1);
    assert.equal(result.actions[0].beforeCount, 1);
    assert.equal(result.actions[0].afterCount, 0);
    assert.equal(result.actions[0].cleared, 1);
});
test('runMaintenance with --yes on empty state is a no-op success', () => {
    const root = tempProject();
    const result = runMaintenance(root, { yes: true });
    assert.equal(result.ok, true);
    assert.equal(result.actions.every((action) => action.cleared === 0), true);
});
test('CLI maintain dry-run accepts multiple positional targets', async () => {
    const root = tempProject();
    writeLearnedAliases(root, { content: ['data'] });
    writeLearnedBoosts(root, { 'docs/a.md': 0.8 });
    const previousCwd = process.cwd();
    const previousLog = console.log;
    const logs = [];
    try {
        process.chdir(root);
        console.log = (value) => logs.push(String(value));
        await runCli(['maintain', 'learned-aliases', 'learned-boosts', '--dry-run']);
    }
    finally {
        console.log = previousLog;
        process.chdir(previousCwd);
    }
    const payload = JSON.parse(logs.join('\n'));
    assert.deepEqual(payload.plan.targets, ['learned-aliases', 'learned-boosts']);
    assert.deepEqual(payload.plan.actions.map((action) => action.beforeCount), [1, 1]);
});
//# sourceMappingURL=maintenance.test.js.map