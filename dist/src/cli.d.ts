declare function parseArgs(argv: any): any;
declare function helpText(): string;
declare function help(): void;
declare function runCli(argv: any): Promise<void>;
export { runCli, parseArgs, help, helpText };
