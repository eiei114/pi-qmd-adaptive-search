import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('README install-from-source uses the GitHub repository URL', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

  assert.doesNotMatch(readme, /<repo-url>/, 'README must not keep placeholder clone URLs');
  assert.match(
    readme,
    new RegExp(pkg.repository.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'README clone instructions should match package.json repository.url',
  );
});
