declare function recordFeedback(input: any, options?: any): {
    ok: boolean;
    rejected: boolean;
    warnings: string[];
    selectedPaths?: undefined;
    anchors?: undefined;
} | {
    rejected?: undefined;
    ok: boolean;
    selectedPaths: unknown[];
    anchors: any;
    warnings: any[];
};
declare function reviewSuggestions(options?: any): {
    count: number;
    suggestions: any[];
};
declare function approveSuggestions(options?: any): {
    ok: boolean;
    approved: number;
};
export { recordFeedback, reviewSuggestions, approveSuggestions };
