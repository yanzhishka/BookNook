import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';
import { loadEpub } from './helpers/load-epub.mjs';

const require = createRequire(import.meta.url);
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../components/reader/EpubContent.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
}).outputText, { exports, require: id => id.endsWith('.css') ? { __esModule: true, default: {} } : id.endsWith('/document') ? loadEpub() : require(id) });
const { EpubContent } = exports;
const document = { version: 1, format: 'epub', language: 'ru', direction: 'ltr', targets: {}, notes: {} };
function render(children, props = {}) {
  return new JSDOM(renderToStaticMarkup(React.createElement(EpubContent, { document, blocks: [{ id: 'b1', kind: 'verse', start: 0, children }], onNavigate() {}, ...props }))).window.document;
}

test('verse selection across line breaks and italics highlights without losing markup', () => {
  const dom = render([{ text: 'Первая строка' }, { tag: 'br' }, { tag: 'em', children: [{ text: 'Вторая строка' }] }], {
    highlight: { quote: 'строка\nВторая', color: '#fde68a' },
  });
  assert.equal(dom.querySelectorAll('mark').length, 2);
  assert.equal(dom.querySelector('em mark').textContent, 'Вторая');
  assert.equal(dom.querySelector('article').textContent, 'Первая строкаВторая строка');
});

test('footnote controls are accessible, and stored unsafe URLs never become active', () => {
  const dom = render([{ tag: 'a', href: 'chapter.xhtml#n_1', children: [{ tag: 'sup', children: [{ text: '[1]' }] }] },
    { tag: 'a', href: 'javascript:alert(1)', children: [{ text: 'Unsafe link' }] },
    { tag: 'img', src: 'https://evil.test/track', alt: 'Tracking' }], {
    document: { ...document, notes: { 'chapter.xhtml#n_1': { label: '1', text: 'Note', children: [] } } },
  });
  assert.equal(dom.querySelector('button').getAttribute('aria-label'), 'Сноска [1]');
  assert.equal(dom.querySelectorAll('img,a,script').length, 0);
  assert.match(dom.body.textContent, /Unsafe link/);
});

test('screen layout exposes text anchors while retaining superscripts and verse markup', () => {
  const dom = render([{ text: 'Строка' }, { tag: 'br' }, { tag: 'em', children: [{ text: 'Курсив' }] },
    { tag: 'sup', children: [{ text: '[1]' }] }], { paginated: true });
  const anchors = [...dom.querySelectorAll('[data-reading-start]')].map(node => Number(node.dataset.readingStart));
  assert.deepEqual(anchors, [0, 7, 13]);
  assert.equal(dom.querySelector('em').textContent, 'Курсив');
  assert.equal(dom.querySelector('sup').textContent, '[1]');
});

test('screen text anchors address the exact imported source across inline markup and breaks', async () => {
  const zip = new JSZip();
  zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>');
  zip.file('book.opf', '<package><metadata><title>Тест</title></metadata><manifest><item id="c" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>');
  zip.file('chapter.xhtml', '<html><body><p> Начало <em>курсив</em> <br/> После <strong>переноса</strong> </p>' +
    '<div class="stanza"> Строка <em>один</em> <br/> Строка два<br/> Строка три </div>' +
    '<pre>  Первая строка \n    <em>вторая</em>\n</pre></body></html>');
  const { document: imported, content } = await loadEpub().importEpub(await zip.generateAsync({ type: 'uint8array' }));
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(EpubContent, {
    document: imported, blocks: imported.blocks, onNavigate() {}, paginated: true,
  }))).window.document;
  for (const span of dom.querySelectorAll('[data-reading-start]')) {
    const start = Number(span.dataset.readingStart);
    assert.equal(content.slice(start, start + span.textContent.length), span.textContent);
  }
  assert.equal(dom.querySelector('em').textContent, 'курсив');
  assert.match(dom.querySelector('pre').textContent, /^  Первая строка \n    вторая\n$/);
});
