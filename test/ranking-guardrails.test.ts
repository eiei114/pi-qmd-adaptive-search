import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEARNED_BOOST_CAP,
  SHARED_BOOST_CAP,
  isGenericToken,
  expandAliasTerms,
  effectiveBoostValue
} from '../src/ranking-guardrails.js';

test('isGenericToken flags low-information learned alias keys', () => {
  assert.equal(isGenericToken('content'), true);
  assert.equal(isGenericToken('post'), true);
  assert.equal(isGenericToken('portability'), false);
});

test('expandAliasTerms skips learned aliases with generic keys', () => {
  const result = expandAliasTerms(['post'], 'post', ['templates', 'content'], 'learned');
  assert.equal(result.skipped, true);
  assert.deepEqual(result.terms, []);
});

test('expandAliasTerms keeps informative learned alias expansion', () => {
  const result = expandAliasTerms(['portability'], 'portability', ['productspec', 'export'], 'learned');
  assert.equal(result.skipped, false);
  assert.ok(result.terms.includes('productspec'));
  assert.ok(result.why?.includes('portability'));
});

test('expandAliasTerms filters generic values from learned alias expansion', () => {
  const result = expandAliasTerms(['export'], 'export', ['content', 'templates', 'productspec'], 'learned');
  assert.deepEqual(result.terms, ['export', 'productspec']);
});

test('expandAliasTerms leaves shared aliases unchanged', () => {
  const result = expandAliasTerms(['post'], 'post', ['templates', 'content'], 'shared');
  assert.deepEqual(result.terms, ['post', 'templates', 'content']);
});

test('effectiveBoostValue caps runaway learned boosts with soft saturation', () => {
  assert.ok(effectiveBoostValue(0.08, 'learned') > 0.07);
  assert.ok(effectiveBoostValue(1.2, 'learned') <= LEARNED_BOOST_CAP);
  assert.ok(effectiveBoostValue(0.5, 'shared') < SHARED_BOOST_CAP);
  assert.ok(effectiveBoostValue(2, 'shared') <= SHARED_BOOST_CAP);
});
