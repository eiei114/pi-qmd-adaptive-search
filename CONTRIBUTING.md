# Contributing

## Requirements

- Node.js 20+
- npm

## Setup

```bash
npm install
npm test
```

This package currently has no runtime dependencies.

## Development commands

```bash
npm test
npm run smoke
npm run check
```

## Design constraints

- Do not persist raw query text.
- Do not persist query hashes.
- Keep qmd optional; fallback search must continue to work.
- Do not run heavy qmd setup without explicit user confirmation.
- Keep shared learning writes behind review/approval unless explicitly configured otherwise.

## Commit style

Use short conventional prefixes when practical:

- `feat:`
- `fix:`
- `docs:`
- `test:`
- `refactor:`

## Before opening a PR

```bash
npm run check
git status --short
```
