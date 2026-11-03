import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../services/bookContentCache.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, AbortController });
const { BookContentCache } = exports;

test('LRU evicts by recency and byte budget, while oversized books are not retained', async () => {
  const cache = new BookContentCache(2, 100);
  let reads = 0;
  const read = id => cache.load('owner', id, async () => { reads++; return { content: id }; });
  await read('a'); await read('b'); await read('a'); await read('c');
  assert.equal(reads, 3);
  await read('b');
  assert.equal(reads, 4);
  await cache.load('owner', 'large', async () => { reads++; return { content: 'x'.repeat(100) }; });
  await cache.load('owner', 'large', async () => { reads++; return { content: 'x'.repeat(100) }; });
  assert.equal(reads, 6);
  const small = new BookContentCache(10, 40);
  let smallReads = 0;
  const smallRead = id => small.load('owner', id, async () => { smallReads++; return { content: id }; });
  await smallRead('a'); await smallRead('b'); await smallRead('a');
  assert.equal(smallReads, 3, 'byte budget must evict even below the entry count');
});

test('logout, owner changes and invalidation abort pending reads and prevent stale cache resurrection', async () => {
  const cache = new BookContentCache();
  let resolve, signal;
  const pending = cache.load('first', 'book', input => { signal = input; return new Promise(done => { resolve = done; }); });
  await Promise.resolve();
  cache.clear();
  assert.equal(signal.aborted, true);
  resolve({ content: 'First account private text' });
  await assert.rejects(pending, { name: 'AbortError' });
  const second = await cache.load('second', 'book', async () => ({ content: 'Second account text' }));
  assert.equal(second.content, 'Second account text');
  const first = await cache.load('first', 'book', async () => ({ content: 'Fresh first account text' }));
  assert.equal(first.content, 'Fresh first account text');
  cache.invalidate('first', 'book');
  assert.equal((await cache.load('first', 'book', async () => ({ content: 'Replacement' }))).content, 'Replacement');
});

test('failed content reads are retryable', async () => {
  const cache = new BookContentCache();
  await assert.rejects(cache.load('owner', 'book', async () => { throw new Error('Network unavailable'); }));
  assert.equal((await cache.load('owner', 'book', async () => ({ content: 'Recovered' }))).content, 'Recovered');
});

test('cached documents expire so an old session eventually sees replacements made on another device', async () => {
  let now = 0, reads = 0;
  const cache = new BookContentCache(3, 1000, 100, () => now);
  const read = () => cache.load('owner', 'book', async () => ({ content: String(++reads) }));
  assert.equal((await read()).content, '1');
  now = 99;
  assert.equal((await read()).content, '1');
  now = 100;
  assert.equal((await read()).content, '2');
});
