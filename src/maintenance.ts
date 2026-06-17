import fs from 'node:fs';
import path from 'node:path';
import { initProject, paths } from './config.js';
import { readJson, readJsonLines, writeJson } from './fs-utils.js';
import { diagnoseSearchQuality } from './diagnosis.js';
import { adaptiveStatus } from './status.js';

/** Local learned-state targets aligned with diagnosis bucket vocabulary. */
export const MAINTENANCE_TARGETS = [
  'learned-aliases',
  'learned-boosts',
  'pending-suggestions'
] as const;

export type MaintenanceTarget = (typeof MAINTENANCE_TARGETS)[number];

const TARGET_TO_DIAGNOSIS_BUCKET: Record<MaintenanceTarget, string> = {
  'learned-aliases': 'learned-alias-pollution',
  'learned-boosts': 'learned-boost-pollution',
  'pending-suggestions': 'pending-suggestion-backlog'
};

export interface LearnedStateCounts {
  learnedAliases: number;
  learnedBoosts: number;
  pendingSuggestions: number;
}

export interface MaintenanceActionPlan {
  target: MaintenanceTarget;
  diagnosisBucket: string;
  description: string;
  file: string;
  beforeCount: number;
  destructive: boolean;
}

export interface MaintenancePlan {
  targets: MaintenanceTarget[];
  actions: MaintenanceActionPlan[];
  destructive: boolean;
  warnings: string[];
  dryRunCommand: string;
  confirmCommand: string;
  nextCommandAfterCleanup: string;
}

export interface MaintenanceActionResult {
  target: MaintenanceTarget;
  diagnosisBucket: string;
  file: string;
  beforeCount: number;
  afterCount: number;
  cleared: number;
}

export interface MaintenanceResult {
  ok: boolean;
  cancelled?: boolean;
  dryRun?: boolean;
  confirmationRequired?: boolean;
  plan?: MaintenancePlan;
  actions?: MaintenanceActionResult[];
  before?: LearnedStateCounts;
  after?: LearnedStateCounts;
  status?: ReturnType<typeof adaptiveStatus>;
  diagnosis?: ReturnType<typeof diagnoseSearchQuality>;
  nextCommand?: string;
}

function countLearnedState(root: string): LearnedStateCounts {
  const p = paths(root);
  return {
    learnedAliases: Object.keys(readJson(p.learnedAliases, { aliases: {} }).aliases || {}).length,
    learnedBoosts: Object.keys(readJson(p.learnedBoosts, { boosts: {} }).boosts || {}).length,
    pendingSuggestions: readJsonLines(p.pendingSuggestions).length
  };
}

function countForTarget(root: string, target: MaintenanceTarget): number {
  const counts = countLearnedState(root);
  if (target === 'learned-aliases') return counts.learnedAliases;
  if (target === 'learned-boosts') return counts.learnedBoosts;
  return counts.pendingSuggestions;
}

function relativeFile(root: string, target: MaintenanceTarget): string {
  const p = paths(root);
  const file = target === 'learned-aliases'
    ? p.learnedAliases
    : target === 'learned-boosts'
      ? p.learnedBoosts
      : p.pendingSuggestions;
  return path.relative(root, file).replace(/\\/g, '/');
}

function descriptionForTarget(target: MaintenanceTarget): string {
  if (target === 'learned-aliases') {
    return 'Reset local learned aliases (does not touch shared aliases).';
  }
  if (target === 'learned-boosts') {
    return 'Reset local learned boosts (does not touch shared boosts).';
  }
  return 'Discard all pending local suggestions awaiting review.';
}

function normalizeTargets(input: unknown): MaintenanceTarget[] {
  const raw = Array.isArray(input) ? input : String(input || '').split(/[,\s]+/);
  const values = raw.map((value) => String(value).trim()).filter(Boolean);
  if (values.length === 0 || values.includes('all')) return [...MAINTENANCE_TARGETS];

  const targets: MaintenanceTarget[] = [];
  for (const value of values) {
    if (!MAINTENANCE_TARGETS.includes(value as MaintenanceTarget)) {
      throw new Error(
        `Unknown maintenance target: ${value}. Use one of: ${MAINTENANCE_TARGETS.join(', ')}, all`
      );
    }
    if (!targets.includes(value as MaintenanceTarget)) targets.push(value as MaintenanceTarget);
  }
  return targets;
}

