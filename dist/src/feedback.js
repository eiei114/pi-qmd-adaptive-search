import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { initProject, loadConfig, paths } from './config.js';
import { readJson, writeJson, appendJsonLine, toPosix } from './fs-utils.js';
import { tokenize } from './search.js';
function normalizeSelected(input) {
    const values = input.selectedPaths || (input.selectedPath ? [input.selectedPath] : []);
    return Array.from(new Set(values.map((value) => toPosix(value).replace(/^\.\//, ''))));
}
function recentSearchFor(root, selectedPaths) {
    const current = readJson(paths(root).recentSearches, { searches: [] });
    const now = Date.now();
    return (current.searches || []).find((search) => Date.parse(search.expiresAt) > now && selectedPaths.every((p) => (search.resultPaths || []).includes(p)));
}
function addBoosts(root, selectedPaths, amount) {
    const p = paths(root);
    const current = readJson(p.learnedBoosts, { boosts: {} });
    for (const selectedPath of selectedPaths) {
        current.boosts[selectedPath] = Number(((current.boosts[selectedPath] || 0) + amount).toFixed(3));
    }
    writeJson(p.learnedBoosts, current);
}
function addAliases(root, anchors, selectedPaths) {
    const p = paths(root);
    const current = readJson(p.learnedAliases, { aliases: {} });
    const pathTerms = selectedPaths.flatMap((selectedPath) => tokenize(path.basename(selectedPath, path.extname(selectedPath))));
    for (const anchor of anchors) {
        const existing = new Set(current.aliases[anchor] || []);
        for (const term of pathTerms)
            if (term !== anchor)
                existing.add(term);
        if (existing.size > 0)
            current.aliases[anchor] = Array.from(existing).slice(0, 12);
    }
    writeJson(p.learnedAliases, current);
}
function recordFeedback(input, options = {}) {
    const root = options.root || process.cwd();
    initProject(root);
    loadConfig(root);
    const rating = input.rating || 'good';
    if (!['good', 'bad'].includes(rating))
        throw new Error('rating must be good or bad');
    const selectedPaths = normalizeSelected(input);
    if (selectedPaths.length === 0)
        throw new Error('selectedPaths or selectedPath is required');
    const matchedSearch = recentSearchFor(root, selectedPaths);
    const warnings = [];
    if (!matchedSearch && !input.force) {
        return { ok: false, rejected: true, warnings: ['selectedPaths are outside recent search results; use force:true for manual low-confidence feedback'] };
    }
    if (!matchedSearch && input.force)
        warnings.push('accepted forced feedback outside recent search with low confidence');
    const anchors = matchedSearch ? (matchedSearch.anchors || []) : tokenize(input.query || selectedPaths.join(' '));
    if (rating === 'good') {
        addBoosts(root, selectedPaths, matchedSearch ? 0.08 : 0.03);
        addAliases(root, anchors, selectedPaths);
    }
    appendJsonLine(paths(root).pendingSuggestions, {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        type: rating === 'good' ? 'positive-feedback' : 'negative-feedback',
        rating,
        selectedPaths,
        anchors,
        confidence: matchedSearch ? 0.7 : 0.25,
        note: rating === 'bad' ? 'stored for review only; no negative ranking applied in MVP' : 'local boost/alias applied; approve in review to share'
    });
    return { ok: true, selectedPaths, anchors, warnings };
}
function reviewSuggestions(options = {}) {
    const root = options.root || process.cwd();
    initProject(root);
    const p = paths(root);
    const suggestions = fs.existsSync(p.pendingSuggestions)
        ? fs.readFileSync(p.pendingSuggestions, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
        : [];
    return { count: suggestions.length, suggestions };
}
function approveSuggestions(options = {}) {
    const root = options.root || process.cwd();
    const p = paths(root);
    const review = reviewSuggestions({ root });
    const sharedAliases = readJson(p.sharedAliases, { aliases: {} });
    const sharedBoosts = readJson(p.sharedBoosts, { boosts: {} });
    for (const item of review.suggestions) {
        if (item.rating !== 'good')
            continue;
        for (const selectedPath of item.selectedPaths || [])
            sharedBoosts.boosts[selectedPath] = Number(((sharedBoosts.boosts[selectedPath] || 0) + 0.05).toFixed(3));
        for (const anchor of item.anchors || []) {
            const existing = new Set(sharedAliases.aliases[anchor] || []);
            for (const selectedPath of item.selectedPaths || [])
                for (const term of tokenize(path.basename(selectedPath, path.extname(selectedPath))))
                    existing.add(term);
            sharedAliases.aliases[anchor] = Array.from(existing).slice(0, 12);
        }
    }
    writeJson(p.sharedAliases, sharedAliases);
    writeJson(p.sharedBoosts, sharedBoosts);
    fs.writeFileSync(p.pendingSuggestions, '', 'utf8');
    return { ok: true, approved: review.suggestions.length };
}
export { recordFeedback, reviewSuggestions, approveSuggestions };
//# sourceMappingURL=feedback.js.map