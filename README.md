# pi-qmd-adaptive-search

[![npm version](https://img.shields.io/npm/v/pi-qmd-adaptive-search?color=cb3837&label=npm)](https://www.npmjs.com/package/pi-qmd-adaptive-search)
[![GitHub](https://img.shields.io/badge/GitHub-eiei114%2Fpi--qmd--adaptive--search-blue)](https://github.com/eiei114/pi-qmd-adaptive-search)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![CI](https://github.com/eiei114/pi-qmd-adaptive-search/actions/workflows/ci.yml/badge.svg)](https://github.com/eiei114/pi-qmd-adaptive-search/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-MVP%200.1.0-orange)](#versioning-policy)
[![Pi package](https://img.shields.io/badge/pi-package-purple)](#pi-installation)

Project-local semantic file discovery for notes, docs, specs, plans, decisions, and other project files.

`pi-qmd-adaptive-search` is a Pi package and CLI. It uses [`qmd`](https://github.com/tobilu/qmd) when available, then improves results with query expansion, aliases, learned path boosts, scope hints, and filename/content fallback. It is designed for vague searches such as “where did we decide this?”, “related notes”, or “the spec about export”.

> Initial version: `0.1.0`. Usable MVP, not stable 1.0. Breaking changes may occur during `0.x`.

## When to use

Use this for semantic or intent-based file discovery:

- “where is the product spec?”
- “notes about data portability”
- “previous decisions about onboarding”
- “similar files to this draft”
- “docs around the session duplication bug”

Prefer `rg`, `grep`, IDE search, or `find_files` for exact strings:

- function names
- type names
- exact error messages
- config keys
- known filenames

Rule of thumb:

```text
exact string/name  -> rg / grep / editor search
meaning/intent     -> qmd-adaptive-search
```

## Features

- Zero-config first search: creates lightweight local config automatically.
- qmd integration when installed.
- Safe fallback search when qmd is missing or fails.
- Modes: `auto`, `precision`, `recall`, `article`, `project`.
- `scopeHint` path/folder boosting.
- Local feedback learning via `feedback`.
- Shared aliases/boosts through explicit review.
- Privacy-first storage: raw queries are not persisted.

## Install

### Pi installation

Via npm, once published:

```bash
pi install npm:pi-qmd-adaptive-search
```

Or add to `.pi/settings.json`:

```json
{
  "packages": ["npm:pi-qmd-adaptive-search"]
}
```

From GitHub:

```bash
pi install git:github.com/eiei114/pi-qmd-adaptive-search
```

Or add to `.pi/settings.json`:

```json
{
  "packages": ["git:github.com/eiei114/pi-qmd-adaptive-search"]
}
```

### CLI installation

From npm, once published:

```bash
npm install -g pi-qmd-adaptive-search
```

From source:

```bash
git clone <repo-url> pi-qmd-adaptive-search
cd pi-qmd-adaptive-search
npm test
npm link
```

Optional semantic backend:

```bash
npm install -g @tobilu/qmd
# or
bun add -g @tobilu/qmd
```

If qmd is not installed, search still works with filename/content fallback and returns install guidance.

## Quick start

In a project repo:

```bash
qmd-adaptive-search search "where is the product spec?"
```

First run creates:

```text
.qmd-adaptive-search/
  config.json
  shared-aliases.json
  shared-boosts.json
  local/
  logs/
```

`local/` and `logs/` are added to `.gitignore`. `config.json`, `shared-aliases.json`, and `shared-boosts.json` can be committed.

## CLI

```text
qmd-adaptive-search init
qmd-adaptive-search search <query> [--mode auto|precision|recall|article|project] [--scope <path>] [--max 10]
qmd-adaptive-search feedback --selected <path[,path]> [--rating good|bad] [--force]
qmd-adaptive-search status
qmd-adaptive-search configure --preset docs|mixed|code|privacy [--reset]
qmd-adaptive-search review [--approve]
qmd-adaptive-search install-qmd [--manager bun|npm|pnpm|yarn] [--yes]
```

Short alias:

```bash
qmd-adaptive search "related docs" --scope docs --max 10
```

MCP-style command names are accepted as CLI aliases:

- `qmd_adaptive_search`
- `qmd_search_feedback`
- `qmd_adaptive_status`

When installed as a Pi package, these are registered as Pi tools as well.

Pi slash commands:

| Command | Description |
| --- | --- |
| `/qmd-adaptive-init` | Create lightweight config files |
| `/qmd-adaptive-status` | Show qmd/config/learning status |
| `/qmd-adaptive-review` | Show pending suggestions |
| `/qmd-adaptive-review approve` | Promote pending suggestions to shared aliases/boosts |
| `/qmd-adaptive-configure <preset>` | Apply `docs`, `mixed`, `code`, or `privacy` preset |
| `/qmd-adaptive-install-qmd` | Show qmd install guidance |

## Examples

Search project docs:

```bash
qmd-adaptive-search search "export and data portability decisions" --mode project --scope docs
```

Search broadly:

```bash
qmd-adaptive-search search "similar notes about onboarding" --mode recall --max 20
```

Record useful result feedback:

```bash
qmd-adaptive-search feedback --selected docs/ProductSpec.md --rating good
```

Review and share learned suggestions:

```bash
qmd-adaptive-search review
qmd-adaptive-search review --approve
```

Check state:

```bash
qmd-adaptive-search status
```

## Configuration presets

```bash
qmd-adaptive-search configure --preset docs
qmd-adaptive-search configure --preset mixed
qmd-adaptive-search configure --preset code
qmd-adaptive-search configure --preset privacy
```

| Preset | Best for |
| --- | --- |
| `docs` | Markdown/text notes and documentation |
| `mixed` | Docs plus common source/config files |
| `code` | Source-heavy repos with docs/specs |
| `privacy` | Manual indexing and minimal background behavior |

## Result shape

Search returns JSON:

```json
{
  "results": [
    {
      "path": "docs/ProductSpec.md",
      "title": "ProductSpec",
      "score": 0.91,
      "source": ["qmd", "filename", "boost"],
      "why": ["scope boost: docs"],
      "lead": "Short summary...",
      "highlights": ["Matching line..."]
    }
  ],
  "warnings": [],
  "backgroundJobs": []
}
```

## Library API

```js
const {
  adaptiveSearch,
  recordFeedback,
  adaptiveStatus
} = require('pi-qmd-adaptive-search');

const found = adaptiveSearch({
  query: 'workout product decisions',
  scopeHint: 'docs',
  maxResults: 10
});

recordFeedback({
  selectedPaths: [found.results[0].path],
  rating: 'good'
});

console.log(adaptiveStatus());
```

## Privacy model

Persisted:

- config
- shared aliases/boosts
- local learned aliases/boosts
- recent result paths + extracted anchors
- optional file manifest with project-relative path, modified time, and size

Not persisted:

- raw query text
- query hash
- returned snippets/highlights
- answer text
- file contents

## Repository layout

```text
bin/                    CLI entrypoint
src/                    TypeScript library implementation
  cli.ts                command routing
  config.ts             config/bootstrap/presets
  qmd.ts                qmd detection and search bridge
  search.ts             fallback search, ranking, result shaping
  feedback.ts           local learning and review promotion
  status.ts             status snapshot
extensions/index.ts     Pi extension entrypoint
dist/                   Compiled npm runtime output
test/                   TypeScript node:test coverage
```

## Development

Requirements:

- Node.js 20+
- npm

Commands:

```bash
npm test
npm run smoke
npm run build
node bin/qmd-adaptive-search.js search "product decisions" --max 3
```

## Versioning policy

```text
0.1.0 = usable MVP, not stable 1.0
0.1.x = bugfix/docs/small safe improvements
0.2.0 = config/schema changes or new command/tool
0.3.0+ = ranking/learning/setup UX changes
1.0.0 = stable schemas, config format, qmd setup UX, and migration story
```

## Roadmap

- Better qmd collection setup/update/embed orchestration.
- Background refresh queue with safer process/subagent/manual fallback.
- Interactive suggestion review UI.
- Stronger language-aware query expansion.
- File-type metadata extraction for headings, frontmatter, comments, package names.
- MCP server wrapper for tool-native usage.

## License

MIT
