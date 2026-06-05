import fs from 'node:fs';
import { initProject, loadConfig, paths } from './config.js';
import { detectQmd } from './qmd.js';
import { readJson, readJsonLines } from './fs-utils.js';
import { backgroundJobSummary, readJobState } from './job-state.js';
import { nextQmdOperation } from './qmd-operations.js';
import { diagnoseSearchQuality } from './diagnosis.js';
function countObject(file, key) {
    return Object.keys(readJson(file, { [key]: {} })[key] || {}).length;
}
function adaptiveStatus(options = {}) {
    const root = options.root || process.cwd();
    initProject(root);
    const config = loadConfig(root);
    const p = paths(root);
    const qmd = detectQmd(config, root);
    const manifest = readJson(p.fileManifest, { files: [], updatedAt: null });
    const jobState = readJobState(root);
    const backgroundJobs = backgroundJobSummary(jobState);
    const recent = readJson(p.recentSearches, { searches: [] });
    return {
        configPath: p.config,
        qmd: { available: qmd.available, command: qmd.command, errors: qmd.errors || [] },
        fileGlobs: config.fileGlobs,
        excludeGlobs: config.excludeGlobs,
        aliases: {
            shared: countObject(p.sharedAliases, 'aliases'),
            learned: countObject(p.learnedAliases, 'aliases')
        },
        boosts: {
            shared: countObject(p.sharedBoosts, 'boosts'),
            learned: countObject(p.learnedBoosts, 'boosts')
        },
        pendingSuggestions: readJsonLines(p.pendingSuggestions).length,
        manifest: { enabled: !!config.changeDetection?.manifestEnabled, files: (manifest.files || []).length, updatedAt: manifest.updatedAt },
        backgroundJobs,
        backgroundJob: backgroundJobs.currentJob,
        pendingBackgroundJobs: backgroundJobs.pending,
        failedBackgroundJobs: backgroundJobs.failed,
        lastBackgroundJob: backgroundJobs.lastJob,
        qmdNextOperation: nextQmdOperation(root, config, qmd, jobState),
        lastSetupJob: backgroundJobs.lastSetupJob,
        lastSearchJob: backgroundJobs.lastSearchJob,
        lastUpdateJob: backgroundJobs.lastUpdateJob,
        lastEmbedJob: backgroundJobs.lastEmbedJob,
        recoveryHints: backgroundJobs.recoveryHints,
        suppressions: jobState.suppressions || {},
        recentSearches: (recent.searches || []).length,
        localIgnored: fs.existsSync(p.local),
        diagnosis: diagnoseSearchQuality(root, config, qmd)
    };
}
export { adaptiveStatus };
//# sourceMappingURL=status.js.map