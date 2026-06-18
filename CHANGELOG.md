# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added

- Maintainer cleanup workflow via `qmd-adaptive-search maintain` and `/qmd-a:maintain` / `/qmd-a:maintain-run` for resetting polluted local learned aliases, learned boosts, and stale pending suggestions without hand-editing files under `.qmd-adaptive-search/local/`.
- Explicit confirmation (`--yes` or interactive prompt) before destructive cleanup, plus dry-run plans and post-cleanup status counts aligned with diagnosis bucket vocabulary.
- Tests for cleanup behavior, confirmation boundaries, and shared-state safety.

### Changed

- Diagnosis recovery guidance now points maintainers to the maintenance workflow instead of manual JSON edits when learned state is polluted.

## [1.1.2] - 2026-06-17

### Added

- Ranking guardrails that ignore low-information learned alias keys, filter generic learned alias values, and soft-cap learned boosts so polluted local state cannot dominate unrelated searches.
- Regression tests for polluted learned state and informative learned alias success cases.
- Maintainer documentation for ranking guardrail behavior and tuning points in `src/ranking-guardrails.ts`.

## [1.1.1] - 2026-06-09

### Changed

- Release hygiene: complete `CHANGELOG.md` coverage for the safe-output slices (compact tool output, snippet-safe defaults, background job summary, and output contract docs) and align `[1.1.0]` release notes with `package.json`.

## [1.1.0] - 2026-06-08

### Added

- `/qmd-a:configure` now opens a Pi TUI preset picker for `docs`, `mixed`, `code`, and `privacy` when no argument is supplied.

### Changed

- README now presents `qmd-a:*` colon slash commands as the primary Pi UX and labels CLI flag forms as script/headless usage.

## [1.0.1] - 2026-06-06

### Added

- Maintainer-facing diagnosis pass (`diagnosis` field in `qmd_adaptive_status` output) that surfaces learned alias pollution, learned boost pollution, pending suggestion backlog, missing embeddings, and search history health in one summary.
- Recovery guidance for each diagnosis bucket, pointing maintainers to the next safe action.
- Search history diagnosis distinguishes current completed searches from stale failed/fallback history.
- Exported `diagnoseSearchQuality()` from the library API for programmatic access.

### Changed

- Document the safe search output contract: Pi tool path-first default, snippet omission, output caps, and `qmd_adaptive_status` for verbose background job details.

## [1.0.0] - 2026-06-04

### Breaking Changes

Removed deprecated Pi slash commands that were kept for one release after `0.3.0`. Use the `qmd-a:*` colon commands instead:

| Removed | Use instead |
| --- | --- |
| `/qmd-adaptive-init` | `/qmd-a:init` |
| `/qmd-adaptive-status` | `/qmd-a:status` |
| `/qmd-adaptive-review` | `/qmd-a:review` |
| `/qmd-adaptive-review approve` | `/qmd-a:approve` |
| `/qmd-adaptive-configure <preset>` | `/qmd-a:configure` |
| `/qmd-adaptive-install-qmd` | `/qmd-a:install` |
| `/qmd-adaptive-qmd-setup` | `/qmd-a:setup` |
| `/qmd-adaptive-qmd-setup --yes` | `/qmd-a:setup-run` |
| `/qmd-adaptive-qmd-update` | `/qmd-a:update` |
| `/qmd-adaptive-qmd-update --yes` | `/qmd-a:update-run` |
| `/qmd-adaptive-qmd-embed` | `/qmd-a:embed` |
| `/qmd-adaptive-qmd-embed --yes` | `/qmd-a:embed-run` |

CLI subcommands (`qmd-adaptive-search init`, `review --approve`, etc.) and the `.qmd-adaptive-search/` config directory are unchanged.

### Changed

- `adaptiveSearch` and `qmd_adaptive_search` return a compact `backgroundJobStatus` summary instead of verbose `backgroundJobs` arrays; full job objects and recovery hints remain available via `qmd_adaptive_status`.

## [0.3.2] - 2026-06-03

### Changed

- `qmd_adaptive_search` Pi tool now returns compact, path-first text by default instead of a pretty-printed JSON dump of the full search payload.
- Default Pi tool output omits per-result `lead` and `highlights` (snippet-safe path discovery mode).
- Tool `details` keeps lightweight `resultPaths` and per-result metadata for `qmd_search_feedback` without duplicating snippets or highlights.
- `maxResults` is hard-capped at `30` even when callers or config request more.

## [0.3.1] - 2026-06-02

### Fixed

- Added an explicit auto-release to publish workflow handoff so npm publishing runs after a version bump is merged to `main`.
- Bumped package metadata to publish a fresh npm version after the previously tagged `0.3.0` release did not reach npm.

## [0.3.0] - 2026-06-02

### Added

- Pi slash commands under the `qmd-a:*` namespace (`init`, `status`, `review`, `approve`, `configure`, `install`, `setup`, `setup-run`, `update`, `update-run`, `embed`, `embed-run`).
- Dedicated `/qmd-a:approve` command separate from `/qmd-a:review`.

### Changed

- Extension command registration moved to `src/extension-commands.ts` for testability.

### Deprecated

- Legacy `qmd-adaptive-*` hyphen commands remain registered for one release as compatibility aliases (including `approve` on `qmd-adaptive-review` and `--yes` on `qmd-adaptive-qmd-*`).

## [0.2.1] - 2026-06-02

### Changed
- Refresh README badges and sections to match the minimal docs policy.
- Document usage summary, package contents, security, and links.

## [0.2.0] - 2026-05-26

### Added
- qmd operation planning helper.
- qmd job state recording.
- Test coverage for qmd detection and fallback search.
- Feedback sharing guide documentation.
- Automated npm publishing CI workflow.
- Updated package publish workflow.

## [0.1.0] - 2026-05-21

### Added

- Initial CLI package scaffold.
- `search` command with qmd integration and fallback filename/content search.
- `feedback` command for local learned aliases and path boosts.
- `status` command for config, qmd, aliases, boosts, pending suggestions, and job state.
- `init` command for lightweight zero-config bootstrap.
- `configure` command with `docs`, `mixed`, `code`, and `privacy` presets.
- `review` command to inspect and promote pending suggestions into shared aliases/boosts.
- `install-qmd` helper command with explicit user confirmation.
- Node.js library API.
- TypeScript source/build pipeline.
- Pi package metadata and TypeScript extension entrypoint.
- Privacy-preserving local storage model.
- Node test coverage for search, feedback, and status.

### Notes

- MVP does not yet perform full qmd collection setup/update/embed orchestration.
- Background jobs are represented in status shape but not fully implemented.
