import test from 'node:test';
import assert from 'node:assert/strict';
import { helpText } from '../src/cli.js';
import { packageVersion } from '../src/package-version.js';

test('CLI help reports package.json version', () => {
  const version = packageVersion();
  assert.match(helpText(), new RegExp(`^qmd-adaptive-search ${version.replace(/\./g, '\\.')}`));
  assert.doesNotMatch(helpText(), /qmd-adaptive-search 0\.1\.0/);
});
