declare function tokenize(value: any): string[];
declare function inferMode(query: any, requested?: string): string;
declare function globToRegex(glob: any): RegExp;
declare function walkFiles(root: any, config: any, dir?: any, output?: any[]): any[];
declare function scoreFile(root: any, rel: any, terms: any, scopeHints: any, mode: any, boostEntries: any): {
    score: number;
    source: any[];
    why: any[];
};
type RankedCandidate = {
    path: string;
    score: number;
    source: string[];
    why: string[];
};
/**
 * MVP fusion step: combine qmd-ranked candidates with local lexical scores,
 * then rerank by total score. Named for the PRD pipeline; uses additive fusion.
 */
declare function rrfFuseCandidates(qmdResults: RankedCandidate[], localResults: RankedCandidate[], aliasWhy?: string[]): RankedCandidate[];
declare function adaptiveSearch(input: any, options?: any): {
    results: {
        path: string;
        title: string;
        score: number;
        source: string[];
        why: string[];
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
export { adaptiveSearch, inferMode, tokenize, walkFiles, globToRegex, scoreFile, rrfFuseCandidates };
