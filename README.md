# qmd-adaptive-search

Project-local semantic file discovery using qmd when available, plus filename/content fallback and local feedback learning.

Initial version: `0.1.0` — usable MVP, not stable 1.0. Breaking changes may occur during `0.x`.

## Install / run

```bash
npm install -g qmd-adaptive-search
qmd-adaptive-search search "where is the product spec?"
```

From source:

```bash
node bin/qmd-adaptive-search.js search "related notes" --scope docs --max 10
```

## Commands

```text
qmd-adaptive-search init
qmd-adaptive-search search <query> [--mode auto|precision|recall|article|project] [--scope <path>] [--max 10]
qmd-adaptive-search feedback --selected <path[,path]> [--rating good|bad] [--force]
qmd-adaptive-search status
qmd-adaptive-search configure --preset docs|mixed|code|privacy [--reset]
qmd-adaptive-search review [--approve]
qmd-adaptive-search install-qmd [--manager bun|npm|pnpm|yarn] [--yes]
```

MCP-style names are accepted as CLI aliases:

- `qmd_adaptive_search`
- `qmd_search_feedback`
- `qmd_adaptive_status`

## Storage

Lightweight init creates:

```text
.qmd-adaptive-search/
  config.json
  shared-aliases.json
  shared-boosts.json
  local/
  logs/
```

`local/` and `logs/` are added to `.gitignore`. Shared config/aliases/boosts can be committed.

Privacy rules:

- raw queries are not stored
- query hashes are not stored
- snippets/highlights are returned only, not persisted
- file manifest stores only project-relative paths, mtimes, and sizes when enabled

## Search policy

Use this for vague, semantic, intent-based, or context-seeking search across project files. For exact symbol/string search, prefer `rg`, `grep`, or editor search.

If qmd is missing or fails, the tool returns fallback results and install instructions instead of blocking.

## Library API

```js
const { adaptiveSearch, recordFeedback, adaptiveStatus } = require('qmd-adaptive-search');

const found = adaptiveSearch({ query: 'workout product decisions', scopeHint: 'docs' });
recordFeedback({ selectedPaths: [found.results[0].path], rating: 'good' });
console.log(adaptiveStatus());
```

## Presets

- `docs`: Markdown/text notes and docs
- `mixed`: docs + common source/config files
- `code`: source-heavy repos
- `privacy`: manual indexing and minimal local state
