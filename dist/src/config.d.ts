declare const CONFIG_DIR = ".qmd-adaptive-search";
declare function paths(root: any): {
    base: string;
    config: string;
    sharedAliases: string;
    sharedBoosts: string;
    local: string;
    learnedAliases: string;
    learnedBoosts: string;
    pendingSuggestions: string;
    fileManifest: string;
    jobState: string;
    recentSearches: string;
    logs: string;
};
declare function initProject(root?: string, options?: any): {
    ok: boolean;
    configDir: string;
    created: any[];
    gitignoreUpdated: boolean;
};
declare function loadConfig(root?: string, options?: any): any;
declare function applyPreset(root: any, presetName: any, options?: any): {
    preset: any;
    reset: boolean;
    before: any;
    after: any;
};
export { CONFIG_DIR, paths, initProject, loadConfig, applyPreset };
