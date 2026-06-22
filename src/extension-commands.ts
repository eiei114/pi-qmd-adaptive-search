import { Type } from 'typebox';
import {
  adaptiveSearch,
  recordFeedback,
  adaptiveStatus,
  initProject,
  applyPreset,
  reviewSuggestions,
  approveSuggestions,
  installInstructions,
  qmdOperationPlan,
  runQmdOperation,
  maintenancePlan,
  runMaintenance
} from './index.js';
import { formatAdaptiveSearchToolResult } from './search-result-format.js';

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

export const QMD_A_COLON_COMMANDS = [
  'qmd-a:init',
  'qmd-a:status',
  'qmd-a:review',
  'qmd-a:approve',
  'qmd-a:configure',
  'qmd-a:install',
  'qmd-a:setup',
  'qmd-a:setup-run',
  'qmd-a:update',
  'qmd-a:update-run',
  'qmd-a:embed',
  'qmd-a:embed-run',
  'qmd-a:maintain',
  'qmd-a:maintain-run'
] as const;

function textResult(text: string, details: Record<string, unknown> = {}) {
  return { content: [{ type: 'text', text }], details };
}

function jsonResult(value: unknown) {
  return textResult(JSON.stringify(value, null, 2), value as Record<string, unknown>);
}

function hasYesFlag(text: string): boolean {
  return /(^|\s)--yes(\s|$)/.test(String(text || ''));
}

const SEARCH_MODES = ['auto', 'precision', 'recall', 'article', 'project'] as const;
const FEEDBACK_RATINGS = ['good', 'bad'] as const;
const CONFIGURE_PRESETS = ['docs', 'mixed', 'code', 'privacy'] as const;

function normalizeSearchToolParams(params: {
  query: string;
  mode?: (typeof SEARCH_MODES)[number];
  scopeHint?: string | string[];
  maxResults?: number;
}) {
  return {
    ...params,
    ...(params.mode != null ? { mode: params.mode } : {}),
    ...(params.maxResults != null
      ? { maxResults: Math.min(Math.max(Math.trunc(params.maxResults), 1), 30) }
      : {})
  };
}

function normalizeFeedbackToolParams(params: {
  selectedPaths?: string[];
  selectedPath?: string;
  rating?: (typeof FEEDBACK_RATINGS)[number];
  force?: boolean;
}) {
  return {
    ...params,
    ...(params.rating != null ? { rating: params.rating } : {})
  };
}

function handleInit(ctx: ExtensionCommandContext) {
  const result = initProject(ctx.cwd);
  ctx.ui.notify('qmd adaptive config initialized', 'info');
  return jsonResult(result);
}

function handleStatus(ctx: ExtensionCommandContext) {
  return jsonResult(adaptiveStatus({ root: ctx.cwd }));
}

function handleReview(ctx: ExtensionCommandContext) {
  return jsonResult(reviewSuggestions({ root: ctx.cwd }));
}

function handleApprove(ctx: ExtensionCommandContext) {
  return jsonResult(approveSuggestions({ root: ctx.cwd }));
}

function applyConfigurePreset(preset: string, ctx: ExtensionCommandContext) {
  const result = applyPreset(ctx.cwd, preset);
  ctx.ui.notify(`qmd adaptive preset applied: ${preset}`, 'info');
  return jsonResult(result);
}

async function handleConfigure(args: string, ctx: ExtensionCommandContext) {
  const presetArg = String(args || '').trim();
  if (presetArg) return applyConfigurePreset(presetArg, ctx);

  if (ctx.hasUI === false || typeof ctx.ui.select !== 'function') {
    const message =
      'Preset selection requires the Pi TUI. For scripts or headless runs, use `qmd-adaptive-search configure --preset docs|mixed|code|privacy`.';
    ctx.ui.notify(message, 'warning');
    return jsonResult({ ok: false, error: 'ui_required', message, presets: CONFIGURE_PRESETS });
  }

  const selected = await ctx.ui.select('Choose qmd adaptive preset:', [...CONFIGURE_PRESETS]);
  if (!selected) {
    ctx.ui.notify('qmd adaptive preset selection cancelled', 'warning');
    return jsonResult({ ok: false, cancelled: true, presets: CONFIGURE_PRESETS });
  }

  const preset = String(selected).trim();
  return applyConfigurePreset(preset, ctx);
}

function handleInstall() {
  return textResult(installInstructions());
}

function handleQmdOperation(
  operation: 'setup' | 'update' | 'embed',
  args: string,
  ctx: ExtensionCommandContext,
  options: { execute: boolean }
) {
  const runOptions = { yes: options.execute, dryRun: !options.execute };
  if (!runOptions.yes) {
    return jsonResult({ plan: qmdOperationPlan(operation, {}, { root: ctx.cwd }) });
  }
  return jsonResult(runQmdOperation(operation, runOptions, { root: ctx.cwd }));
}

function parseMaintainTargets(args: string): string | string[] | undefined {
  const trimmed = String(args || '').trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/).filter(Boolean);
}

function handleMaintain(args: string, ctx: ExtensionCommandContext, options: { execute: boolean }) {
  const targets = parseMaintainTargets(args);
  if (!options.execute) {
    return jsonResult(maintenancePlan(ctx.cwd, { targets }));
  }
  return jsonResult(runMaintenance(ctx.cwd, { targets, yes: true }));
}

