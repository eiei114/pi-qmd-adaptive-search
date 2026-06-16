import { GENERIC_TOKENS } from './diagnosis.js';

/**
 * Ranking guardrails damp low-information learned state so qmd and lexical
 * relevance stay authoritative. Shared aliases/boosts are reviewed explicitly
 * and keep higher caps.
 */
const LEARNED_BOOST_CAP = 0.15;
const SHARED_BOOST_CAP = 0.25;

type AliasStoreKind = 'shared' | 'learned';
type BoostStoreKind = 'shared' | 'learned';

function isGenericToken(term: string): boolean {
  return GENERIC_TOKENS.has(String(term || '').toLowerCase());
}

function expandAliasTerms(
  queryTerms: string[],
  key: string,
  values: unknown[],
  store: AliasStoreKind
): { terms: string[]; why: string | null; skipped: boolean } {
  const keyLower = key.toLowerCase();
  const valueTerms = (Array.isArray(values) ? values : []).map((value) => String(value).toLowerCase());
  const all = [keyLower, ...valueTerms];

  if (!all.some((term) => queryTerms.includes(term))) {
    return { terms: [], why: null, skipped: false };
  }

  if (store === 'learned' && isGenericToken(keyLower)) {
    return { terms: [], why: null, skipped: true };
  }

  if (store === 'shared') {
    return { terms: all, why: `matched alias: ${key}`, skipped: false };
  }

  const informative = all.filter((term) => !isGenericToken(term));
  if (informative.length === 0) {
    return { terms: [], why: null, skipped: true };
  }

  return { terms: informative, why: `matched alias: ${key}`, skipped: false };
}

function effectiveBoostValue(raw: number, store: BoostStoreKind): number {
  const value = Math.abs(Number(raw) || 0);
  if (value <= 0) return 0;
  const cap = store === 'shared' ? SHARED_BOOST_CAP : LEARNED_BOOST_CAP;
  return Number((cap * Math.tanh(value / cap)).toFixed(4));
}

export {
  LEARNED_BOOST_CAP,
  SHARED_BOOST_CAP,
  isGenericToken,
  expandAliasTerms,
  effectiveBoostValue
};
