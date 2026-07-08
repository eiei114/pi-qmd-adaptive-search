## Summary

- 

## Stacked pull requests

**Stacked PRs are the default** for this repo. If this PR is part of a stack, say so here and set the base branch to the PR below it (not `main`). See [CONTRIBUTING.md — Stacked pull requests](https://github.com/eiei114/pi-qmd-adaptive-search/blob/main/CONTRIBUTING.md#stacked-pull-requests).

- [ ] This PR targets `main` (standalone change)
- [ ] This PR is stacked on: `<!-- branch name of the PR below -->`

## Testing

- [ ] `npm run check` passes locally
- [ ] `npm run version:check` passes (or `npm run ci`)

## Checklist

Follow the [pull request workflow](https://github.com/eiei114/pi-qmd-adaptive-search/blob/main/CONTRIBUTING.md#pull-request-workflow) and [design constraints](https://github.com/eiei114/pi-qmd-adaptive-search/blob/main/CONTRIBUTING.md#conventions):

- [ ] Tests added or updated under `test/` for behavior changes
- [ ] [CHANGELOG.md](CHANGELOG.md) updated under `Unreleased` for user-visible changes
- [ ] No new runtime dependency unless essential (and documented in the PR)
- [ ] Design constraints respected (no raw query persistence, optional `qmd`, explicit cleanup confirmation, etc.)
- [ ] CI is expected to pass (`npm run check` on Node 20/22 and `npm run version:check` on PRs)

## Version bump

- [ ] No version bump in this PR (default for most contributions)
- [ ] Version bump included (requires matching `CHANGELOG.md` entry; major bumps need `major-approved` in title/body)
