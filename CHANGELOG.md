# Changelog

All notable changes to this project will be documented in this file.

This project follows a pragmatic `0.x` versioning policy: APIs and config may change before `1.0.0`.

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
