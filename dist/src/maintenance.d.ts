import { diagnoseSearchQuality } from './diagnosis.js';
import { adaptiveStatus } from './status.js';
/** Local learned-state targets aligned with diagnosis bucket vocabulary. */
export declare const MAINTENANCE_TARGETS: readonly ["learned-aliases", "learned-boosts", "pending-suggestions"];
export type MaintenanceTarget = (typeof MAINTENANCE_TARGETS)[number];
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
declare function countLearnedState(root: string): LearnedStateCounts;
declare function normalizeTargets(input: unknown): MaintenanceTarget[];
declare function maintenancePlan(root: string, options?: {
    targets?: unknown;
}): MaintenancePlan;
declare function runMaintenance(root: string, options?: {
    targets?: unknown;
    dryRun?: boolean;
    yes?: boolean;
    planOnly?: boolean;
}): MaintenanceResult;
export { maintenancePlan, runMaintenance, normalizeTargets, countLearnedState };
