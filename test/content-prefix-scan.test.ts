import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readUtf8Prefix, CONTENT_SAMPLE_CHARS } from '../src/fs-utils.js';
import { scoreFile } from '../src/search.js';

function tempDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmd-prefix-'));
  return root;
}

function referencePrefix(file, charLimit) {
  return fs.readFileSync(file, 'utf8').slice(0, charLimit);
}

test('readUtf8Prefix matches a full read for ASCII, CRLF, and Unicode content', () => {
  const root = tempDir();
  const cases = {
    'ascii.md': `# Note\n\nproduct export decision\n${'filler line\n'.repeat(200)}`,
    'crlf.md': '# 仕様\r\n\r\n検索 の仕様 と product 決定。\r\n',
    'unicode.md': `${'🙂 日本語テキスト行\n'.repeat(500)}`,
    'empty.md': '',
    'whitespace.md': '   \n\n\t\n'
  };
  for (const [name, body] of Object.entries(cases)) {
    const file = path.join(root, name);
    fs.writeFileSync(file, body, 'utf8');
    assert.equal(readUtf8Prefix(file), referencePrefix(file, CONTENT_SAMPLE_CHARS), name);
    assert.equal(readUtf8Prefix(file, 120), referencePrefix(file, 120), `${name} (short limit)`);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test('readUtf8Prefix truncates a large file without reading past the window', () => {
  const root = tempDir();
  const file = path.join(root, 'large.md');
  const body = `${'a'.repeat(100000)}TAIL_MARKER`;
  fs.writeFileSync(file, body, 'utf8');

  const prefix = readUtf8Prefix(file, 1000);
  assert.equal(prefix.length, 1000);
  assert.equal(prefix, referencePrefix(file, 1000));
  assert.equal(prefix.includes('TAIL_MARKER'), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('readUtf8Prefix keeps the character window when multi-byte content crosses the byte budget', () => {
  const root = tempDir();
  const file = path.join(root, 'multibyte.md');
  // 4-byte characters fill the whole byte budget for the requested window.
  const body = '🙂'.repeat(60000);
  fs.writeFileSync(file, body, 'utf8');

  const limit = 20000;
  assert.equal(readUtf8Prefix(file, limit), referencePrefix(file, limit));
  assert.equal(readUtf8Prefix(file, limit).length, limit);
  fs.rmSync(root, { recursive: true, force: true });
});

test('readUtf8Prefix tolerates a file that vanishes between walk and read', () => {
  const root = tempDir();
  assert.throws(() => readUtf8Prefix(path.join(root, 'missing.md')), { code: 'ENOENT' });
  fs.rmSync(root, { recursive: true, force: true });
});

test('scoreFile keeps ignoring content-only matches past the 20000-character prefix', () => {
  const root = tempDir();
  const filler = 'Generic filler line without the keywords we search for.\n';
  // Term starts just past the 20000-character prefix. The bounded read must keep
  // the long-standing contract: only the prefix is scored, so the tail is invisible.
  fs.writeFileSync(path.join(root, 'beyond.md'), `${filler.repeat(50)}` + `${'x'.repeat(19990)}product`, 'utf8');
  // Term inside the prefix.
  fs.writeFileSync(path.join(root, 'inside.md'), `product decision\n${filler.repeat(50)}`, 'utf8');

  const beyond = scoreFile(root, 'beyond.md', ['product'], [], 'auto', []);
  const inside = scoreFile(root, 'inside.md', ['product'], [], 'auto', []);

  assert.equal(beyond.score, 0);
  assert.ok(inside.score > 0);
  assert.ok(inside.source.includes('content'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('scoreFile scores large files by their prefix and ignores the tail', () => {
  const root = tempDir();
  const head = 'product appears in the opening section.\n';
  const tail = 'product also appears in the tail.';
  fs.writeFileSync(path.join(root, 'large.md'), `${head}${'filler line\n'.repeat(20000)}${tail}`, 'utf8');
  const result = scoreFile(root, 'large.md', ['product'], [], 'auto', []);
  assert.equal(result.score, 0.08);
  assert.deepEqual(result.source, ['content']);
  fs.rmSync(root, { recursive: true, force: true });
});
