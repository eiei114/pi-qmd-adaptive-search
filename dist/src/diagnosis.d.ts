/**
 * Tokens that carry little semantic value when used as learned aliases.
 * If many of these dominate the learned alias store, ranking drifts toward
 * generic matches and search quality degrades.
 */
declare const GENERIC_TOKENS: ReadonlySet<string>;
type Severity = 'ok' | 'warning' | 'critical';
export interface DiagnosisBucket {
    name: string;
    severity: Severity;
    message: string;
    recoveryAction: string | null;
    details: Record<string, unknown>;
}
export interface DiagnosisSummary {
    health: Severity;
    buckets: DiagnosisBucket[];
}
/**
 * Run a diagnosis pass on the learned state, embed debt, and search history.
 * Returns a compact summary suitable for the status flow and maintainer review.
 *
 * @param root Project root directory
 * @param config Optional pre-loaded config (avoided re-read if caller already has it)
 * @param qmd   Optional pre-detected qmd info (avoided re-detect if caller already has it)
 */
declare function diagnoseSearchQuality(root: string, config?: any, qmd?: any): DiagnosisSummary;
export { diagnoseSearchQuality, GENERIC_TOKENS };
