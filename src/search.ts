import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { initProject, loadConfig, paths } from './config.js';
import { qmdSearch, installInstructions } from './qmd.js';
import { readJson, writeJson, toPosix } from './fs-utils.js';
import { backgroundJobStatusSummary, finishQmdSearchJob, readJobState, startQmdSearchJob } from './job-state.js';
import { expandAliasTerms, effectiveBoostValue } from './ranking-guardrails.js';

const TEXT_EXTS = new Set(['.md', '.txt', '.ts', '.tsx', '.js', '.py', '.json', '.yaml', '.yml']);

function tokenize(value) {
  return Array.from(new Set(String(value || '').toLowerCase().split(/[\s\p{P}\p{S}]+/u).filter((t) => t.length >= 2).slice(0, 12)));
}

function inferMode(query, requested = 'auto') {
  if (requested && requested !== 'auto') return requested;
  const q = String(query).toLowerCase();
  if (/まとめ|記事|draft|post|article|essay|note/.test(q)) return 'article';
  if (/仕様|決定|adr|計画|plan|spec|project|prd|roadmap/.test(q)) return 'project';
  if (/関連|広く|周辺|similar|related/.test(q)) return 'recall';
  if (/どこ|場所|file|path|exact/.test(q)) return 'precision';
  return 'auto';
}

function globToRegex(glob) {
  let out = '^';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    const next = glob[i + 1];
    if (c === '*' && next === '*') {
      const after = glob[i + 2];
      if (after === '/') {
        out += '(?:.*/)?';
        i += 2;
      } else {
        out += '.*';
        i += 1;
      }
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }
  out += '$';
  return new RegExp(out);
}

function matchesAny(rel, globs) {
  return globs.some((glob) => globToRegex(toPosix(glob)).test(rel));
}

function shouldInclude(rel, config) {
  const posix = toPosix(rel);
  if (matchesAny(posix, config.excludeGlobs || [])) return false;
  if (!matchesAny(posix, config.fileGlobs || [])) return false;
  return TEXT_EXTS.has(path.extname(posix).toLowerCase());
}

function walkFiles(root, config, dir = root, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = toPosix(path.relative(root, abs));
    if (rel.startsWith('.git/') || rel.includes('/node_modules/')) continue;
    if (entry.isDirectory()) walkFiles(root, config, abs, output);
    else if (entry.isFile() && shouldInclude(rel, config)) output.push(rel);
  }
  return output;
}

function readLead(root, rel, maxChars) {
  try {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    const lead = text.match(/^lead:\s*(.+)$/m);
    const body = text.replace(/^---[\s\S]*?---\s*/m, '').split(/\r?\n/).find((line) => line.trim() && !line.trim().startsWith('#')) || '';
    return String((lead && lead[1]) || body).trim().slice(0, maxChars);
  } catch {
    return '';
  }
}

function highlights(root, rel, terms, maxPer, maxChars) {
  try {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    const lines = text.split(/\r?\n/);
    const hits = [];
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (terms.some((term) => lower.includes(term))) hits.push(line.trim().slice(0, maxChars));
      if (hits.length >= maxPer) break;
    }
    return hits;
  } catch {
    return [];
  }
}

function loadAliasTerms(root, queryTerms) {
  const p = paths(root);
  const stores: Array<{ kind: 'shared' | 'learned'; data: { aliases?: Record<string, unknown> } }> = [
    { kind: 'shared', data: readJson(p.sharedAliases, { aliases: {} }) },
    { kind: 'learned', data: readJson(p.learnedAliases, { aliases: {} }) }
  ];
  const expanded = new Set(queryTerms);
  const why = [];
  for (const { kind, data } of stores) {
    for (const [key, values] of Object.entries(data.aliases || {})) {
      const result = expandAliasTerms(queryTerms, key, Array.isArray(values) ? values : [], kind);
      for (const term of result.terms) expanded.add(term);
      if (result.why) why.push(result.why);
    }
  }
  return { terms: Array.from(expanded), why };
}

function loadBoosts(root) {
  const p = paths(root);
  return [
    ...Object.entries(readJson(p.sharedBoosts, { boosts: {} }).boosts || {}).map(([boostPath, value]) => [boostPath, value, 'shared']),
    ...Object.entries(readJson(p.learnedBoosts, { boosts: {} }).boosts || {}).map(([boostPath, value]) => [boostPath, value, 'learned'])
  ];
}

