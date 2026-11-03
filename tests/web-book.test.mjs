import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEpub } from './helpers/load-epub.mjs';
const { importWebBook, isEpubDocument } = loadEpub();

test('downloaded chapters become safe structured EPUB with working internal links and notes', async () => {
  const result = await importWebBook({ kind: 'text', title: 'Книга & том', author: 'Автор', language: 'ru', sourceUrl: 'https://ru.wikisource.org/wiki/Книга', chapters: [
    { title: 'Глава первая', url: 'https://ru.wikisource.org/wiki/%D0%9A%D0%BD%D0%B8%D0%B3%D0%B0%2F1', html: '<p><i>Начало текста</i> <a href="#cite_note-1"><sup>[1]</sup></a></p><p><a href="/wiki/Книга/2#end">Дальше</a></p><ol class="references"><li role="doc-footnote" id="cite_note-1">Примечание</li></ol><script>evil()</script>' },
    { title: 'Глава вторая', url: 'https://ru.wikisource.org/wiki/%D0%9A%D0%BD%D0%B8%D0%B3%D0%B0%2F2', html: '<p id="end">Продолжение текста.</p>' },
  ] }, () => {});
  assert.ok(isEpubDocument(result.document)); assert.equal(result.title, 'Книга & том');
  assert.ok(result.content.indexOf('Начало текста') < result.content.indexOf('Продолжение текста'));
  assert.equal(result.document.notes['chapter0.xhtml#cite_note-1'].label, '1');
  assert.ok(result.document.targets['chapter1.xhtml#end']);
  assert.match(JSON.stringify(result.document.blocks), /chapter1.xhtml#end/);
  assert.ok(!result.content.includes('evil()')); assert.ok(!result.content.includes('<i>'));
});