export function registerQmdAdaptiveTools(pi: ExtensionAPILike) {
  pi.registerTool({
    name: 'qmd_adaptive_search',
    label: 'QMD Adaptive Search',
    description:
      'Project-local semantic file discovery for vague searches across notes, docs, specs, plans, and qmd-indexed files.',
    promptSnippet: 'Find project-local files by semantic intent using qmd plus adaptive fallback search.',
    promptGuidelines: [
      'Use qmd_adaptive_search for vague, semantic, intent-based, or context-seeking file discovery.',
      'Prefer rg/grep/find_files for exact symbols, config keys, error strings, and known filenames.',
      'After qmd_adaptive_search, call qmd_search_feedback when you rely on returned files in your answer.'
    ],
    parameters: Type.Object({
      query: Type.String({ description: 'Natural language search query. Raw query is not persisted.' }),
      mode: Type.Optional(
        Type.Union(
          SEARCH_MODES.map((mode) => Type.Literal(mode)),
          { description: 'auto, precision, recall, article, or project.' }
        )
      ),
      scopeHint: Type.Optional(
        Type.Union([Type.String(), Type.Array(Type.String())], {
          description: 'Path/folder hints for soft boosting.'
        })
      ),
      maxResults: Type.Optional(
        Type.Integer({ minimum: 1, maximum: 30, description: 'Default 10, hard max 30.' })
      )
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return formatAdaptiveSearchToolResult(
        adaptiveSearch(normalizeSearchToolParams(params), { root: ctx.cwd })
      );
    }
  });

  pi.registerTool({
    name: 'qmd_search_feedback',
    label: 'QMD Search Feedback',
    description: 'Record which qmd_adaptive_search results were useful, without storing raw queries.',
    parameters: Type.Object({
      selectedPaths: Type.Optional(Type.Array(Type.String())),
      selectedPath: Type.Optional(Type.String()),
      rating: Type.Optional(
        Type.Union(
          FEEDBACK_RATINGS.map((rating) => Type.Literal(rating)),
          { description: 'good or bad. Automatic useful-result feedback should use good.' }
        )
      ),
      force: Type.Optional(
        Type.Boolean({ description: 'Accept manual low-confidence feedback outside recent search results.' })
      )
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return jsonResult(recordFeedback(normalizeFeedbackToolParams(params), { root: ctx.cwd }));
    }
  });

  pi.registerTool({
    name: 'qmd_adaptive_status',
    label: 'QMD Adaptive Status',
    description:
      'Show qmd adaptive search config, qmd availability, learning counts, pending suggestions, and job state.',
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      return jsonResult(adaptiveStatus({ root: ctx.cwd }));
    }
  });
}

export function registerQmdAdaptiveCommands(pi: ExtensionAPILike) {
  const colonHandlers: Record<(typeof QMD_A_COLON_COMMANDS)[number], ExtensionCommandRegistration> = {
    'qmd-a:init': {
      description: 'Create lightweight qmd-adaptive-search config in the current project',
      handler: async (_args, ctx) => handleInit(ctx)
    },
    'qmd-a:status': {
      description: 'Show qmd adaptive search status',
      handler: async (_args, ctx) => handleStatus(ctx)
    },
    'qmd-a:review': {
      description: 'Review pending qmd adaptive suggestions',
      handler: async (_args, ctx) => handleReview(ctx)
    },
    'qmd-a:approve': {
      description: 'Promote pending qmd adaptive suggestions to shared aliases and boosts',
      handler: async (_args, ctx) => handleApprove(ctx)
    },
    'qmd-a:configure': {
      description: 'Choose and apply a qmd adaptive preset: docs, mixed, code, or privacy',
      handler: async (args, ctx) => handleConfigure(args, ctx)
    },
    'qmd-a:install': {
      description: 'Show qmd install instructions',
      handler: async () => handleInstall()
    },
    'qmd-a:setup': {
      description: 'Show qmd collection setup plan',
      handler: async (_args, ctx) => handleQmdOperation('setup', '', ctx, { execute: false })
    },
    'qmd-a:setup-run': {
      description: 'Run qmd collection setup after review',
      handler: async (_args, ctx) => handleQmdOperation('setup', '', ctx, { execute: true })
    },
    'qmd-a:update': {
      description: 'Show qmd index update plan',
      handler: async (_args, ctx) => handleQmdOperation('update', '', ctx, { execute: false })
    },
    'qmd-a:update-run': {
      description: 'Run qmd index update after review',
      handler: async (_args, ctx) => handleQmdOperation('update', '', ctx, { execute: true })
    },
    'qmd-a:embed': {
      description: 'Show qmd embedding plan',
      handler: async (_args, ctx) => handleQmdOperation('embed', '', ctx, { execute: false })
    },
    'qmd-a:embed-run': {
      description: 'Run qmd embedding after review',
      handler: async (_args, ctx) => handleQmdOperation('embed', '', ctx, { execute: true })
    },
    'qmd-a:maintain': {
      description: 'Show learned-state maintenance cleanup plan',
      handler: async (args, ctx) => handleMaintain(args, ctx, { execute: false })
    },
    'qmd-a:maintain-run': {
      description: 'Reset polluted local learned aliases, boosts, or pending suggestions',
      handler: async (args, ctx) => handleMaintain(args, ctx, { execute: true })
    }
  };

  for (const name of QMD_A_COLON_COMMANDS) {
    pi.registerCommand(name, colonHandlers[name]);
  }

}
