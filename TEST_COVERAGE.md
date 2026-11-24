# Test coverage review

## Historical baseline

Coverage command used at the time:

```sh
npm run build && node --test --experimental-test-coverage dist/test/*.test.js
```

That run had 20 tests, 19 passing and 1 platform skip on Windows. Node's coverage report showed 91.41% line coverage across files loaded from `dist/src`. These figures are historical, not a new measurement.

Targeted additions made:

- Forced positive feedback review/approval now verifies low-confidence feedback can be promoted into shared aliases and boosts, then clears pending suggestions.
- Failed confirmed qmd operations now verify failed job state and recovery hints are recorded for status output.
- Direct public-API tests verify `applyPreset` reset behavior against customized configuration and dry-run preservation of the exact config bytes.

## Existing CLI coverage

- **In process:** Tests call [`parseArgs`](test/cli.test.ts#L13-L85) for positional arguments and flags, and [`helpText`](test/cli.test.ts#L166-L171) to check the package version.
- **Subprocess:** Tests run the CLI executable to check [help and usage output](test/cli.test.ts#L111-L147), the [version in `--help`](test/cli.test.ts#L173-L179), and [exit code 1 with stderr diagnostics](test/cli.test.ts#L189-L207) for an unknown command, a missing search query, and missing feedback selections. The [successful feedback case](test/cli.test.ts#L209-L243) checks trimmed paths, the recorded rating, and persisted learning state. Other cases verify [read-only search without creating adaptive state](test/cli.test.ts#L149-L163) and [maintenance and qmd dry-run plans](test/cli.test.ts#L260-L339).
