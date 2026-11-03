import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from './helpers/load-catalog.mjs';
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const body = (title, content) => `<div class="mw-parser-output"><div id="headertemplate"><span id="ws-title">${title}</span><span id="ws-author">автор Тестовый Автор</span><div>список редакций</div></div>${content}</div>`;

test('discovery uses the chosen language and skips missing/disambiguation pages', async () => {
  let url;
  const { searchCatalog } = loadCatalog(async request => { url = new URL(request); return json({ query: { pages: [
    { ns: 0, title: 'Le Livre' }, { ns: 0, title: 'Missing', missing: true }, { ns: 0, title: 'Index', pageprops: { disambiguation: '' } },
  ] } }); });
  const result = await searchCatalog({ language: 'fr' });
  assert.equal(url.hostname, 'fr.wikisource.org');
  assert.equal(result.books.length, 1); assert.equal(result.books[0].language, 'fr');
  assert.equal(result.books[0].hasReadableText, true);
  await assert.rejects(searchCatalog({ language: 'evil.example' }), /Выберите язык/);
});

test('search drops chapter hits and redirects, exposes partial failures without fake availability', async () => {
  const { searchCatalog } = loadCatalog(async request => {
    const u = new URL(request);
    if (u.hostname === 'openlibrary.org') return new Response('', { status: 503 });
    if (u.searchParams.get('list') === 'search') return json({ query: { search: [
      { title: 'Книга', snippet: 'Автор <b>текст</b>' }, { title: 'Книга/Глава 1' }, { title: 'Другое имя' },
    ] } });
    return json({ query: { pages: [{ ns: 0, title: 'Книга' }], redirects: [{ from: 'Другое имя', to: 'Книга' }] } });
  });
  const result = await searchCatalog({ query: 'книга', language: 'ru', onlyReadable: false });
  assert.equal(result.books.length, 1); assert.equal(result.books[0].sourcePage, 'Книга');
  assert.equal(result.books[0].description.includes('<b>'), false);
  assert.equal(result.warnings.length, 1);
});

test('edition lists are explicit; a normal book header menu is not an edition list', async () => {
  const { loadCatalogText, parseWikiPage } = loadCatalog(async () => json({ parse: { title: 'Книга', text:
    body('Список редакций: Книга', '<a href="/wiki/Книга/1950">Издание 1950</a><a href="/wiki/Книга/2000">Издание 2000</a>') } }));
  const result = await loadCatalogText({ language: 'ru', sourcePage: 'Книга' });
  assert.equal(result.kind, 'editions'); assert.equal(result.books.length, 2);
  assert.equal(result.books[0].author, 'Тестовый Автор');
  assert.equal(parseWikiPage(body('Книга', '<p>Настоящий текст</p>'), 'Книга', 'ru').versions, false);
});

test('whole-book import follows chapter order and keeps footnote semantics', async () => {
  const calls = [];
  const { loadCatalogText } = loadCatalog(async request => {
    const title = new URL(request).searchParams.get('page'); calls.push(title);
    if (title === 'Книга') return json({ parse: { title, text: body(title, '<ul><li><a href="/wiki/Книга/1">Первая</a></li><li><a href="/wiki/Книга/2">Вторая</a></li></ul>') } });
    if (title === 'Книга/1') await new Promise(resolve => setTimeout(resolve, 15));
    return json({ parse: { title, text: body(title, `<p>Глава ${title.endsWith('1') ? 'первая' : 'вторая'}: ${'Текст книги. '.repeat(20)}</p><ol class="references"><li id="cite_note-1">Сноска</li></ol>`) } });
  });
  const result = await loadCatalogText({ sourcePage: 'Книга', language: 'ru' });
  assert.equal(result.kind, 'text'); assert.equal(result.chapters.length, 2);
  assert.equal(result.chapters[0].title, '1'); assert.equal(result.chapters[1].title, '2');
  assert.match(result.chapters[0].html, /doc-footnote/);
  assert.equal(calls.length, 3);
  assert.equal(result.author, 'Тестовый Автор');
});

test('missing chapters fail the complete download instead of returning a partial book', async () => {
  const { loadCatalogText } = loadCatalog(async () => json({ parse: { title: 'Книга', text: body('Книга',
    '<ul><li><a href="/wiki/Книга/1">Первая</a></li><li><a class="new" title="Книга/2 (страница не существует)" href="/w/index.php?title=Книга/2">Вторая</a></li></ul>') } }));
  await assert.rejects(loadCatalogText({ sourcePage: 'Книга' }), /отсутствуют главы/);
  await assert.rejects(loadCatalogText({ sourcePage: 'https://169.254.169.254' }), /Некорректный адрес/);
});

test('catalogue records never promise an automatically downloadable text', async () => {
  const { searchCatalog } = loadCatalog(async request => {
    const u = new URL(request);
    if (u.hostname === 'openlibrary.org') return json({ numFound: 1, docs: [{ key: '/works/OL1W', title: 'Modern book', author_name: ['Author'], ebook_access: 'public' }] });
    return json({ query: { search: [] } });
  });
  const result = await searchCatalog({ query: 'modern', language: 'en', onlyReadable: false });
  assert.equal(result.books[0].hasReadableText, false); assert.equal(result.books[0].provider, 'openlibrary');
});

