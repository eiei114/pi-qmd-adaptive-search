import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  adaptiveSearch,
  recordFeedback,
  adaptiveStatus,
  initProject,
  applyPreset,
  reviewSuggestions,
  approveSuggestions,
  installInstructions
} from '../dist/src/index.js';

function textResult(text, details = {}) {
  return { content: [{ type: 'text', text }], details };
}

function jsonResult(value) {
  return textResult(JSON.stringify(value, null, 2), value);
}

function registerTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'qmd_adaptive_search',
    label: 'QMD Adaptive Search',
    description: 'Project-local semantic file discovery for vague searches across notes, docs, specs, plans, and qmd-indexed files.',
    promptSnippet: 'Find project-local files by semantic intent using qmd plus adaptive fallback search.',
    promptGuidelines: [
      'Use qmd_adaptive_search for vague, semantic, intent-based, or context-seeking file discovery.',
      'Prefer rg/grep/find_files for exact symbols, config keys, error strings, and known filenames.',
      'After qmd_adaptive_search, call qmd_search_feedback when you rely on returned files in your answer.'
    ],
    parameters: Type.Object({
      query: Type.String({ description: 'Natural language search query. Raw query is not persisted.' }),
      mode: Type.Optional(Type.String({ description: 'auto, precision, recall, article, or project.' })),
      scopeHint: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())], { description: 'Path/folder hints for soft boosting.' })),
      maxResults: Type.Optional(Type.Number({ description: 'Default 10, hard max 30.' }))
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return jsonResult(adaptiveSearch(params, { root: ctx.cwd }));
    }
  });

  pi.registerTool({
    name: 'qmd_search_feedback',
    label: 'QMD Search Feedback',
    description: 'Record which qmd_adaptive_search results were useful, without storing raw queries.',
    parameters: Type.Object({
      selectedPaths: Type.Optional(Type.Array(Type.String())),
      selectedPath: Type.Optional(Type.String()),
      rating: Type.Optional(Type.String({ description: 'good or bad. Automatic useful-result feedback should use good.' })),
      force: Type.Optional(Type.Boolean({ description: 'Accept manual low-confidence feedback outside recent search results.' }))
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return jsonResult(recordFeedback(params, { root: ctx.cwd }));
    }
  });

  pi.registerTool({
    name: 'qmd_adaptive_status',
    label: 'QMD Adaptive Status',
    description: 'Show qmd adaptive search config, qmd availability, learning counts, pending suggestions, and job state.',
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      return jsonResult(adaptiveStatus({ root: ctx.cwd }));
    }
  });
}

function registerCommands(pi: ExtensionAPI) {
  pi.registerCommand('qmd-adaptive-init', {
    description: 'Create lightweight qmd-adaptive-search config in the current project',
    handler: async (_args, ctx) => {
      ctx.ui.notify('qmd adaptive config initialized', 'info');
      return jsonResult(initProject(ctx.cwd));
    }
  });

  pi.registerCommand('qmd-adaptive-status', {
    description: 'Show qmd adaptive search status',
    handler: async (_args, ctx) => jsonResult(adaptiveStatus({ root: ctx.cwd }))
  });

  pi.registerCommand('qmd-adaptive-review', {
    description: 'Review pending qmd adaptive suggestions; pass "approve" to promote them',
    handler: async (args, ctx) => {
      if (String(args || '').trim() === 'approve') return jsonResult(approveSuggestions({ root: ctx.cwd }));
      return jsonResult(reviewSuggestions({ root: ctx.cwd }));
    }
  });

  pi.registerCommand('qmd-adaptive-configure', {
    description: 'Apply a qmd adaptive preset: docs, mixed, code, or privacy',
    handler: async (args, ctx) => {
      const preset = String(args || 'mixed').trim() || 'mixed';
      return jsonResult(applyPreset(ctx.cwd, preset));
    }
  });

  pi.registerCommand('qmd-adaptive-install-qmd', {
    description: 'Show qmd install instructions',
    handler: async () => textResult(installInstructions())
  });
}

export default function qmdAdaptiveSearchExtension(pi: ExtensionAPI) {
  registerTools(pi);
  registerCommands(pi);
}
