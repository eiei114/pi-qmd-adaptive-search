import fs from 'node:fs';
import path from 'node:path';
function toPosix(value) {
    return String(value).replace(/\\/g, '/');
}
function projectPath(root, relativePath) {
    return path.join(root, relativePath);
}
function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}
function readJson(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch (error) {
        if (error && error.code === 'ENOENT')
            return fallback;
        throw error;
    }
}
function writeJson(file, value) {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function appendJsonLine(file, value) {
    ensureDir(path.dirname(file));
    fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}
function readJsonLines(file) {
    try {
        return fs.readFileSync(file, 'utf8')
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line) => JSON.parse(line));
    }
    catch (error) {
        if (error && error.code === 'ENOENT')
            return [];
        throw error;
    }
}
function updateGitignore(root) {
    const gitignore = path.join(root, '.gitignore');
    const needed = ['.qmd-adaptive-search/local/', '.qmd-adaptive-search/logs/'];
    let current = '';
    try {
        current = fs.readFileSync(gitignore, 'utf8');
    }
    catch (error) {
        if (!error || error.code !== 'ENOENT')
            throw error;
    }
    const missing = needed.filter((line) => !current.split(/\r?\n/).includes(line));
    if (missing.length === 0)
        return false;
    const prefix = current && !current.endsWith('\n') ? '\n' : '';
    fs.writeFileSync(gitignore, `${current}${prefix}${missing.join('\n')}\n`, 'utf8');
    return true;
}
function deepMerge(base, patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
        return patch;
    const output = { ...(base || {}) };
    for (const [key, value] of Object.entries(patch)) {
        if (value && typeof value === 'object' && !Array.isArray(value))
            output[key] = deepMerge(output[key], value);
        else
            output[key] = value;
    }
    return output;
}
export { toPosix, projectPath, ensureDir, readJson, writeJson, appendJsonLine, readJsonLines, updateGitignore, deepMerge };
//# sourceMappingURL=fs-utils.js.map