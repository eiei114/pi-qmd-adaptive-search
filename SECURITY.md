# Security Policy

## Supported versions

`0.x` is pre-stable. Security fixes should target the latest `0.x` line.

## Reporting a vulnerability

Open a private report or contact the maintainer directly if this repository is mirrored to GitHub.

## Privacy-sensitive behavior

This project intentionally avoids persisting:

- raw search queries
- query hashes
- answer text
- snippets/highlights
- file contents

Returned-output safety (see `README.md`):

- Pi tool `qmd_adaptive_search` returns compact path-first output and omits snippets from tool results.
- CLI `search` may include bounded `lead` / `highlights` for local inspection only.
- Verbose background job details belong in `qmd_adaptive_status`, not routine search output.

If a change needs to store more data or broaden returned output, document the reason in the PR and update `README.md`.
