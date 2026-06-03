declare function tokenize(value: any): string[];
declare function inferMode(query: any, requested?: string): string;
declare function globToRegex(glob: any): RegExp;
declare function walkFiles(root: any, config: any, dir?: any, output?: any[]): any[];
declare function adaptiveSearch(input: any, options?: any): {
    results: {
        path: any;
        title: string;
        score: number;
        source: any;
        why: unknown[];
        lead: string;
        highlights: any[];
    }[];
    warnings: any[];
    backgroundJobStatus: {
        pendingCount: any;
        failedCount: any;
        running: boolean;
        lastSearchStatus: any;
        qmdFallbackUsed: boolean;
        qmdAvailable: any;
    };
};
export { adaptiveSearch, inferMode, tokenize, walkFiles, globToRegex };