test('name searches use title matches and an author bibliography, excluding works about the author', async () => {
  const { searchCatalog } = loadCatalog(async request => {
    const u = new URL(request);
    if (u.searchParams.has('srsearch')) assert.match(u.searchParams.get('srsearch'), /^intitle:/);
    if (u.searchParams.get('meta') === 'siteinfo') return json({ query: { namespaces: { 102: { id: 102, canonical: 'Author' } } } });
    if (u.searchParams.get('srnamespace') === '102') return json({ query: { search: [{ title: 'Author:Jane Austen' }] } });
    if (u.searchParams.get('list') === 'search') return json({ query: { search: [] } });
    if (u.searchParams.get('action') === 'parse') return json({ parse: { text: '<h2>Works</h2><h3>Novels</h3><ul><li><a href="/wiki/Pride_and_Prejudice">Pride and Prejudice</a></li></ul><h2>Works about Austen</h2><a href="/wiki/Biography">Biography</a>' } });
    return json({ query: { pages: [{ ns: 0, title: 'Pride and Prejudice' }] } });
  });
  const result = await searchCatalog({ query: 'Austen', language: 'en' });
  assert.equal(result.books.length, 1);
  assert.equal(result.books[0].title, 'Pride and Prejudice');
  assert.equal(result.books[0].author, 'Jane Austen');
});

test('many surname title hits do not hide the author bibliography or skip paginated results', async () => {
  const offsets = [];
  const { searchCatalog } = loadCatalog(async request => {
    const url = new URL(request);
    if (url.searchParams.get('meta') === 'siteinfo') return json({ query: { namespaces: { 102: { id: 102, canonical: 'Author' } } } });
    if (url.searchParams.get('srnamespace') === '102') return json({ query: { search: [{ title: 'Author:Jane Austen' }] } });
    if (url.searchParams.get('list') === 'search') {
      const offset = Number(url.searchParams.get('sroffset'));
      assert.equal(url.searchParams.get('srlimit'), '24');
      offsets.push(offset);
      return json({ query: { search: Array.from({ length: 24 }, (_, index) => ({ title: `Austen title ${offset + index}` })) }, continue: { sroffset: offset + 24 } });
    }
    if (url.searchParams.get('action') === 'parse') return json({ parse: { text: '<h2>Works</h2>' + Array.from({ length: 50 }, (_, index) => `<a href="/wiki/Novel_${index}">Novel ${index}</a>`).join('') } });
    const titles = url.searchParams.get('titles').split('|');
    assert.ok(titles.length <= 50, 'canonical lookup must fit the MediaWiki title batch');
    return json({ query: { pages: titles.map(title => ({ ns: 0, title })) } });
  });
  const first = await searchCatalog({ query: 'Austen', language: 'en' });
  const second = await searchCatalog({ query: 'Austen', language: 'en', page: 2 });
  assert.equal(first.books.length, 48);
  assert.equal(first.books[0].title, 'Novel 0');
  assert.equal(first.books[0].author, 'Jane Austen');
  assert.equal(second.books[0].title, 'Novel 24');
  assert.equal(second.books.at(-1).title, 'Austen title 47');
  assert.equal(new Set([...first.books, ...second.books].map(book => book.id)).size, 96);
  assert.deepEqual(offsets, [0, 24]);
});

test('author pages with genre headings expose their works and keep known starter books visible first', async () => {
  const { searchCatalog } = loadCatalog(async request => {
    const url = new URL(request);
    if (url.searchParams.get('meta') === 'siteinfo') return json({ query: { namespaces: { 102: { id: 102, canonical: 'Автор' } } } });
    if (url.searchParams.get('srnamespace') === '102') return json({ query: { search: [{ title: 'Автор:Александр Сергеевич Пушкин' }] } });
    if (url.searchParams.get('list') === 'search') return json({ query: { search: [] } });
    if (url.searchParams.get('action') === 'parse') return json({ parse: { text: '<h2>Стихотворения</h2><a href="/wiki/Стихотворение">Стихотворение</a><h2>Роман в стихах</h2><a href="/wiki/Евгений_Онегин_(Пушкин)">Евгений Онегин</a><h2>Проза</h2><a href="/wiki/Капитанская_дочка_(Пушкин)">Капитанская дочка</a><h2>Произведения о Пушкине</h2><a href="/wiki/Посторонняя_биография">Биография</a><h2>Ссылки</h2><a href="/wiki/Другой_автор">Другой автор</a>' } });
    return json({ query: { pages: url.searchParams.get('titles').split('|').map(title => ({ ns: 0, title })) } });
  });
  const result = await searchCatalog({ query: 'Пушкин', language: 'ru' });
  assert.deepEqual(Array.from(result.books, book => book.title), ['Евгений Онегин (Пушкин)', 'Капитанская дочка (Пушкин)', 'Стихотворение']);
  assert.ok(result.books.every(book => book.author === 'Александр Сергеевич Пушкин'));
});

