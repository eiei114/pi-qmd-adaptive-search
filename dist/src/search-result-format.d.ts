export interface AdaptiveSearchResultItem {
    path: string;
    title: string;
    score: number;
    source: string[];
    why?: ReadonlyArray<string | unknown>;
    lead?: string;
    highlights?: string[];
}
export interface BackgroundJobStatusSummary {
    pendingCount: number;
    failedCount: number;
    running: boolean;
    lastSearchStatus: string | null;
    qmdFallbackUsed: boolean;
    qmdAvailable: boolean | null;
}
export interface AdaptiveSearchResult {
    results: AdaptiveSearchResultItem[];
    warnings?: string[];
    backgroundJobStatus?: BackgroundJobStatusSummary;
}
export interface CompactSearchResultItem {
    path: string;
    title: string;
    score: number;
    source: string[];
    why: string[];
}
export interface CompactSearchDetails {
    resultCount: number;
    resultPaths: string[];
    warnings: string[];
    results: CompactSearchResultItem[];
    backgroundJobStatus?: BackgroundJobStatusSummary;
}
/** Summarize adaptive search hits into structured counts, paths, warnings, and per-result metadata. */
export declare function compactSearchDetails(value: AdaptiveSearchResult): CompactSearchDetails;
/** Render adaptive search results as a compact, path-first plain-text summary for tool output. */
export declare function formatCompactSearchText(value: AdaptiveSearchResult): string;
/** Build the Pi tool result payload with compact text content and structured search details. */
export declare function formatAdaptiveSearchToolResult(value: AdaptiveSearchResult): {
    content: {
        type: string;
        text: string;
    }[];
    details: CompactSearchDetails;
};
