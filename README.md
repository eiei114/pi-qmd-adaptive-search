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

## Runtime behavior

### With qmd installed

When qmd is available, search uses it first:

1. Detect qmd from `.qmd-adaptive-search/config.json` `qmdCommand`, a Windows `qmd.cmd` shim, or `qmd` on `PATH`.
2. Run `qmd search <query> -n <max>`.
3. In `article`, `project`, or `recall` mode, fall back to `qmd query <query> -n <max>` if `qmd search` returns no parseable file paths. You can also force this behavior with `search.qmdQueryFallback: true`.
4. Merge qmd hits with local filename/path/content scoring, scope boosts, shared boosts, and learned boosts.

qmd result lines must contain either a `qmd://.../<path>` URI or a project file path. Paths outside the current project or files excluded by `fileGlobs` / `excludeGlobs` are ignored.

### Without qmd installed

Missing qmd is supported. Search still:

- creates `.qmd-adaptive-search/` on first run;
- scans files matching `fileGlobs` and not matching `excludeGlobs`;
- ranks filename, path, content, scope hints, aliases, and boosts;
- returns JSON `results`, plus a warning beginning with `qmd was not found.` and install/config guidance.

Expected trade-off: fallback search is lexical, not semantic. It is useful for file discovery and obvious content matches, but vague intent-based queries improve when qmd is installed and indexed.

### Background jobs

The current MVP does not start background collection setup, collection update, embedding, watcher, idle, process, or subagent jobs. `backgroundJobs` is currently an empty array, and `qmd-adaptive-search status` reports only the local job-state file if one exists.

Treat the `indexing`, `idle`, and `changeDetection` config fields as forward-compatible settings for future orchestration. For now, run qmd setup/update/embed commands manually using qmd's own documentation, then use `qmd-adaptive-search status` and `qmd-adaptive-search search ...` to verify this package's behavior.

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

## Team feedback sharing guide

Use this flow when you want local search feedback to become a safe, reviewable team hint:

1. Run a search and pick the useful result.
   ```bash
   qmd-adaptive-search search "export decision" --scope docs --max 10
   qmd-adaptive-search feedback --selected docs/decisions/export.md --rating good
   ```
2. Keep using the tool locally. `feedback` immediately updates local learned boosts and aliases under `.qmd-adaptive-search/local/`, but those files are ignored by git.
3. Review pending suggestions before sharing.
   ```bash
   qmd-adaptive-search review
   ```
4. Approve only suggestions that are safe and broadly useful.
   ```bash
   qmd-adaptive-search review --approve
   ```
5. Commit only the shared files that changed:
   ```bash
   git diff -- .qmd-adaptive-search/shared-aliases.json .qmd-adaptive-search/shared-boosts.json
   git add .qmd-adaptive-search/shared-aliases.json .qmd-adaptive-search/shared-boosts.json
   git commit -m "Share adaptive search feedback"
   ```

### What gets shared

Approved positive feedback can update two commit-friendly files:

- `.qmd-adaptive-search/shared-aliases.json` maps extracted query anchors to filename terms, helping future vague searches match team vocabulary.
- `.qmd-adaptive-search/shared-boosts.json` adds small path scores, helping known-good files rank higher.

Example alias diff:

```diff
 {
   "aliases": {
+    "export": ["data", "portability", "decision"]
   }
 }
```

Example boost diff:

```diff
 {
   "boosts": {
+    "docs/decisions/export.md": 0.05
   }
 }
```

Review these diffs like code. Prefer stable project terms and durable docs. Avoid one-off personal phrasing, private project codenames, customer names, secrets, or paths that reveal sensitive work.

### Privacy checks before sharing

Before `review --approve` and commit, confirm:

- The suggestion does not expose private terms through shared aliases.
- The boosted path is safe for every teammate who can read the repo.
- The hint helps future searches beyond your current task.
- The suggestion came from a real recent result, or you used `--force` intentionally for a low-confidence manual hint.

Raw query text, snippets, answer text, file contents, and query hashes are not persisted. Pending suggestions contain extracted anchors and selected project-relative paths, so still review them before sharing.

### Privacy preset intent

Use the `privacy` preset when a repo should avoid automatic indexing/update behavior and keep learning local until an explicit review:

```bash
qmd-adaptive-search configure --preset privacy
```

The preset disables automatic update/embed settings, disables the local file manifest, keeps pending learning local, and leaves shared writes behind explicit `review --approve`. It is useful for sensitive notes, client work, or repos where teammates want manual control over what search state is generated and shared.

### Bad feedback policy

Bad feedback is intentionally conservative in the MVP:

```bash
qmd-adaptive-search feedback --selected docs/old-export-plan.md --rating bad
qmd-adaptive-search review
```

Negative feedback is stored in pending suggestions for review context only. It does not apply a negative ranking, suppress paths, or write shared demotions yet. Treat bad feedback as a signal to inspect why a result was misleading, then fix the safer source of noise: rename unclear files, improve docs, narrow `fileGlobs`, add `excludeGlobs`, or avoid approving aliases/boosts that would reinforce the bad match.

Check state:

```bash
qmd-adaptive-search status
```

## Troubleshooting

### `qmd was not found`

This is not fatal. The command used fallback search.

Check:

```bash
qmd-adaptive-search status
qmd --version
qmd-adaptive-search install-instructions
```

Fix options:

```bash
npm install -g @tobilu/qmd
# or
bun add -g @tobilu/qmd
```

If qmd is installed in a custom location, set `qmdCommand` in `.qmd-adaptive-search/config.json`:

```json
{
  "qmdCommand": ["node", "path/to/qmd.js"]
}
```

### `qmd search failed; fallback used`

The qmd executable was found, but `qmd search` or `qmd query` failed or timed out. The command still returned fallback results.

Check:

```bash
qmd-adaptive-search status
qmd status
qmd search "product decisions" -n 5
```

If qmd works but needs more time, raise `search.qmdSearchTimeoutMs` or `search.qmdQueryTimeoutMs` in `.qmd-adaptive-search/config.json`.

### Results miss obvious files

Check that the files are included by config and not excluded:

```bash
qmd-adaptive-search status
qmd-adaptive-search configure --preset mixed
qmd-adaptive-search search "exact term from the file" --scope docs --max 20
```

Common causes:

- file extension is not in `fileGlobs`;
- path matches `excludeGlobs` such as `dist/**`, `build/**`, `coverage/**`, `node_modules/**`, or `*.lock`;
- query is too vague for fallback mode and qmd is not installed/indexed;
- qmd output did not include parseable project-relative paths.

### Feedback or review does not affect teammates

`feedback` writes local learned aliases/boosts under `.qmd-adaptive-search/local/`, which is ignored by git. To share suggestions, review and approve them:

```bash
qmd-adaptive-search review
qmd-adaptive-search review --approve
```

Approved shared aliases/boosts are written to commit-friendly files in `.qmd-adaptive-search/`.

## Known limitations

- qmd installation is optional, but true semantic search depends on qmd being installed and usable in the project.
- Collection setup, collection update, embedding orchestration, idle scheduling, and background jobs are not implemented in this MVP.
- There is no automatic watcher-driven reindex or refresh queue yet.
- qmd output parsing is path-based; non-path answer text is not converted into results.
- Fallback search reads a bounded sample of text files and uses simple lexical scoring, so it can miss semantic matches.
- Raw query text, snippets, and answer text are not persisted; this improves privacy but limits history-based learning.
- Shared learning is explicit: local feedback stays local until `review --approve` promotes suggestions.
- File manifest and job-state files are local diagnostics, not authoritative qmd index state.

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
