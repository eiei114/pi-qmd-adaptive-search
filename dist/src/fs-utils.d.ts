declare function toPosix(value: any): string;
declare function projectPath(root: any, relativePath: any): string;
declare function walkFiles(root: any, include?: (_rel: any) => boolean, dir?: any, output?: any[]): any[];
declare const CONTENT_SAMPLE_CHARS = 20000;
/**
 * Read the first `charLimit` characters of a UTF-8 file without reading the rest.
 *
 * Fallback search scores only a short prefix of each candidate file. Reading a
 * complete multi-megabyte note for that prefix dominated the search time, so the
 * read is bounded to the bytes that prefix can occupy. The result is identical to
 * `fs.readFileSync(file, 'utf8').slice(0, charLimit)`.
 *
 * The scratch buffer is reused across files: allocating a fresh 80 KiB buffer per
 * candidate measurably dominated the pass on a vault with thousands of notes.
 * Only the `filled` slice is decoded, so stale bytes from a previous file are never
 * observed.
 */
declare function readUtf8Prefix(file: any, charLimit?: number): string;
declare function ensureDir(dir: any): void;
declare function readJson(file: any, fallback: any): any;
declare function writeJson(file: any, value: any): void;
declare function appendJsonLine(file: any, value: any): void;
declare function readJsonLines(file: any): any[];
declare function updateGitignore(root: any): boolean;
declare function deepMerge(base: any, patch: any): any;
export { toPosix, projectPath, walkFiles, ensureDir, readJson, writeJson, appendJsonLine, readJsonLines, updateGitignore, deepMerge, readUtf8Prefix, CONTENT_SAMPLE_CHARS };
