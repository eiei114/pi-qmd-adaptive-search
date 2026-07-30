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

test('README CLI section documents install-instructions referenced in troubleshooting', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

  assert.match(readme, /qmd-adaptive-search install-instructions/, 'troubleshooting should reference install-instructions');

  const cliSection = readme.match(/## CLI[\s\S]*?## Examples/);
  assert.ok(cliSection, 'README should include a CLI section');
  assert.match(
    cliSection![0],
    /qmd-adaptive-search install-instructions/,
    'README CLI section should list install-instructions',
  );
});
