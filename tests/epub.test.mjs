import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { loadEpub } from './helpers/load-epub.mjs';
const { importEpub, paginateDocument, resolveEpubHref, isEpubDocument, findTextRange, textDocument, inlineText } = loadEpub();

async function fixture({ body, extra = '', spine = '<itemref idref="b"/><itemref idref="a"/>', more = {} } = {}) {
  const zip = new JSZip();
  zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>');
  zip.file('OPS/book.opf', `<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Тест</dc:title><dc:creator>Автор</dc:creator><dc:language>ru</dc:language></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="sub/b.xhtml" media-type="application/xhtml+xml"/>${extra}</manifest><spine>${spine}</spine></package>`);
  zip.file('OPS/a.xhtml', `<html><body>${body || '<p>Второй раздел</p>'}</body></html>`);
  zip.file('OPS/sub/b.xhtml', '<html><body><h1 id="begin">Первый раздел</h1><p>Начало книги</p></body></html>');
  for (const [path, content] of Object.entries(more)) zip.file(path, content);
  return zip.generateAsync({ type: 'uint8array' });
}

test('EPUB uses OPF spine, metadata and safe local paths', async () => {
  const result = await importEpub(await fixture());
  assert.ok(result.content.indexOf('Первый раздел') < result.content.indexOf('Второй раздел'));
  assert.equal(result.title, 'Тест'); assert.equal(result.author, 'Автор');
  assert.equal(resolveEpubHref('../a.xhtml#%D0%BD', 'OPS/sub/b.xhtml'), 'OPS/a.xhtml#н');
  assert.equal(resolveEpubHref('javascript:alert(1)', 'OPS/a.xhtml'), null);
  assert.equal(resolveEpubHref('https://evil.test/a', 'OPS/a.xhtml'), null);
  assert.ok(isEpubDocument(result.document));
});

test('RoyalLib body titles, inline emphasis, stanza boundaries and duplicate note anchors survive', async () => {
  const body = '<div><title>Глава первая<br/></title><title>I<br/></title><blockquote>Мой дядя<br/><i>Самых честных правил</i><br/>Когда не в шутку занемог<a href="#n_1"><sup>[1]</sup></a><br/>&#160;<br/></blockquote><title>II<br/></title><blockquote>Вторая строфа<br/>Вторая строка<br/>Третья строка</blockquote></div><h4>Сноски</h4><a name="n_1"/><a name="n_1"/><strong>1<br/></strong><div>Полная <i>сноска</i></div><a name="n_2"/><div>Следующая</div>';
  const { document, content } = await importEpub(await fixture({ body }));
  assert.ok(!content.includes('<br')); assert.ok(!content.includes('<i>'));
  assert.equal(document.blocks.filter(b => b.kind === 'verse').length, 2);
  assert.equal(document.blocks.find(b => b.text === 'I')?.level, 3);
  assert.match(document.notes['OPS/a.xhtml#n_1'].text, /Полная сноска/);
  assert.ok(!document.notes['OPS/a.xhtml#n_1'].text.includes('Следующая'));
  const pages = paginateDocument(document, 30);
  for (const verse of document.blocks.filter(b => b.kind === 'verse')) {
    assert.equal(pages.filter(p => p.blocks.includes(verse)).length, 1);
    const page = pages.find(p => p.blocks.includes(verse));
    assert.ok(page.blocks.some(b => b.kind === 'heading'));
  }
  assert.ok(document.toc.some(t => t.label === 'Глава первая'));
});

test('EPUB 3 nav, separate non-linear footnotes and inactive publisher scripts', async () => {
  const { document, content } = await importEpub(await fixture({ body: '<p><a href="notes.xhtml#f">[1]</a> Текст<script>evil()</script><img src="https://evil.test/track"/></p>',
    extra: '<item id="n" href="notes.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    spine: '<itemref idref="b"/><itemref idref="a"/><itemref idref="n" linear="no"/>',
    more: { 'OPS/notes.xhtml': '<html xmlns:epub="http://www.idpf.org/2007/ops"><body><aside epub:type="footnote" id="f">Сноска отдельно</aside></body></html>',
      'OPS/nav.xhtml': '<html xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><a href="sub/b.xhtml#begin">Начало</a></nav></body></html>' },
  }));
  assert.equal(document.toc[0].label, 'Начало');
  assert.equal(document.notes['OPS/notes.xhtml#f'].text, 'Сноска отдельно');
  assert.ok(!content.includes('Сноска отдельно')); assert.ok(!content.includes('evil()'));
  assert.ok(!JSON.stringify(document.blocks).includes('https://evil.test'));
});

