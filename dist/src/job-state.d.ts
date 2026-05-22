declare function emptyJobState(): {
    currentJob: any;
    pendingJobs: any[];
    failedJobs: any[];
    recentJobs: any[];
    lastJob: any;
    lastSearchJob: any;
    lastUpdateJob: any;
    lastEmbedJob: any;
    suppressions: {};
};
declare function normalizeJobState(raw?: any): any;
declare function readJobState(root?: string): any;
declare function writeJobState(root: any, state: any): void;
declare function startBackgroundJob(root: any, input?: any): {
    id: `${string}-${string}-${string}-${string}-${string}`;
    type: any;
    status: string;
    startedAt: string;
    input: any;
    qmd: any;
    result: any;
    error: any;
    recoveryHint: string;
};
declare function finishBackgroundJob(root: any, runningJob: any, patch?: any): any;
declare function startQmdSearchJob(root: any, input?: any): {
    id: `${string}-${string}-${string}-${string}-${string}`;
    type: any;
    status: string;
    startedAt: string;
    input: any;
    qmd: any;
    result: any;
    error: any;
    recoveryHint: string;
};
declare function finishQmdSearchJob(root: any, runningJob: any, qmdResult?: any): any;
declare function backgroundJobsForResult(state: any): any[];
declare function backgroundJobSummary(state: any): {
    currentJob: {
        id: any;
        type: any;
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
export { emptyJobState, normalizeJobState, readJobState, writeJobState, startBackgroundJob, finishBackgroundJob, startQmdSearchJob, finishQmdSearchJob, backgroundJobsForResult, backgroundJobSummary };