function buildCommand(targets: MaintenanceTarget[], flags: { dryRun?: boolean; yes?: boolean }): string {
  const parts = ['qmd-adaptive-search maintain', ...targets];
  if (flags.dryRun) parts.push('--dry-run');
  if (flags.yes) parts.push('--yes');
  return parts.join(' ');
}

function clearTarget(root: string, target: MaintenanceTarget): void {
  const p = paths(root);
  if (target === 'learned-aliases') {
    writeJson(p.learnedAliases, { aliases: {} });
    return;
  }
  if (target === 'learned-boosts') {
    writeJson(p.learnedBoosts, { boosts: {} });
    return;
  }
  fs.writeFileSync(p.pendingSuggestions, '', 'utf8');
}

function maintenancePlan(root: string, options: { targets?: unknown } = {}): MaintenancePlan {
  initProject(root);
  const targets = normalizeTargets(options.targets);
  const actions = targets.map((target) => {
    const beforeCount = countForTarget(root, target);
    return {
      target,
      diagnosisBucket: TARGET_TO_DIAGNOSIS_BUCKET[target],
      description: descriptionForTarget(target),
      file: relativeFile(root, target),
      beforeCount,
      destructive: beforeCount > 0
    };
  });

  const warnings = [
    'This workflow only clears local learned state under .qmd-adaptive-search/local/.',
    'Shared aliases and shared boosts are never modified.',
    'For embed debt or qmd index issues, prefer qmd-adaptive-search qmd embed instead of this cleanup.',
    'For promotable suggestions you want to keep, prefer qmd-adaptive-search review --approve instead of discarding pending suggestions.'
  ];

  return {
    targets,
    actions,
    destructive: actions.some((action) => action.destructive),
    warnings,
    dryRunCommand: buildCommand(targets, { dryRun: true }),
    confirmCommand: buildCommand(targets, { yes: true }),
    nextCommandAfterCleanup: 'qmd-adaptive-search status'
  };
}

function runMaintenance(
  root: string,
  options: { targets?: unknown; dryRun?: boolean; yes?: boolean; planOnly?: boolean } = {}
): MaintenanceResult {
  const plan = maintenancePlan(root, options);
  const before = countLearnedState(root);

  if (options.dryRun || options.planOnly) {
    return { ok: true, dryRun: true, plan, before };
  }

  if (!options.yes) {
    return {
      ok: false,
      confirmationRequired: true,
      plan,
      before,
      nextCommand: plan.confirmCommand
    };
  }

  if (!plan.destructive) {
    const status = adaptiveStatus({ root });
    return {
      ok: true,
      plan,
      before,
      after: before,
      actions: plan.actions.map((action) => ({
        target: action.target,
        diagnosisBucket: action.diagnosisBucket,
        file: action.file,
        beforeCount: action.beforeCount,
        afterCount: action.beforeCount,
        cleared: 0
      })),
      status,
      diagnosis: status.diagnosis
    };
  }

  const actions: MaintenanceActionResult[] = [];
  for (const action of plan.actions) {
    if (action.beforeCount > 0) clearTarget(root, action.target);
    const afterCount = countForTarget(root, action.target);
    actions.push({
      target: action.target,
      diagnosisBucket: action.diagnosisBucket,
      file: action.file,
      beforeCount: action.beforeCount,
      afterCount,
      cleared: action.beforeCount - afterCount
    });
  }

  const after = countLearnedState(root);
  const status = adaptiveStatus({ root });
  return {
    ok: true,
    plan,
    before,
    after,
    actions,
    status,
    diagnosis: status.diagnosis
  };
}

export { maintenancePlan, runMaintenance, normalizeTargets, countLearnedState };
