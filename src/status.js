'use strict';

const fs = require('node:fs');
const { initProject, loadConfig, paths } = require('./config');
const { detectQmd } = require('./qmd');
const { readJson, readJsonLines } = require('./fs-utils');

function countObject(file, key) {
  return Object.keys(readJson(file, { [key]: {} })[key] || {}).length;
}

function adaptiveStatus(options = {}) {
  const root = options.root || process.cwd();
  initProject(root);
  const config = loadConfig(root);
  const p = paths(root);
  const qmd = detectQmd(config, root);
  const manifest = readJson(p.fileManifest, { files: [], updatedAt: null });
  const jobState = readJson(p.jobState, { currentJob: null, lastUpdateJob: null, lastEmbedJob: null, suppressions: {} });
  const recent = readJson(p.recentSearches, { searches: [] });
  return {
    configPath: p.config,
    qmd: { available: qmd.available, command: qmd.command, errors: qmd.errors || [] },
    fileGlobs: config.fileGlobs,
    excludeGlobs: config.excludeGlobs,
    aliases: {
      shared: countObject(p.sharedAliases, 'aliases'),
      learned: countObject(p.learnedAliases, 'aliases')
    },
    boosts: {
      shared: countObject(p.sharedBoosts, 'boosts'),
      learned: countObject(p.learnedBoosts, 'boosts')
    },
    pendingSuggestions: readJsonLines(p.pendingSuggestions).length,
    manifest: { enabled: !!config.changeDetection?.manifestEnabled, files: (manifest.files || []).length, updatedAt: manifest.updatedAt },
    backgroundJob: jobState.currentJob,
    lastUpdateJob: jobState.lastUpdateJob,
    lastEmbedJob: jobState.lastEmbedJob,
    suppressions: jobState.suppressions || {},
    recentSearches: (recent.searches || []).length,
    localIgnored: fs.existsSync(p.local)
  };
}

module.exports = { adaptiveStatus };
