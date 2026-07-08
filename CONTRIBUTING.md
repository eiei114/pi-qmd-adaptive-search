# Contributing to pi-qmd-adaptive-search

Thanks for your interest in contributing! This package is a small, privacy-first
TypeScript library and CLI, so most changes are easy to make and easy to review.
This guide covers how to set up the project, run tests, follow our conventions,
and open a pull request.

> New here? Skim [README.md](README.md) first — it explains what this project
> does, the privacy model, and the design intent behind the design constraints
> below.

## Table of contents

- [Code of Conduct](#code-of-conduct)
- [Requirements](#requirements)
- [Development setup](#development-setup)
- [Development commands](#development-commands)
- [Repository layout](#repository-layout)
- [Conventions](#conventions)
- [Testing](#testing)
- [Pull request workflow](#pull-request-workflow)
- [Stacked pull requests](#stacked-pull-requests)
- [Changelog and versioning](#changelog-and-versioning)
- [Releases (maintainers only)](#releases-maintainers-only)
- [Reporting issues](#reporting-issues)
- [Security disclosures](#security-disclosures)

## Code of Conduct

By participating in this project you agree to uphold the
[Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). Please be kind,
constructive, and respectful. Report conduct issues to the maintainers via the
private channels listed in that file rather than in public issues.

## Requirements

- **Node.js >= 20** (CI runs on Node 20 and 22; match one of those locally).
- **npm** for installing dependencies and running all scripts. We standardize on
  npm — please don't introduce lockfiles for other package managers.
- **TypeScript** is a dev dependency, so it is installed by `npm install`. No
  global toolchain is required.

This package has **no runtime dependencies**. The published artifact ships only
first-party code plus `@types/node` and `typescript` at dev time. Please avoid
adding a runtime dependency unless it is essential; if you must, keep it optional
and document why.

## Development setup

```bash
git clone https://github.com/eiei114/pi-qmd-adaptive-search.git
cd pi-qmd-adaptive-search
npm install
npm run build
npm test
```

If `npm test` and `npm run smoke` both pass, your environment is ready.

Optional, not required for most contributions: install
[`qmd`](https://github.com/tobilu/qmd) to exercise the semantic search path
locally. The fallback search path works without qmd and is what CI exercises.

## Development commands

All commands assume the repo root as your working directory.

| Command | What it does |
| --- | --- |
| `npm run build` | Compile TypeScript to `dist/` (`tsc -p tsconfig.json`). |
| `npm test` | Build, then run the test suite (`node --test dist/test/*.test.js`). |
| `npm run smoke` | Build, then run the CLI smoke check (`bin/qmd-adaptive-search.js --help`). |
| `npm run check` | Run `npm test`, `npm run smoke`, and `npm pack --dry-run`. This is the full local gate. |
| `npm run version:check` | Verify version/CHANGELOG policy for the current diff (see below). |
| `npm run ci` | `npm run check && npm run version:check`. Closest equivalent to CI on your machine. |

Quick local sanity check before opening a PR:

```bash
npm run check
git status --short
```

Other useful local commands while iterating:

```bash
node bin/qmd-adaptive-search.js search "product decisions" --max 3
node bin/qmd-adaptive-search.js --help
```

## Repository layout

```text
bin/                     CLI entrypoint (qmd-adaptive-search.js)
src/                     TypeScript library implementation
  cli.ts                 command routing
  config.ts              config/bootstrap/presets
  qmd.ts                 qmd detection and search bridge
  search.ts              fallback search, ranking, result shaping
  feedback.ts            local learning and review promotion
  maintenance.ts         learned-state cleanup workflow
  status.ts              status snapshot
extensions/index.ts      Pi extension entrypoint
test/                    TypeScript tests run with node:test
scripts/check-version-bump.mjs   PR version/CHANGELOG guard
dist/                    Compiled output (gitignored, built locally)
types/                   Ambient type declarations
```

Source maps and declarations are emitted into `dist/`. Don't edit `dist/`
directly — it is a build artifact.

## Conventions

### TypeScript and style

- Target is `ES2022`, modules are `NodeNext`. Use ESM imports with `.js`
  extensions where the compiler requires them.
- `.editorconfig` is enforced: UTF-8, LF line endings, a final newline, and
  2-space indentation. Configure your editor to honor `.editorconfig`.
- Markdown files keep trailing whitespace and use `trim_trailing_whitespace = false`
  (two-trailing-space hard line breaks are intentional in places).
- Keep functions small and the public surface stable. Prefer adding a new
  capability over silently changing an existing one.

### Design constraints (please respect these)

These are load-bearing properties of the package. A change that violates one
should explain why in the PR description and is unlikely to be accepted without
discussion:

- Do not persist raw query text.
- Do not persist query hashes.
- Keep `qmd` optional; fallback search must keep working when qmd is absent or
  fails.
- Do not run heavy qmd setup without explicit user confirmation
  (`--dry-run` plans + `--yes`/interactive prompt).
- Keep shared learning writes behind explicit review/approval
  (`review --approve`), unless explicitly configured otherwise.

### Commit messages

Use short [Conventional Commits](https://www.conventionalcommits.org/) prefixes
when practical:

- `feat:` new user-facing capability
- `fix:` bug fix
- `docs:` documentation only
- `test:` test additions or fixes
- `refactor:` internal changes with no behavior shift
- `chore:` tooling, deps, CI

Example: `fix(search): cap learned boost so feedback cannot dominate ranking`.

Keep the subject line short (imperative mood), and put the "why" in the body.

## Testing

Tests live in `test/` as `*.test.ts` and run on the compiled output via Node's
built-in test runner (`node:test`). There is no separate test framework to
install.

To run the whole suite:

```bash
npm test
```

To run a single test file while iterating:

```bash
npm run build
node --test dist/test/search.test.js
```

When adding a feature or fixing a bug, add or update a test under `test/` that
covers the new behavior. Prefer focused unit tests over broad integration tests,
and add regression tests for the specific input that broke. The
`ranking-guardrails` and `maintenance` tests are good templates for behavior
boundaries.

The CLI smoke check (`npm run smoke`) exists to catch entrypoint breakage that
unit tests can miss — keep it green.

## Pull request workflow

1. **Branch from `main`.** Use a descriptive branch name such as
   `feat/<scope>` or `fix/<scope>`.
2. **Make your change**, following the [Conventions](#conventions) above.
3. **Add or update tests** under `test/`.
4. **Run the local gate** and make sure it is green:

   ```bash
   npm run check
   npm run version:check   # or npm run ci to run both
   ```
5. **Update [CHANGELOG.md](CHANGELOG.md)** for user-visible changes (see
   [Changelog and versioning](#changelog-and-versioning)).
6. **Open a pull request** against `main`. GitHub pre-fills the
   [pull request template](.github/PULL_REQUEST_TEMPLATE.md) with the checklist
   below. Describe what changed and why; call out anything that touches the
   [design constraints](#conventions).
7. **CI must pass.** The CI workflow runs `npm run check` on Node 20 and 22 and
   `npm run version:check` on pull requests. Fix CI failures before requesting
   review.

CI does not run a linter or formatter beyond `tsc` and the test/smoke/pack
checks, so please self-review your diff for style and dead code before opening.

### PR checklist

- [ ] `npm run check` passes locally
- [ ] Tests added/updated for the change
- [ ] `CHANGELOG.md` updated under `Unreleased` for user-visible changes
- [ ] No new runtime dependency unless essential (and documented)
- [ ] Design constraints in [Conventions](#conventions) respected

## Stacked pull requests

**Stacked pull requests are the default.** Keep each PR small and focused on one
concern so reviews stay fast and safe. When a change naturally splits into
dependent steps, open them as a stack:

1. Branch the first step off `main` and open its PR against `main`.
2. Branch each subsequent step off the previous step's branch, and open its PR
   against the branch below it (not `main`).
3. Review and merge bottom-up. Rebase the next PR onto the updated `main` once
   the one below it merges.

Guidelines for a healthy stack:

- One logical change per PR (a feature, a fix, a refactor, a doc).
- Each PR must build and pass `npm run check` on its own.
- Prefer several small, independently reviewable PRs over one large PR.
- If a step only exists to enable a later step, say so in its description so
  reviewers have the context.

## Changelog and versioning

- **Changelog**: record user-visible changes under the `## Unreleased` section of
  [CHANGELOG.md](CHANGELOG.md), grouped by `Added` / `Changed` / `Fixed` /
  `Removed` to match the existing style. Internal-only refactors and test
  additions generally don't need an entry.
- **Version bumps are optional** for most PRs. `scripts/check-version-bump.mjs`
  enforces the policy, and CI runs it on every PR:
  - If you do bump `version` in `package.json`, the new version must be a valid
    semver **increase** over `main`.
  - Any version bump **must** include a `CHANGELOG.md` change in the same diff.
  - A **major** bump requires explicit human approval: include `major-approved`
    in the PR title or body (or run locally with `ALLOW_MAJOR_VERSION_BUMP=1`).
- See the [Versioning policy](README.md#versioning-policy) in the README for what
  each version range means in this `0.x` project (`0.1.x`, `0.2.0`, `0.3.0+`,
  `1.0.0`).

If you're unsure whether to bump, open the PR without a bump and let a maintainer
decide.

## Releases (maintainers only)

Contributors do **not** publish. Publishing to npm is fully automated:

- A maintainer bumps `version` in `package.json`, updates `CHANGELOG.md`, and
  tags a release (for example `v0.2.1`) or creates a GitHub Release for that
  tag.
- The `Publish to npm` workflow then runs `npm run check`, skips if that exact
  version already exists on npm, and publishes with `npm publish --access public`
  using npm [Trusted Publishing](https://docs.npmjs.com/trusted-publishers) with
  GitHub OIDC.

Please don't run `npm publish` or configure publish tokens. See the
[Release](README.md#release) section of the README for the full flow.

## Reporting issues

File bugs and feature requests in the
[GitHub issue tracker](https://github.com/eiei114/pi-qmd-adaptive-search/issues).
Use the [bug report](.github/ISSUE_TEMPLATE/bug_report.md) or
[feature request](.github/ISSUE_TEMPLATE/feature_request.md) templates when
opening a new issue — they match the fields below.

Include:

- What you did (exact command or Pi tool invocation).
- What you expected.
- What happened, including any `qmd was not found` / fallback warnings.
- Your Node version, OS, and whether `qmd` is installed.

## Security disclosures

Please report vulnerabilities privately via [SECURITY.md](SECURITY.md) rather
than filing a public issue.