function scoreFile(root, rel, terms, scopeHints, mode, boostEntries) {
  const baseName = path.basename(rel).toLowerCase();
  const relLower = rel.toLowerCase();
  let score = 0;
  const source = [];
  const why = [];
  for (const term of terms) {
    if (baseName.includes(term)) { score += 0.22; source.push('filename'); }
    if (relLower.includes(term)) { score += 0.12; source.push('path'); }
  }
  if (score < 0.01) {
    try {
      const sample = fs.readFileSync(path.join(root, rel), 'utf8').slice(0, 20000).toLowerCase();
      for (const term of terms) if (sample.includes(term)) { score += 0.08; source.push('content'); }
    } catch {}
  }
  for (const hint of scopeHints) {
    const h = toPosix(hint).toLowerCase();
    if (h && relLower.startsWith(h.replace(/\/$/, ''))) { score += 0.25; source.push('boost'); why.push(`scope boost: ${hint}`); }
    else if (h && relLower.includes(h)) { score += 0.12; source.push('boost'); why.push(`scope keyword: ${hint}`); }
  }
  for (const entry of boostEntries) {
    const boostPath = entry[0];
    const value = entry[1];
    const store = entry[2] as 'shared' | 'learned';
    if (rel === boostPath || relLower.startsWith(toPosix(boostPath).toLowerCase())) {
      const raw = Number(value) || 0.05;
      score += effectiveBoostValue(raw, store);
      source.push('boost');
      why.push(`${store} boost: ${boostPath}`);
    }
  }
  if (/archive|_archive|old|deprecated/i.test(rel)) { score -= 0.12; why.push('archive penalty'); }
  if (mode === 'article' && /\.md$|\.txt$|docs?\//i.test(rel)) score += 0.08;
  if (mode === 'project' && /prd|spec|adr|readme|plan|docs?\//i.test(rel)) score += 0.1;
  return { score: Math.max(0, score), source: Array.from(new Set(source)), why };
}

type RankedCandidate = {
  path: string;
  score: number;
  source: string[];
  why: string[];
};

/**
 * MVP fusion step: combine qmd-ranked candidates with local lexical scores,
 * then rerank by total score. Named for the PRD pipeline; uses additive fusion.
 */
function rrfFuseCandidates(
  qmdResults: RankedCandidate[],
  localResults: RankedCandidate[],
  aliasWhy: string[] = []
): RankedCandidate[] {
  const byPath = new Map<string, RankedCandidate>();
  for (const result of qmdResults || []) {
    byPath.set(result.path, { ...result });
  }
  for (const local of localResults || []) {
    const existing = byPath.get(local.path) || { path: local.path, score: 0, source: [], why: [] };
    if (local.score > 0 || existing.score > 0) {
      byPath.set(local.path, {
        path: local.path,
        score: existing.score + local.score,
        source: Array.from(new Set([...(existing.source || []), ...(local.source || [])])),
        why: [...(existing.why || []), ...aliasWhy, ...(local.why || [])]
      });
    }
  }
  return Array.from(byPath.values())
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);
}

function rememberSearch(root, config, record) {
  const p = paths(root);
  const now = Date.now();
  const ttl = (config.feedback?.recentSearchTtlMinutes || 30) * 60 * 1000;
  const max = config.feedback?.recentSearchMaxEntries || 20;
  const current = readJson(p.recentSearches, { searches: [] });
  const searches = (current.searches || []).filter((s) => Date.parse(s.expiresAt) > now);
  searches.unshift({ ...record, id: randomUUID(), createdAt: new Date(now).toISOString(), expiresAt: new Date(now + ttl).toISOString() });
  writeJson(p.recentSearches, { searches: searches.slice(0, max) });
}

function adaptiveSearch(input, options: any = {}) {
  const root = options.root || process.cwd();
  initProject(root);
  const config = loadConfig(root);
  const warnings = [];
  const maxResults = Math.min(Number(input.maxResults || config.search.defaultMaxResults || 10), Number(config.search.hardMaxResults || 30));
  const mode = inferMode(input.query, input.mode || config.search.defaultModeBias || 'auto');
  const scopeHints = Array.isArray(input.scopeHint) ? input.scopeHint : (input.scopeHint ? [input.scopeHint] : []);
  const queryTerms = tokenize(input.query);
  const alias = loadAliasTerms(root, queryTerms);
  const terms = alias.terms;
  const boostEntries = loadBoosts(root);

  const useQueryFallback = config.search?.qmdQueryFallback === true || ['article', 'project', 'recall'].includes(mode);
  const qmdJob = startQmdSearchJob(root, { mode, maxResults, scopeHints });
  const qmd = qmdSearch(input.query, maxResults, config, root, { useQueryFallback });
  finishQmdSearchJob(root, qmdJob, qmd);
  if (!qmd.detected.available) warnings.push(installInstructions());
  else if (qmd.error) warnings.push(`qmd search failed; fallback used: ${String(qmd.error).slice(0, 240)}`);

  const qmdCandidates: RankedCandidate[] = [];
  for (const result of qmd.results || []) {
    if (fs.existsSync(path.join(root, result.path)) && shouldInclude(result.path, config)) {
      qmdCandidates.push(result);
    }
  }
  const localCandidates: RankedCandidate[] = [];
  for (const rel of walkFiles(root, config)) {
    const local = scoreFile(root, rel, terms, scopeHints, mode, boostEntries);
    localCandidates.push({ path: rel, ...local });
  }

  const results = rrfFuseCandidates(qmdCandidates, localCandidates, alias.why)
    .slice(0, maxResults)
    .map((r) => ({
      path: r.path,
      title: path.basename(r.path, path.extname(r.path)).replace(/[-_]/g, ' '),
      score: Number(Math.min(0.99, r.score).toFixed(3)),
      source: r.source.length ? r.source : ['fallback'],
      why: Array.from(new Set(r.why)).slice(0, 5),
      lead: readLead(root, r.path, config.search.maxLeadChars || 300),
      highlights: highlights(root, r.path, terms, config.search.maxHighlightsPerResult || 2, config.search.maxHighlightChars || 240)
    }));

  rememberSearch(root, config, { mode, resultPaths: results.map((r) => r.path), anchors: queryTerms });
  const backgroundJobStatus = backgroundJobStatusSummary(readJobState(root));
  return { results, warnings, backgroundJobStatus };
}

export { adaptiveSearch, inferMode, tokenize, walkFiles, globToRegex, scoreFile, rrfFuseCandidates };