test('malformed HTML title recovery and document validation', async () => {
  const { content, document } = await importEpub(await fixture({ body: '<title>Глава & первая<br></title><p>Текст</p>' }));
  assert.match(content, /Глава & первая/); assert.ok(!content.includes('<br>'));
  assert.equal(isEpubDocument({ ...document, blocks: [{ ...document.blocks[0], children: [{ tag: 'script' }] }] }), false);
});

test('quote lookup tolerates EPUB nonbreaking spaces and visual line breaks', () => {
  const text = 'До\nСамых\u00a0честных правил,\n Когда не в шутку\nПосле';
  const match = findTextRange(text, 'Самых честных правил,\nКогда не в шутку');
  assert.equal(text.slice(match.start, match.end), 'Самых\u00a0честных правил,\n Когда не в шутку');
  assert.equal(findTextRange(text, 'Отсутствует'), null);
});

test('legacy text paragraphs retain exact source offsets for screen pagination', () => {
  const source = 'Первая строка\nВторая строка\n\n  Новый абзац\r\n\r\nКонец';
  const document = textDocument(source, 'Текст', 'Автор');
  assert.equal(document.blocks.length, 3);
  for (const block of document.blocks) assert.equal(source.slice(block.start, block.start + block.text.length), block.text);
  assert.equal(document.blocks[0].children[0].text, 'Первая строка\nВторая строка');
  assert.equal(document.blocks.at(-1).text, 'Конец');
});

test('imported text offsets match rendered inline text, including breaks and preformatted whitespace', async () => {
  const body = '<p>  Начало <em>курсивом</em> <br/> После <strong>переноса</strong> </p>' +
    '<div class="stanza"> Строка <em>раз</em> <br/> Строка два<br/> Строка три </div>' +
    '<pre>  const value = 1; \n    return <em>value</em>;\n</pre>';
  const { document, content } = await importEpub(await fixture({ body }));
  for (const block of document.blocks) {
    assert.equal(block.text, inlineText(block.children));
    assert.equal(content.slice(block.start, block.start + block.text.length), block.text);
  }
  assert.equal(document.blocks.find(block => block.kind === 'pre').text, '  const value = 1; \n    return value;\n');
  assert.match(content, /Начало курсивом \n После переноса/);
  assert.match(document.blocks.find(block => block.kind === 'verse').text, /раз \n Строка два/);
});

test('multiple inline chapter anchors in one XHTML keep distinct navigation targets', async () => {
  const body = '<h1><a id="one"/>Первая глава</h1><p>Первый текст</p>' +
    '<section id="part"><h1><span id="two">Вторая глава</span></h1><p>Второй <em><a name="detail"/>текст</em></p></section>' +
    '<div><a id="three"/><h1>Третья глава</h1><p>Третий текст</p></div>';
  const { document } = await importEpub(await fixture({ body,
    extra: '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    more: { 'OPS/nav.xhtml': '<html xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc">' +
      '<a href="a.xhtml#one">Глава 1</a><a href="a.xhtml#two">Глава 2</a><a href="a.xhtml#three">Глава 3</a>' +
      '</nav></body></html>' },
  }));
  const blockFor = target => document.blocks.find(block => block.id === document.targets[`OPS/a.xhtml#${target}`]);
  assert.equal(blockFor('one').text, 'Первая глава');
  assert.equal(blockFor('two').text, 'Вторая глава');
  assert.equal(blockFor('three').text, 'Третья глава');
  assert.equal(blockFor('part').id, blockFor('two').id);
  assert.equal(blockFor('detail').text, 'Второй текст');
  assert.deepEqual(Array.from(document.toc.filter(item => /^Глава \d/.test(item.label)), item => item.blockId),
    ['one', 'two', 'three'].map(target => blockFor(target).id));
});

test('EPUB rejects missing packages and fixed layout with a useful error', async () => {
  await assert.rejects(importEpub(await new JSZip().file('empty.txt', '').generateAsync({ type: 'uint8array' })), /отсутствует файл/);
  const bytes = await fixture();
  const zip = await JSZip.loadAsync(bytes);
  const opf = await zip.file('OPS/book.opf').async('string');
  zip.file('OPS/book.opf', opf.replace('<metadata>', '<metadata><meta property="rendition:layout">pre-paginated</meta>'));
  await assert.rejects(importEpub(await zip.generateAsync({ type: 'uint8array' })), /фиксированную вёрстку/);
});
