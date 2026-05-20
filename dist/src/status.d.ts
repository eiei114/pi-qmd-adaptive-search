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
    backgroundJob: any;
    lastUpdateJob: any;
    lastEmbedJob: any;
    suppressions: any;
    recentSearches: any;
    localIgnored: boolean;
};
export { adaptiveStatus };
