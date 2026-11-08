/* eslint-env node, es2020 */
// node --test chatter/test_run.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import {clipListName, selectClips} from './run.mjs';

const clip = (id, reciter, reciterSplit, blockSplit) => ({
  id,
  truth: {reciter, reciterSplit, blockSplit},
});
const POOL = [
  clip('a1', 'dev_one', 'dev', 'dev'),
  clip('a2', 'dev_one', 'dev', 'dev'),
  clip('a3', 'dev_one', 'dev', 'test'),
  clip('b1', 'test_one', 'test', 'test'),
  clip('b2', 'test_one', 'test', 'test'),
  clip('b3', 'test_one', 'test', 'dev'),
  clip('c1', 'test_two', 'test', 'test'),
];
const seconds = () => 60;

test('by default it picks dev reciters on dev passages, as before', () => {
  const ids = selectClips(POOL, 10, seconds).map(c => c.id);
  assert.deepEqual([...ids].sort(), ['a1', 'a2']);
});

test('the default gives the same list as asking for the dev half', () => {
  assert.deepEqual(
    selectClips(POOL, 10, seconds).map(c => c.id),
    selectClips(POOL, 10, seconds, 'dev').map(c => c.id),
  );
});

test('the test half picks test reciters on test passages, nothing else', () => {
  const ids = selectClips(POOL, 10, seconds, 'test').map(c => c.id);
  assert.deepEqual([...ids].sort(), ['b1', 'b2', 'c1']);
});

test('minutes count per reciter on the test half too', () => {
  const ids = selectClips(POOL, 1, seconds, 'test').map(c => c.id);
  assert.equal(ids.length, 2);
  assert.ok(ids.includes('c1'));
});

test('the test half keeps its clip list apart from the tuning half', () => {
  assert.equal(clipListName('dev'), 'clips.json');
  assert.equal(clipListName('test'), 'clips.test.json');
});
