export interface ExtensionCommandContext {
    cwd: string;
    hasUI?: boolean;
    mode?: string;
    ui: {
        notify: (text: string, level: string) => void;
        select?: (title: string, options: string[]) => string | undefined | Promise<string | undefined>;
    };
}
export interface ExtensionCommandRegistration {
    description: string;
    handler: (args: string, ctx: ExtensionCommandContext) => Promise<unknown>;
}
export interface ExtensionAPILike {
    registerCommand(name: string, options: ExtensionCommandRegistration): void;
    registerTool(definition: unknown): void;
}
export declare const QMD_A_COLON_COMMANDS: readonly ["qmd-a:init", "qmd-a:status", "qmd-a:review", "qmd-a:approve", "qmd-a:configure", "qmd-a:install", "qmd-a:setup", "qmd-a:setup-run", "qmd-a:update", "qmd-a:update-run", "qmd-a:embed", "qmd-a:embed-run", "qmd-a:maintain", "qmd-a:maintain-run"];
export declare function registerQmdAdaptiveTools(pi: ExtensionAPILike): void;
export declare function registerQmdAdaptiveCommands(pi: ExtensionAPILike): void;
