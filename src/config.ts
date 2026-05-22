import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CONFIG, PRESETS } from './defaults.js';
import { ensureDir, readJson, writeJson, updateGitignore, deepMerge } from './fs-utils.js';

const CONFIG_DIR = '.qmd-adaptive-search';

function paths(root) {
  const base = path.join(root, CONFIG_DIR);
  return {
    base,
    config: path.join(base, 'config.json'),
    sharedAliases: path.join(base, 'shared-aliases.json'),
    sharedBoosts: path.join(base, 'shared-boosts.json'),
    local: path.join(base, 'local'),
    learnedAliases: path.join(base, 'local', 'learned-aliases.json'),
    learnedBoosts: path.join(base, 'local', 'learned-boosts.json'),
    pendingSuggestions: path.join(base, 'local', 'pending-suggestions.jsonl'),
    fileManifest: path.join(base, 'local', 'file-manifest.json'),
    jobState: path.join(base, 'local', 'job-state.json'),
    recentSearches: path.join(base, 'local', 'recent-searches.json'),
    logs: path.join(base, 'logs')
  };
}

function initProject(root = process.cwd(), options: any = {}) {
  const p = paths(root);
  ensureDir(p.base);
  ensureDir(p.local);
  ensureDir(p.logs);

  const created = [];
  function createJsonIfMissing(file, value) {
    if (!fs.existsSync(file) || options.force) {
      writeJson(file, value);
      created.push(path.relative(root, file));
    }
  }
  function createTextIfMissing(file, value) {
    if (!fs.existsSync(file) || options.force) {
      ensureDir(path.dirname(file));
      fs.writeFileSync(file, value, 'utf8');
      created.push(path.relative(root, file));
    }
  }

  createJsonIfMissing(p.config, DEFAULT_CONFIG);
  createJsonIfMissing(p.sharedAliases, { aliases: {} });
  createJsonIfMissing(p.sharedBoosts, { boosts: {} });
  createJsonIfMissing(p.learnedAliases, { aliases: {} });
  createJsonIfMissing(p.learnedBoosts, { boosts: {} });
  createTextIfMissing(p.pendingSuggestions, '');
  createJsonIfMissing(p.fileManifest, { files: [], updatedAt: null });
  createJsonIfMissing(p.jobState, {
    currentJob: null,
    pendingJobs: [],
    failedJobs: [],
    recentJobs: [],
    lastJob: null,
    lastSearchJob: null,
    lastUpdateJob: null,
    lastEmbedJob: null,
    suppressions: {}
  });
  createJsonIfMissing(p.recentSearches, { searches: [] });
  const gitignoreUpdated = updateGitignore(root);

  return { ok: true, configDir: CONFIG_DIR, created, gitignoreUpdated };
}

function loadConfig(root = process.cwd(), options: any = {}) {
  const p = paths(root);
  if (!fs.existsSync(p.config)) {
    if (options.autoInit === false) throw new Error(`qmd-adaptive-search config not found at ${p.config}`);
    initProject(root);
  }
  return deepMerge(DEFAULT_CONFIG, readJson(p.config, {}));
}

function applyPreset(root, presetName, options: any = {}) {
  const preset = PRESETS[presetName];
  if (!preset) throw new Error(`Unknown preset: ${presetName}. Use one of: ${Object.keys(PRESETS).join(', ')}`);
  initProject(root);
  const p = paths(root);
  const current = readJson(p.config, DEFAULT_CONFIG);
  const next = options.reset ? deepMerge(DEFAULT_CONFIG, preset) : deepMerge(current, preset);
  if (!options.dryRun) writeJson(p.config, next);
  return { preset: presetName, reset: !!options.reset, before: current, after: next };
}

export { CONFIG_DIR, paths, initProject, loadConfig, applyPreset };
