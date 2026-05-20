declare const DEFAULT_CONFIG: Readonly<{
    qmdCommand: any;
    installInstructions: "auto";
    fileGlobs: string[];
    excludeGlobs: string[];
    search: {
        defaultMaxResults: number;
        hardMaxResults: number;
        maxHighlightsPerResult: number;
        maxHighlightChars: number;
        maxLeadChars: number;
        defaultModeBias: string;
    };
    indexing: {
        runner: string;
        preferredRunnerOrder: string[];
        subagent: {
            enabled: boolean;
            taskName: string;
            timeoutMinutes: number;
            reportStatus: boolean;
        };
        update: {
            auto: boolean;
            silent: boolean;
            debounceMs: number;
            maxFrequencyMinutes: number;
            notifyWhenEstimatedFilesOver: number;
        };
        embed: {
            auto: boolean;
            debounceMs: number;
            maxFrequencyMinutes: number;
            confirmFirstRun: boolean;
            silentWhenPendingUnder: number;
            confirmWhenPendingOver: number;
            preferIdle: boolean;
        };
    };
    idle: {
        enabled: boolean;
        quietPeriodMs: number;
        maxWaitMinutes: number;
    };
    changeDetection: {
        mode: string;
        strategies: string[];
        scanDebounceMs: number;
        watcherEnabled: boolean;
        manifestEnabled: boolean;
    };
    notifications: {
        embedPromptSuppressMinutes: number;
        notifySmallBackgroundJobs: boolean;
        notifyLargeBackgroundJobs: boolean;
    };
    feedback: {
        recentSearchTtlMinutes: number;
        recentSearchMaxEntries: number;
    };
    learning: {
        pendingScope: string;
        sharedScope: string;
        autoReviewPrompt: boolean;
        reviewPromptThreshold: number;
        reviewPromptSuppressMinutes: number;
        autopilotSharedWrites: boolean;
    };
}>;
declare const PRESETS: Readonly<{
    docs: {
        fileGlobs: string[];
        excludeGlobs: string[];
        indexing: {
            embed: {
                confirmWhenPendingOver: number;
            };
        };
        changeDetection: {
            manifestEnabled: boolean;
        };
        learning: {
            pendingScope: string;
        };
    };
    mixed: {
        fileGlobs: string[];
        excludeGlobs: string[];
        indexing: {
            embed: {
                confirmWhenPendingOver: number;
            };
        };
    };
    code: {
        fileGlobs: string[];
        excludeGlobs: string[];
        search: {
            defaultModeBias: string;
        };
        indexing: {
            embed: {
                confirmWhenPendingOver: number;
            };
        };
    };
    privacy: {
        changeDetection: {
            manifestEnabled: boolean;
        };
        indexing: {
            update: {
                auto: boolean;
            };
            embed: {
                auto: boolean;
            };
        };
        learning: {
            pendingScope: string;
            autopilotSharedWrites: boolean;
        };
    };
}>;
export { DEFAULT_CONFIG, PRESETS };
