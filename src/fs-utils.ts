import fs from 'node:fs';
import path from 'node:path';

function toPosix(value) {
  return String(value).replace(/\\/g, '/');
}

function projectPath(root, relativePath) {
  return path.join(root, relativePath);
}

function walkFiles(root, include = (_rel) => true, dir = root, output = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return output;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = toPosix(path.relative(root, abs));
    if (rel === '.git' || rel.startsWith('.git/') || rel === 'node_modules' || rel.includes('/node_modules/')) continue;
    if (entry.isDirectory()) walkFiles(root, include, abs, output);
    else if (entry.isFile() && include(rel)) output.push(rel);
  }
  return output;
}

// Every UTF-8 character costs at most 4 bytes, and 4 spare bytes keep a truncated
// multi-byte sequence out of the window we decode.
const MAX_UTF8_BYTES_PER_CHAR = 4;
const CONTENT_SAMPLE_CHARS = 20000;

let prefixScratchBuffer: Buffer | null = null;

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
function readUtf8Prefix(file, charLimit = CONTENT_SAMPLE_CHARS) {
  const byteLimit = charLimit * MAX_UTF8_BYTES_PER_CHAR + MAX_UTF8_BYTES_PER_CHAR;
  if (!prefixScratchBuffer || prefixScratchBuffer.length < byteLimit) {
    prefixScratchBuffer = Buffer.allocUnsafe(byteLimit);
  }
  const buffer = prefixScratchBuffer;
  const fd = fs.openSync(file, 'r');
  try {
    let filled = 0;
    while (filled < byteLimit) {
      const read = fs.readSync(fd, buffer, filled, byteLimit - filled, filled);
      if (read === 0) break;
      filled += read;
    }
    return buffer.toString('utf8', 0, filled).slice(0, charLimit);
  } finally {
    fs.closeSync(fd);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback;
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
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

function updateGitignore(root) {
  const gitignore = path.join(root, '.gitignore');
  const needed = ['.qmd-adaptive-search/local/', '.qmd-adaptive-search/logs/'];
  let current = '';
  try {
    current = fs.readFileSync(gitignore, 'utf8');
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
  const missing = needed.filter((line) => !current.split(/\r?\n/).includes(line));
  if (missing.length === 0) return false;
  const prefix = current && !current.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(gitignore, `${current}${prefix}${missing.join('\n')}\n`, 'utf8');
  return true;
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const output = { ...(base || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) output[key] = deepMerge(output[key], value);
    else output[key] = value;
  }
  return output;
}

export {
  toPosix,
  projectPath,
  walkFiles,
  ensureDir,
  readJson,
  writeJson,
  appendJsonLine,
  readJsonLines,
  updateGitignore,
  deepMerge,
  readUtf8Prefix,
  CONTENT_SAMPLE_CHARS
};
