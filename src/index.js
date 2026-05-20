'use strict';

const { initProject, loadConfig, applyPreset } = require('./config');
const { adaptiveSearch } = require('./search');
const { recordFeedback, reviewSuggestions, approveSuggestions } = require('./feedback');
const { adaptiveStatus } = require('./status');
const { detectQmd, installInstructions } = require('./qmd');

module.exports = {
  initProject,
  loadConfig,
  applyPreset,
  adaptiveSearch,
  recordFeedback,
  reviewSuggestions,
  approveSuggestions,
  adaptiveStatus,
  detectQmd,
  installInstructions
};
