# pi-qmd-adaptive-search

[![npm version](https://img.shields.io/npm/v/pi-qmd-adaptive-search?color=cb3837&label=npm)](https://www.npmjs.com/package/pi-qmd-adaptive-search)
[![npm downloads](https://img.shields.io/npm/dm/pi-qmd-adaptive-search)](https://www.npmjs.com/package/pi-qmd-adaptive-search)
[![CI](https://github.com/eiei114/pi-qmd-adaptive-search/actions/workflows/ci.yml/badge.svg)](https://github.com/eiei114/pi-qmd-adaptive-search/actions/workflows/ci.yml)
[![Publish](https://github.com/eiei114/pi-qmd-adaptive-search/actions/workflows/publish.yml/badge.svg)](https://github.com/eiei114/pi-qmd-adaptive-search/actions/workflows/publish.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Pi package](https://img.shields.io/badge/pi-package-purple)](#pi-installation)
[![Trusted Publishing](https://img.shields.io/badge/Trusted%20Publishing-GitHub%20OIDC-4c1)](#release)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/status-MVP%200.x-orange)](#versioning-policy)
[![GitHub](https://img.shields.io/badge/GitHub-eiei114%2Fpi--qmd--adaptive--search-blue)](https://github.com/eiei114/pi-qmd-adaptive-search)

Project-local semantic file discovery for notes, docs, specs, plans, decisions, and other project files.

## What this is

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
- Safe Pi tool output: compact path-first results; snippets omitted by default.

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

## Usage summary

- `qmd-adaptive-search init`: bootstrap lightweight config files.
- `qmd-adaptive-search search "<query>"`: run a search locally (full JSON; add `--mode` or `--scope` to guide results).
- `qmd_adaptive_search` (Pi tool): same search with compact path-first output for agents.
- `qmd-adaptive-search feedback --selected <path> --rating good`: record useful results locally.
- `qmd-adaptive-search review --approve`: promote safe shared aliases/boosts.
- `qmd-adaptive-search status`: inspect qmd availability and recent job state.
- Use `qmd-adaptive` as a short alias for `qmd-adaptive-search search`.
- In Pi TUI, use `/qmd-a:configure` to choose a preset from `docs`, `mixed`, `code`, or `privacy` without typing the preset name.

For the full command list, see [CLI](#cli).

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
- applies ranking guardrails so low-information learned aliases and runaway learned boosts cannot drown out lexical relevance;
- returns JSON `results`, plus a warning beginning with `qmd was not found.` and install/config guidance.

Expected trade-off: fallback search is lexical, not semantic. It is useful for file discovery and obvious content matches, but vague intent-based queries improve when qmd is installed and indexed.

### Ranking guardrails

Search applies maintainer-tunable guardrails so polluted local learning does not overpower qmd and lexical relevance:

- **Learned aliases**: keys in the low-information token set (for example `content`, `templates`, `post`) are ignored for query expansion. Informative learned aliases still expand, but generic alias values are filtered out. Reviewed shared aliases are unchanged.
- **Learned boosts**: each path contribution is soft-capped (`LEARNED_BOOST_CAP = 0.15`) with `tanh` saturation so repeated feedback cannot create runaway dominance. Shared boosts use a higher cap (`SHARED_BOOST_CAP = 0.25`) because they were explicitly approved.
- **Diagnosis alignment**: `qmd-adaptive-search status` diagnosis buckets surface the same generic tokens and runaway boost threshold (`|value| >= 0.5`) so maintainers can prune state before ranking guardrails need to compensate.

Tuning lives in `src/ranking-guardrails.ts`. Change caps there intentionally and add regression tests when adjusting behavior.

### qmd setup/update/embed safety

Heavy qmd operations never run implicitly. Use `status` to see the next recommended qmd step and a safe command to inspect the plan:

```bash
qmd-adaptive-search status
qmd-adaptive-search qmd setup --dry-run
qmd-adaptive-search qmd update --dry-run
qmd-adaptive-search qmd embed --dry-run
```

Each plan shows the target, side effects, estimated time, the qmd command that would run, and the next command to use after failure. Running without `--dry-run` prompts for confirmation. Non-interactive runs must pass `--yes` explicitly:

```bash
qmd-adaptive-search qmd setup --yes
qmd-adaptive-search qmd update --yes
qmd-adaptive-search qmd embed --yes
```

`setup` creates or updates a qmd collection for the current project path, `update` re-indexes qmd collections, and `embed` generates missing vector embeddings. Failures return a human-readable error plus the next safe command.

### Background jobs

The current MVP does not start long-running collection setup, collection update, embedding, watcher, idle, process, or subagent jobs. It does record each synchronous qmd search/query attempt in `.qmd-adaptive-search/local/job-state.json`, including the last job, pending/running jobs, failures, qmd command metadata, result counts, and recovery hints.

`qmd-adaptive-search search ...` returns a compact `backgroundJobStatus` summary (pending/failed counts, last search status, qmd fallback). `qmd-adaptive-search status` expands job state into full `backgroundJobs`, `pendingBackgroundJobs`, `failedBackgroundJobs`, `lastBackgroundJob`, `lastSearchJob`, and `recoveryHints`.

Treat the `indexing`, `idle`, and `changeDetection` config fields as forward-compatible settings for future orchestration. Use the explicit `qmd-adaptive-search qmd setup|update|embed --dry-run` plan commands before running qmd maintenance.

## Safe search output

Search serves two UX paths: **Pi tools** for agent context safety and the **CLI** for local inspection.

### Pi tool default (`qmd_adaptive_search`)

- Returns compact, path-first plain text (not a pretty-printed JSON dump).
- Structured `details` include `resultCount`, `resultPaths`, per-result `path` / `title` / `score` / `source` / `why`, `warnings`, and an optional compact `backgroundJobStatus`.
- `lead` and `highlights` are intentionally omitted from returned output so search stays file discovery, not a partial read tool.
- `maxResults` defaults to `10` and is hard-capped at `30`.

Example tool text:

```text
qmd_adaptive_search: 2 result(s)
1. docs/ProductSpec.md
   title: ProductSpec | score: 0.45 | source: filename, path
   why: matched alias: product; scope boost: docs
2. README.md
   title: README | score: 0.12 | source: path
   why: scope boost: docs

Warnings:
- qmd was not found; using fallback search only.

Background jobs: qmd fallback used (use qmd_adaptive_status for details).
```

### Snippets and output caps

| Surface | Snippets in returned output | How to get content |
| --- | --- | --- |
| Pi tool `qmd_adaptive_search` | Omitted by design | Read returned paths with your file-read tool after discovery |
| CLI `qmd-adaptive-search search` | Bounded `lead` / `highlights` in JSON | Local debugging or scripting only |

CLI snippet fields are capped by `.qmd-adaptive-search/config.json` `search.*` settings (defaults shown):

| Setting | Default | Purpose |
| --- | --- | --- |
| `search.maxLeadChars` | `300` | Max characters per `lead` |
| `search.maxHighlightsPerResult` | `2` | Max highlight lines per result |
| `search.maxHighlightChars` | `240` | Max characters per highlight line |
| `search.hardMaxResults` | `30` | Hard cap on result count |

Returned snippets are never persisted. See [Privacy model](#privacy-model).

### Background job summary vs status tool

| Need | Use |
| --- | --- |
| Quick hint during search (fallback used, failures) | `backgroundJobStatus` on `qmd_adaptive_search` |
| Full job arrays, recovery hints, qmd health, learning counts | `qmd_adaptive_status` |

`qmd_adaptive_search` shows a one-line background-job note only when qmd fallback was used or a job failed. Pending counts alone do not expand tool output. For `backgroundJobs`, `pendingBackgroundJobs`, `failedBackgroundJobs`, `lastBackgroundJob`, `lastSearchJob`, and `recoveryHints`, call `qmd_adaptive_status`.

## CLI

These commands are the scriptable CLI surface. In Pi TUI, prefer the `qmd-a:*` slash commands in the next section.

```text
qmd-adaptive-search init
qmd-adaptive-search search <query> [--mode auto|precision|recall|article|project] [--scope <path>] [--max 10]
qmd-adaptive-search feedback --selected <path[,path]> [--rating good|bad] [--force]
qmd-adaptive-search status
qmd-adaptive-search configure --preset docs|mixed|code|privacy [--reset]
qmd-adaptive-search review [--approve]
qmd-adaptive-search install-qmd [--manager bun|npm|pnpm|yarn] [--yes]
qmd-adaptive-search qmd setup|update|embed [--dry-run] [--yes]
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

### Pi tools

| Tool | Purpose | Default returned output |
| --- | --- | --- |
| `qmd_adaptive_search` | Semantic file discovery | Compact path-first text + lightweight `details` (no snippets) |
| `qmd_search_feedback` | Record useful result paths | JSON summary of feedback recorded |
| `qmd_adaptive_status` | Config, qmd health, learning, verbose job state | Full JSON status snapshot |

`qmd_adaptive_search` parameters: `query` (required), optional `mode`, `scopeHint`, `maxResults` (1–30, default 10). Raw query text is not persisted.

Pi slash commands (`qmd-a:*`) are the primary interactive UX:

| Command | Description |
| --- | --- |
| `/qmd-a:init` | Create lightweight config files |
| `/qmd-a:status` | Show qmd/config/learning status |
| `/qmd-a:review` | Show pending suggestions |
| `/qmd-a:approve` | Promote pending suggestions to shared aliases/boosts |
| `/qmd-a:configure` | Open a TUI preset picker for `docs`, `mixed`, `code`, or `privacy` |
| `/qmd-a:install` | Show qmd install guidance |
| `/qmd-a:setup` | Show qmd collection setup plan |
| `/qmd-a:setup-run` | Run qmd collection setup |
| `/qmd-a:update` | Show qmd update plan |
| `/qmd-a:update-run` | Run qmd update |
| `/qmd-a:embed` | Show qmd embed plan |
| `/qmd-a:embed-run` | Run qmd embed |

For scripts and headless runs, keep using CLI flags such as `qmd-adaptive-search review --approve` and `qmd-adaptive-search configure --preset privacy`. Space-argument and hyphen slash forms are not the primary Pi TUI path.

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

Pi TUI:

```text
/qmd-a:configure
```

Then choose `privacy` in the preset picker.

CLI/scripts:

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

Review qmd maintenance before running it:

```bash
qmd-adaptive-search qmd setup --dry-run
qmd-adaptive-search qmd setup --yes
qmd-adaptive-search qmd update --dry-run
qmd-adaptive-search qmd embed --dry-run
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
- Collection setup, collection update, and embedding are explicit plan/confirm commands only; automatic orchestration and idle scheduling are not implemented in this MVP. qmd search and confirmed qmd operations record lightweight local job state for status/recovery visibility.
- There is no automatic watcher-driven reindex or refresh queue yet.
- qmd output parsing is path-based; non-path answer text is not converted into results.
- Fallback search reads a bounded sample of text files and uses simple lexical scoring, so it can miss semantic matches.
- Raw query text, snippets, and answer text are not persisted; this improves privacy but limits history-based learning.
- Pi tool search output omits snippets by default; use path discovery first, then read files explicitly.
- Shared learning is explicit: local feedback stays local until `review --approve` promotes suggestions.
- File manifest and job-state files are local diagnostics, not authoritative qmd index state.

## Configuration presets

In Pi TUI, run `/qmd-a:configure` and choose a preset from the selector.

CLI/script equivalents:

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

### Pi tool (`qmd_adaptive_search`)

Primary agent UX is compact text plus lightweight `details`:

```json
{
  "resultCount": 1,
  "resultPaths": ["docs/ProductSpec.md"],
  "warnings": [],
  "results": [
    {
      "path": "docs/ProductSpec.md",
      "title": "ProductSpec",
      "score": 0.91,
      "source": ["qmd", "filename", "boost"],
      "why": ["scope boost: docs"]
    }
  ],
  "backgroundJobStatus": {
    "pendingCount": 0,
    "failedCount": 0,
    "running": false,
    "lastSearchStatus": null,
    "qmdFallbackUsed": false,
    "qmdAvailable": null
  }
}
```

`lead`, `highlights`, and verbose `backgroundJobs` arrays are excluded from tool output by design.

### CLI (`qmd-adaptive-search search`)

The CLI prints full search JSON for local use, including bounded `lead` / `highlights` per result:

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
  "backgroundJobStatus": {
    "pendingCount": 0,
    "failedCount": 0,
    "running": false,
    "lastSearchStatus": null,
    "qmdFallbackUsed": false,
    "qmdAvailable": null
  }
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

### Persistence privacy

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

### Returned-output safety

Even when search reads file content internally for ranking, returned output is bounded:

- Pi tool `qmd_adaptive_search` omits `lead` and `highlights` from both text and `details`.
- Result count is capped (`maxResults` default `10`, hard max `30`).
- CLI JSON includes only capped snippet fields (`search.maxLeadChars`, `search.maxHighlightsPerResult`, `search.maxHighlightChars`).
- Verbose background job arrays stay in `qmd_adaptive_status`, not in routine search tool output.

This complements persistence privacy: less note text enters chat history during discovery, and agents are steered toward explicit file reads after choosing paths.

## Package contents

The npm package ships:

- `bin/qmd-adaptive-search.js` (CLI entrypoint)
- `dist/src/` (compiled library)
- `extensions/` (Pi extension entrypoint)
- `src/` (TypeScript source for reference)
- `README.md`, `CHANGELOG.md`, `LICENSE`

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

## Release

Publishing to npm is automated by GitHub Actions. To publish a new version:

1. Update `version` in `package.json` and document user-visible changes in `CHANGELOG.md`.
2. Commit and tag the release, for example `v0.2.1`, or create a GitHub Release for that tag.
3. The `Publish to npm` workflow runs `npm run check`, skips if that exact version already exists on npm, and runs `npm publish --access public`.

The workflow supports npm trusted publishing via GitHub OIDC (see the Trusted Publishing badge). If trusted publishing is not configured on npm, add an `NPM_TOKEN` repository secret.

## Security

Please report vulnerabilities via [SECURITY.md](SECURITY.md). Avoid filing sensitive issues in public trackers.

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

## Links

- npm: https://www.npmjs.com/package/pi-qmd-adaptive-search
- GitHub: https://github.com/eiei114/pi-qmd-adaptive-search
- Issues: https://github.com/eiei114/pi-qmd-adaptive-search/issues
- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Security: [SECURITY.md](SECURITY.md)

## License

MIT
