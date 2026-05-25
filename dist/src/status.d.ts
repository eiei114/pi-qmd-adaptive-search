declare function adaptiveStatus(options?: any): {
    configPath: string;
    qmd: {
        available: boolean;
        command: any;
        errors: any[];
    };
    fileGlobs: any;
    excludeGlobs: any;
    aliases: {
        shared: number;
        learned: number;
    };
    boosts: {
        shared: number;
        learned: number;
    };
    pendingSuggestions: number;
    manifest: {
        enabled: boolean;
        files: any;
        updatedAt: any;
    };
    backgroundJobs: {
        currentJob: {
            id: any;
            type: any;
            operation: any;
            status: any;
            startedAt: any;
            finishedAt: any;
            qmd: any;
            result: any;
            error: any;
            recoveryHint: any;
        };
        pending: any;
        failed: any;
        recent: any;
        lastJob: {
            id: any;
            type: any;
            operation: any;
            status: any;
            startedAt: any;
            finishedAt: any;
            qmd: any;
            result: any;
            error: any;
            recoveryHint: any;
        };
        lastSetupJob: {
            id: any;
            type: any;
            operation: any;
            status: any;
            startedAt: any;
            finishedAt: any;
            qmd: any;
            result: any;
            error: any;
            recoveryHint: any;
        };
        lastSearchJob: {
            id: any;
            type: any;
            operation: any;
            status: any;
            startedAt: any;
            finishedAt: any;
            qmd: any;
            result: any;
            error: any;
            recoveryHint: any;
        };
        lastUpdateJob: {
            id: any;
            type: any;
            operation: any;
            status: any;
            startedAt: any;
            finishedAt: any;
            qmd: any;
            result: any;
            error: any;
            recoveryHint: any;
        };
        lastEmbedJob: {
            id: any;
            type: any;
            operation: any;
            status: any;
            startedAt: any;
            finishedAt: any;
            qmd: any;
            result: any;
            error: any;
            recoveryHint: any;
        };
        recoveryHints: {
            jobId: any;
            type: any;
            status: any;
            hint: any;
        }[];
    };
    backgroundJob: {
        id: any;
        type: any;
        operation: any;
        status: any;
        startedAt: any;
        finishedAt: any;
        qmd: any;
        result: any;
        error: any;
        recoveryHint: any;
    };
    pendingBackgroundJobs: any;
    failedBackgroundJobs: any;
    lastBackgroundJob: {
        id: any;
        type: any;
        operation: any;
        status: any;
        startedAt: any;
        finishedAt: any;
        qmd: any;
        result: any;
        error: any;
        recoveryHint: any;
    };
    qmdNextOperation: {
        operation: string;
        reason: string;
        command: string;
    };
    lastSetupJob: {
        id: any;
        type: any;
        operation: any;
        status: any;
        startedAt: any;
        finishedAt: any;
        qmd: any;
        result: any;
        error: any;
        recoveryHint: any;
    };
    lastSearchJob: {
        id: any;
        type: any;
        operation: any;
        status: any;
        startedAt: any;
        finishedAt: any;
        qmd: any;
        result: any;
        error: any;
        recoveryHint: any;
    };
    lastUpdateJob: {
        id: any;
        type: any;
        operation: any;
        status: any;
        startedAt: any;
        finishedAt: any;
        qmd: any;
        result: any;
        error: any;
        recoveryHint: any;
    };
    lastEmbedJob: {
        id: any;
        type: any;
        operation: any;
        status: any;
        startedAt: any;
        finishedAt: any;
        qmd: any;
        result: any;
        error: any;
        recoveryHint: any;
    };
    recoveryHints: {
        jobId: any;
        type: any;
        status: any;
        hint: any;
    }[];
    suppressions: any;
    recentSearches: any;
    localIgnored: boolean;
};
export { adaptiveStatus };