test('Spanish edition pages return actual editions instead of bibliography text or related works', async () => {
  const { loadCatalogText } = loadCatalog(async () => json({ parse: { title: 'La vida de Lazarillo de Tormes', text:
    '<div class="mw-parser-output"><table class="encabezado"><tr><td class="bloque2">Ediciones de <b>La vida de Lazarillo de Tormes</b><div class="autor">por Anónimo</div></td></tr></table><h2>Ediciones</h2><span class="citation"><a href="/wiki/El_Lazarillo_de_Tormes">El Lazarillo de Tormes</a>. Madrid, 1921.</span><h2>Véase también</h2><a href="/wiki/La_segunda_parte_de_Lazarillo_de_Tormes">Segunda parte</a></div>' } }));
  const result = await loadCatalogText({ language: 'es', sourcePage: 'La vida de Lazarillo de Tormes' });
  assert.equal(result.kind, 'editions'); assert.equal(result.books.length, 1);
  assert.equal(result.books[0].sourcePage, 'El Lazarillo de Tormes');
  assert.equal(result.books[0].author, 'Anónimo');
});

test('TOC containers keep all chapter links before navigation is removed from the imported text', async () => {
  for (const container of ['<div class="toc">', '<div id="toc" class="noprint">']) {
    const calls = [];
    const { loadCatalogText } = loadCatalog(async request => {
      const title = new URL(request).searchParams.get('page'); calls.push(title);
      const content = title === 'Книга'
        ? `<p>Короткая аннотация с отсылкой ко <a href="/wiki/Книга/2">второй главе</a>.</p>${container}<a href="/wiki/Книга/1">Первая</a><a href="/wiki/Книга/2">Вторая</a></div>`
        : `<p>${'Текст главы. '.repeat(20)}</p>`;
      return json({ parse: { title, text: body(title, content) } });
    });
    const result = await loadCatalogText({ sourcePage: 'Книга' });
    assert.equal(result.kind, 'text');
    assert.deepEqual(calls, ['Книга', 'Книга/1', 'Книга/2']);
    assert.equal(result.chapters.length, 2);
    assert.equal(result.chapters[0].title, '1');
    assert.equal(result.chapters[1].title, '2');
    assert.equal(result.chapters.some(chapter => chapter.html.includes('Короткая аннотация')), false);
  }
});

test('a missing chapter hidden in a TOC fails the complete download', async () => {
  const { loadCatalogText } = loadCatalog(async () => json({ parse: { title: 'Книга', text: body('Книга',
    `<div id="toc" class="noprint"><a href="/wiki/Книга/1">Первая</a><a class="new" title="Книга/2 (страница не существует)" href="/w/index.php?title=Книга/2">Вторая</a></div><p>${'Предисловие. '.repeat(80)}</p>`) } }));
  await assert.rejects(loadCatalogText({ sourcePage: 'Книга' }), /отсутствуют главы/);
});

test('book titles and chapter links may contain colons when MediaWiki confirms namespace zero', async () => {
  const calls = [];
  const { loadCatalogText } = loadCatalog(async request => {
    const url = new URL(request), title = url.searchParams.get('page') || url.searchParams.get('titles');
    calls.push([url.searchParams.get('action'), title]);
    if (url.searchParams.get('action') === 'query') return json({ query: { pages: [{ ns: 0, title }] } });
    return json({ parse: { title, text: body(title, title === 'Книга: издание'
      ? '<div class="toc"><a href="/wiki/Книга:_издание/Глава:_первая">Первая глава</a></div>'
      : `<p>${'Полный текст главы. '.repeat(20)}</p>`) } });
  });
  const result = await loadCatalogText({ sourcePage: 'Книга: издание' });
  assert.equal(result.chapters.length, 1);
  assert.equal(result.chapters[0].title, 'Глава: первая');
  assert.deepEqual(calls.filter(([action]) => action === 'query').map(([, title]) => title), ['Книга: издание', 'Книга: издание/Глава: первая']);
});

test('resolved author/service namespaces cannot be imported as books or appear through search redirects', async () => {
  const { loadCatalogText } = loadCatalog(async request => {
    const url = new URL(request);
    if (url.searchParams.get('action') === 'query') return json({ query: { pages: [{ ns: 102, title: 'Author:Someone' }] } });
    return json({ parse: { title: 'Author:Someone', text: body('Someone', `<p>${'Biography. '.repeat(30)}</p>`) } });
  });
  await assert.rejects(loadCatalogText({ sourcePage: 'Author:Someone', language: 'en' }), /страницу произведения/);
  // A main-namespace redirect can also resolve to an author page.
  await assert.rejects(loadCatalogText({ sourcePage: 'Someone', language: 'en' }), /страницу произведения/);

  const { searchCatalog } = loadCatalog(async request => {
    const url = new URL(request);
    if (url.searchParams.get('list') === 'search') return json({ query: { search: [{ ns: 0, title: 'Someone' }] } });
    return json({ query: { pages: [{ ns: 102, title: 'Author:Someone' }], redirects: [{ from: 'Someone', to: 'Author:Someone' }] } });
  });
  assert.equal((await searchCatalog({ query: 'Someone', language: 'en' })).books.length, 0);
});
