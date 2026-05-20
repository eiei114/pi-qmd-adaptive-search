const DEFAULT_CONFIG = Object.freeze({
    qmdCommand: null,
    installInstructions: 'auto',
    fileGlobs: ['**/*.md', '**/*.txt', '**/*.ts', '**/*.tsx', '**/*.js', '**/*.py', '**/*.json', '**/*.yaml', '**/*.yml'],
    excludeGlobs: ['node_modules/**', '.git/**', 'dist/**', 'build/**', 'coverage/**', '*.lock'],
    search: {
        defaultMaxResults: 10,
        hardMaxResults: 30,
        maxHighlightsPerResult: 2,
        maxHighlightChars: 240,
        maxLeadChars: 300,
        defaultModeBias: 'auto',
        qmdSearchTimeoutMs: 15000,
        qmdQueryTimeoutMs: 45000,
        qmdQueryFallback: false
    },
    indexing: {
        runner: 'auto',
        preferredRunnerOrder: ['subagent', 'process', 'manual'],
        subagent: {
            enabled: true,
            taskName: 'qmd-adaptive-index-refresh',
            timeoutMinutes: 20,
            reportStatus: true
        },
        update: {
            auto: true,
            silent: true,
            debounceMs: 30000,
            maxFrequencyMinutes: 2,
            notifyWhenEstimatedFilesOver: 1000
        },
        embed: {
            auto: true,
            debounceMs: 120000,
            maxFrequencyMinutes: 10,
            confirmFirstRun: true,
            silentWhenPendingUnder: 50,
            confirmWhenPendingOver: 200,
            preferIdle: true
        }
    },
    idle: {
        enabled: true,
        quietPeriodMs: 60000,
        maxWaitMinutes: 15
    },
    changeDetection: {
        mode: 'auto',
        strategies: ['watcher', 'scanOnSearch'],
        scanDebounceMs: 30000,
        watcherEnabled: true,
        manifestEnabled: true
    },
    notifications: {
        embedPromptSuppressMinutes: 1440,
        notifySmallBackgroundJobs: false,
        notifyLargeBackgroundJobs: true
    },
    feedback: {
        recentSearchTtlMinutes: 30,
        recentSearchMaxEntries: 20
    },
    learning: {
        pendingScope: 'local',
        sharedScope: 'project',
        autoReviewPrompt: true,
        reviewPromptThreshold: 5,
        reviewPromptSuppressMinutes: 1440,
        autopilotSharedWrites: false
    }
});
const PRESETS = Object.freeze({
    docs: {
        fileGlobs: ['**/*.md', '**/*.txt'],
        excludeGlobs: DEFAULT_CONFIG.excludeGlobs,
        indexing: { embed: { confirmWhenPendingOver: 200 } },
        changeDetection: { manifestEnabled: true },
        learning: { pendingScope: 'local' }
    },
    mixed: {
        fileGlobs: DEFAULT_CONFIG.fileGlobs,
        excludeGlobs: DEFAULT_CONFIG.excludeGlobs,
        indexing: { embed: { confirmWhenPendingOver: 200 } }
    },
    code: {
        fileGlobs: ['src/**/*.ts', 'src/**/*.tsx', 'docs/**/*.md', 'README.md', 'package.json'],
        excludeGlobs: ['node_modules/**', '.git/**', 'dist/**', 'build/**', 'coverage/**', '**/*.min.*', '*.lock'],
        search: { defaultModeBias: 'precision' },
        indexing: { embed: { confirmWhenPendingOver: 100 } }
    },
    privacy: {
        changeDetection: { manifestEnabled: false },
        indexing: { update: { auto: false }, embed: { auto: false } },
        learning: { pendingScope: 'local', autopilotSharedWrites: false }
    }
});
export { DEFAULT_CONFIG, PRESETS };
//# sourceMappingURL=defaults.js.map