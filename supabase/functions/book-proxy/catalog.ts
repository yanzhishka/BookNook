/// <reference lib="dom" />
import { parseHTML } from 'npm:linkedom@0.18.15';
import { BOOK_LANGUAGES, languageInfo, wikiUrl, type BookLanguage, type CatalogBook, type CatalogSearch, type CatalogText, type WebChapter } from '../../../shared/bookCatalog.ts';

const AGENT = 'BookNook/1.0 (https://github.com/yanzhishka/BookNook; book discovery)';
const tidy = (value: string) => value.replace(/\s+/g, ' ').trim();
const plain = (html: string) => tidy(parseHTML(`<div>${html}</div>`).document.documentElement.textContent || '');
const normalizeTitle = (title: string) => title.replace(/_/g, ' ').trim();
const titleQuery = (query: string) => (query.match(/[\p{L}\p{N}]+/gu) || []).slice(0, 20).map(word => `intitle:${word}`).join(' ');
const cache = new Map<string, { until: number; value: unknown; size: number }>();
let cachedBytes = 0;
const pending = new Map<string, Promise<unknown>>();

export class CatalogError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

async function fetchJson(url: string): Promise<any> {
  const hit = cache.get(url);
  if (hit && hit.until > Date.now()) return hit.value;
  if (pending.has(url)) return pending.get(url);
  const request = (async () => {
    const response = await fetch(url, { headers: { 'User-Agent': AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new CatalogError('Источник книг временно недоступен. Попробуйте ещё раз.');
    const data = await response.json();
    if (data.error) throw new CatalogError(data.error.code === 'missingtitle' ? 'Страница книги не найдена в источнике.' : 'Источник не смог обработать запрос.', data.error.code === 'missingtitle' ? 404 : 503);
    const size = new TextEncoder().encode(JSON.stringify(data)).byteLength;
    if (size <= 2 * 1024 * 1024) {
      while (cache.size >= 100 || cachedBytes + size > 24 * 1024 * 1024) {
        const key = cache.keys().next().value!; cachedBytes -= cache.get(key)!.size; cache.delete(key);
      }
      if (cache.has(url)) cachedBytes -= cache.get(url)!.size;
      cache.set(url, { until: Date.now() + 5 * 60_000, value: data, size }); cachedBytes += size;
    }
    return data;
  })().catch(error => {
    if (error instanceof CatalogError) throw error;
    throw new CatalogError('Источник книг не ответил вовремя. Попробуйте ещё раз.');
  });
  pending.set(url, request);
  try { return await request; } finally { pending.delete(url); }
}

function wikiApi(language: BookLanguage, params: Record<string, string | number>) {
  const url = new URL(`https://${language}.wikisource.org/w/api.php`);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])) }).toString();
  return fetchJson(url.href);
}

function authorFromTitle(title: string): string {
  return title.split('/')[0].match(/\(([^()]+)\)$/)?.[1] || '';
}

function wikiBook(language: BookLanguage, title: string, extra: Partial<CatalogBook> = {}): CatalogBook {
  return { id: `wiki:${language}:${title}`, provider: 'wikisource', sourcePage: title, sourceUrl: wikiUrl(language, title),
    title: title.split('/').at(-1) || title, author: '', language,
    coverUrl: '', description: '', hasReadableText: true, ...extra };
}

async function booksByAuthor(query: string, language: BookLanguage, page: number) {
  const info = await wikiApi(language, { action: 'query', meta: 'siteinfo', siprop: 'namespaces' });
  const namespace = Object.values(info.query?.namespaces || {}).find((item: any) =>
    /^(Author|Автор|Auteur|Autor|Autore)$/i.test(item.canonical || item.name || '')) as { id: number } | undefined;
  if (!namespace) return { books: [], hasMore: false };
  const authors = await wikiApi(language, { action: 'query', list: 'search', srsearch: titleQuery(query), srnamespace: namespace.id, srlimit: 2 });
  const pages = await Promise.all((authors.query?.search || []).map(async (author: any) => {
    const data = await wikiApi(language, { action: 'parse', page: author.title, prop: 'text', redirects: 1 });
    const { document } = parseHTML(data.parse?.text || '');
    document.querySelectorAll('.ws-noexport,.noprint,.navbox,#toc,.toc,script,style').forEach(node => node.remove());
    let sectionLevel = 0;
    const works: { title: string; author: string; snippet: string }[] = [];
    for (const node of document.querySelectorAll('h2,h3,h4,a[href]')) {
      if (/^H[234]$/.test(node.tagName)) {
        const heading = tidy(node.textContent || '').toLocaleLowerCase();
        const level = Number(node.tagName[1]);
        if (sectionLevel && level <= sectionLevel) sectionLevel = 0;
        if (/about|sur |über|sobre|acerca|биограф|біограф|литература|література|посилання|ссылки|sources|external/.test(heading) || /^(?:произведения|книги|твори)\s+(?:о|об|про)\s/.test(heading)) { sectionLevel = 0; continue; }
        // Many authors have genre sections directly, without a parent Works
        // heading (e.g. Pushkin: Poems, Verse novel, Prose).
        if (!sectionLevel && /^(works|œuvres|oeuvres|ouvrages|произведения|стихотворения|поэзия|поэмы|роман|романы|повести|рассказы|сказки|проза|пьесы|драматические произведения|исторические произведения|отрывки и наброски|переводы|письма|публицистика|критика и публицистика|твори|творчість|праці|поезії|поеми|повісті|оповідання|переклади|novels|poetry|poems|short stories|plays|essays|letters|werke|obras|opere|utwory|dzieła|bibliografia|bibliographie)(\s|$)/iu.test(heading)) sectionLevel = level;
        continue;
      }
      if (!sectionLevel || node.classList.contains('new')) continue;
      const title = linkedTitle(node.getAttribute('href') || '', language);
      if (title && !title.includes('/')) works.push({ title, author: author.title.split(':').slice(1).join(':').trim(), snippet: '' });
    }
    return works;
  }));
  const books = [...new Map(pages.flat().map((book: any) => [book.title, book])).values()];
  const titleKey = (title: string) => normalizeTitle(title).replace(/\s+\([^()]+\)$/, '').toLocaleLowerCase();
  const starters = languageInfo(language)!.starters.map(titleKey);
  const rank = (title: string) => { const index = starters.indexOf(titleKey(title)); return index < 0 ? starters.length : index; };
  books.sort((left, right) => rank(left.title) - rank(right.title));
  return { books: books.slice((page - 1) * 24, page * 24), hasMore: books.length > page * 24 };
}

async function wikiSearch(query: string, language: BookLanguage, page: number): Promise<CatalogSearch> {
  if (!query) {
    const titles = languageInfo(language)!.starters.join('|');
    const data = await wikiApi(language, { action: 'query', titles, redirects: 1, prop: 'info|pageprops' });
    return { books: (data.query?.pages || []).filter((book: any) => !book.missing && book.ns === 0 && !Object.hasOwn(book.pageprops || {}, 'disambiguation'))
      .map((book: any) => wikiBook(language, book.title)), hasMore: false, warnings: [] };
  }
  // A common surname can fill every title hit. Search author bibliographies in
  // parallel rather than suppressing them when there are many title matches.
  const [data, bibliography] = await Promise.all([
    wikiApi(language, { action: 'query', list: 'search', srsearch: titleQuery(query), srnamespace: 0, srlimit: 24, sroffset: (page - 1) * 24, srprop: 'snippet' }),
    booksByAuthor(query, language, page).catch(() => ({ books: [], hasMore: false })),
  ]);
  const candidates = (data.query?.search || []).filter((book: any) => !book.title.includes('/'));
  const titleMatches = candidates.filter((book: any) => {
    const edition = book.title.match(/^(.*) \(\d{4}\)$/);
    return !edition || !candidates.some((other: any) => other.title === edition[1]);
  });
  // An author's bibliography supplies works whose title does not contain their
  // name. Never fall back to mentions of the query inside unrelated books.
  const roots: any[] = [];
  for (const book of [...bibliography.books, ...titleMatches]) {
    if (roots.length < 50 && !roots.some(item => item.title === book.title)) roots.push(book);
  }
  const hasMore = Boolean(data.continue) || bibliography.hasMore;
  if (!roots.length) return { books: [], hasMore, warnings: [] };
  const canonical = await wikiApi(language, { action: 'query', titles: roots.map((book: any) => book.title).join('|'), redirects: 1, prop: 'info|pageprops' });
  const byTitle = new Map((canonical.query?.pages || []).filter((book: any) => book.ns === 0 && !book.missing && !Object.hasOwn(book.pageprops || {}, 'disambiguation')).map((book: any) => [book.title, book]));
  const aliases = new Map((canonical.query?.redirects || []).map((item: any) => [item.from, item.to]));
  const books: CatalogBook[] = [];
  for (const book of roots) {
    const title = String(aliases.get(book.title) || book.title);
    if (!byTitle.has(title) || books.some(item => item.sourcePage === title)) continue;
    books.push(wikiBook(language, title, { author: book.author || '', description: plain(book.snippet || '') }));
  }
  return { books, hasMore, warnings: [] };
}

async function catalogSearch(query: string, language: BookLanguage, page: number): Promise<CatalogSearch> {
  if (!query) return { books: [], hasMore: false, warnings: [] };
  const url = new URL('https://openlibrary.org/search.json');
  url.search = new URLSearchParams({ q: `${query} language:${languageInfo(language)!.catalogCode}`, lang: language,
    fields: 'key,title,author_name,cover_i,first_publish_year', limit: '12', page: String(page) }).toString();
  const data = await fetchJson(url.href);
  return { books: (data.docs || []).map((book: any): CatalogBook => ({ id: `ol:${book.key}`, provider: 'openlibrary', sourcePage: book.key,
    sourceUrl: `https://openlibrary.org${book.key}`, title: book.title || 'Без названия', author: (book.author_name || []).join(', '),
    language, coverUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : '', description: '',
    hasReadableText: false, firstPublishYear: book.first_publish_year })), hasMore: Number(data.numFound) > page * 12, warnings: [] };
}

export async function searchCatalog(input: { query?: string; language?: string; page?: number; onlyReadable?: boolean }): Promise<CatalogSearch> {
  const language = input.language || 'ru';
  if (!languageInfo(language)) throw new CatalogError('Выберите язык из списка.', 400);
  const query = tidy(String(input.query || '')).slice(0, 140);
  if (query && !titleQuery(query)) throw new CatalogError('Введите название книги или имя автора.', 400);
  const page = Math.max(1, Math.min(20, Math.floor(Number(input.page) || 1)));
  const jobs = [wikiSearch(query, language as BookLanguage, page)];
  if (input.onlyReadable === false) jobs.push(catalogSearch(query, language as BookLanguage, page));
  const outcomes = await Promise.allSettled(jobs);
  if (outcomes.every(outcome => outcome.status === 'rejected')) throw new CatalogError('Не удалось связаться с источниками книг. Попробуйте ещё раз.');
  const result: CatalogSearch = { books: [], hasMore: false, warnings: [] };
  outcomes.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') { result.books.push(...outcome.value.books); result.hasMore ||= outcome.value.hasMore; }
    else result.warnings.push(index === 0 ? 'Викитека сейчас недоступна. Показаны только карточки книг.' : 'Дополнительный каталог сейчас недоступен. Показаны книги с открытым текстом.');
  });
  const seen = new Set<string>();
  result.books = result.books.filter(book => {
    const key = `${book.title.toLocaleLowerCase().replace(/[\p{P}\s]+/gu, '')}:${book.author.toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  if (page >= 20) result.hasMore = false;
  return result;
}

function linkedTitle(href: string, language: BookLanguage): string | null {
  try {
    const url = new URL(href, `https://${language}.wikisource.org`);
    if (url.origin !== `https://${language}.wikisource.org` || !url.pathname.startsWith('/wiki/')) return null;
    const title = normalizeTitle(decodeURIComponent(url.pathname.slice(6)));
    return title || null;
  } catch { return null; }
}

export function parseWikiPage(html: string, title: string, language: BookLanguage) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  document.querySelectorAll('script,style,noscript').forEach(node => node.remove());
  const header = document.querySelector('#headertemplate,.ws-header,.wst-header,.headertemplate,.encabezado');
  const titleElement = document.querySelector('#ws-title,.encabezado .bloque2 b');
  const headerText = tidy(document.querySelector('.wst-header-central-cell')?.textContent || titleElement?.textContent || header?.textContent || '');
  const bookTitle = tidy(titleElement?.textContent || title.split('/')[0].replace(/\s+\([^()]+\)$/, ''));
  const authorLink = document.querySelector('a[title^="Автор:"],a[title^="Author:"],a[title^="Auteur:"],a[title^="Autor:"],a[title^="Autore:"]');
  const author = tidy(document.querySelector('#ws-author,#header_author_text,.encabezado .autor')?.textContent || authorLink?.textContent || authorFromTitle(title))
    .replace(/^(автор|by|par|von|por)\s+/i, '');
  const editionsHeader = tidy(document.querySelector('.encabezado .bloque2')?.textContent || headerText);
  // A TOC can also be marked noprint/ws-noexport. Keep its chapter links even
  // when an ancestor is removed with the other non-book source navigation.
  const tocLinks = [...document.querySelectorAll('#toc a[href],.toc a[href]')];
  document.querySelectorAll('.ws-noexport,.noprint,.mw-editsection,#headertemplate,.ws-header,.wst-header,.headertemplate,.encabezado,#headerContainer,.catlinks,.printfooter,.mw-empty-elt,.Z3988').forEach(node => node.remove());
  const root = document.querySelector('.mw-parser-output') || document.body;
  const links = [...tocLinks, ...root.querySelectorAll('a[href]')].filter(link => !link.classList.contains('new'))
    .map(link => ({ title: linkedTitle(link.getAttribute('href') || '', language), label: tidy(link.textContent || '') }))
    .filter((item): item is { title: string; label: string } => Boolean(item.title && item.title !== title));
  const descendants = [...new Map(links.filter(item => item.title.startsWith(`${title}/`)).map(item => [item.title, item])).values()];
  const children = descendants.filter(item => !descendants.some(parent => item.title.startsWith(`${parent.title}/`)));
  const versions = /список редакций|versions of|editions of|éditions de|разные издания|ediciones de|edizioni di|edições de|wersje|wydania|ausgaben|редакції|видання/i.test(editionsHeader);
  const citedEditions = [...root.querySelectorAll('.citation a[href]')].map(link => ({ title: linkedTitle(link.getAttribute('href') || '', language), label: tidy(link.closest('.citation')?.textContent || link.textContent || '') }))
    .filter((item): item is { title: string; label: string } => Boolean(item.title && item.title !== title));
  const editions = versions ? [...new Map([...links.filter(item => item.title.startsWith(`${title}/`) || item.title.startsWith(`${title} (`)), ...citedEditions]
    .map(item => [item.title, item])).values()].filter(item => !/глава|chapter|пропущенн|отрывк/i.test(item.label)) : [];
  const missingChildren = [...root.querySelectorAll('a.new'), ...tocLinks.filter(link => link.classList.contains('new'))]
    .some(link => normalizeTitle(link.getAttribute('title') || '').startsWith(`${title}/`));
  // Wikisource can put links to separate chapters inside its TOC container.
  // Discover those links (including missing chapters) before removing the menu.
  root.querySelectorAll('#toc,.toc').forEach(node => node.remove());
  // A contents table is navigation, not a chapter. Keep actual prefaces, but
  // avoid importing source page numbers and catalogue rows as the book text.
  root.querySelectorAll('table,ul,ol,nav').forEach(node => {
    if (node.matches('.references') || node.closest('.references')) return;
    const count = [...node.querySelectorAll('a[href]')].filter(link => {
      const target = linkedTitle(link.getAttribute('href') || '', language);
      return target?.startsWith(`${title}/`);
    }).length;
    if (count >= 2 && ![...node.querySelectorAll('p')].some(p => tidy(p.textContent || '').length > 500)) node.remove();
  });
  root.querySelectorAll('.references li[id],[role="doc-endnote"]').forEach(node => node.setAttribute('role', 'doc-footnote'));
  const proseLength = [...root.querySelectorAll('p,.poem,pre')].filter(node => !node.closest('.references'))
    .reduce((sum, node) => sum + tidy(node.textContent || '').length, 0);
  return { title, bookTitle: bookTitle.replace(/^Список редакций:\s*/i, ''), author, root, children, versions, editions, proseLength, missingChildren };
}

async function fetchWikiPage(language: BookLanguage, title: string) {
  const data = await wikiApi(language, { action: 'parse', page: title, prop: 'text|properties', redirects: 1 });
  if (!data.parse?.text) throw new CatalogError('В источнике отсутствует текст этого издания.', 404);
  // A colon can be part of a real book title. Only MediaWiki knows whether the
  // resolved title denotes a book (namespace 0) or e.g. an author/category page.
  if (data.parse.title.includes(':')) {
    const info = await wikiApi(language, { action: 'query', titles: data.parse.title, redirects: 1, prop: 'info' });
    const page = info.query?.pages?.[0];
    if (!page || page.missing || page.ns !== 0) throw new CatalogError('Выберите страницу произведения, а не служебный раздел источника.', 400);
  }
  return parseWikiPage(data.parse.text, data.parse.title, language);
}

async function orderedPool<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = new Array(items.length);
  let next = 0, failed = false;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && !failed) { const index = next++; try { output[index] = await run(items[index]); } catch (error) { failed = true; throw error; } }
  }));
  return output;
}

export async function loadCatalogText(input: { language?: string; sourcePage?: string }): Promise<CatalogText> {
  const started = Date.now();
  const language = input.language || 'ru';
  const title = normalizeTitle(String(input.sourcePage || ''));
  if (!BOOK_LANGUAGES.some(item => item.code === language) || !title || title.length > 500 || /^(?:[a-z][a-z0-9+.-]*:\/\/|\/\/)/i.test(title) || /[\x00-\x1f|]/.test(title)) {
    throw new CatalogError('Некорректный адрес книги.', 400);
  }
  const lang = language as BookLanguage;
  const first = await fetchWikiPage(lang, title);
  const rootTitle = first.title;
  if (first.versions) {
    if (!first.editions.length) throw new CatalogError('В источнике не найдено доступных изданий. Загрузите свой EPUB.', 404);
    return { kind: 'editions', books: first.editions.slice(0, 12).map(edition => wikiBook(lang, edition.title,
      { title: first.bookTitle, author: first.author, editionLabel: edition.label })) };
  }
  let bytes = 0;
  const visited = new Set<string>();
  let available = 4;
  const waiters: (() => void)[] = [];
  const getPage = async (pageTitle: string) => {
    if (available) available--; else await new Promise<void>(resolve => waiters.push(resolve));
    try {
      if (Date.now() - started > 40_000) throw new CatalogError('Источник отвечает слишком долго. Попробуйте повторить загрузку.');
      return await fetchWikiPage(lang, pageTitle);
    }
    finally { const next = waiters.shift(); if (next) next(); else available++; }
  };
  const walk = async (pageTitle: string, depth: number, parsed?: Awaited<ReturnType<typeof fetchWikiPage>>): Promise<WebChapter[]> => {
    if (visited.has(pageTitle)) return [];
    if (visited.size >= 120 || depth > 4) throw new CatalogError('Книга слишком большая для автоматической загрузки. Добавьте её файлом EPUB.', 422);
    visited.add(pageTitle);
    const page = parsed || await getPage(pageTitle);
    if (page.versions) throw new CatalogError('Внутри книги обнаружен список изданий. Выберите другое издание или загрузите EPUB.', 422);
    if (page.missingChildren) throw new CatalogError('В этом издании отсутствуют главы. Выберите другое издание или загрузите EPUB.', 422);
    const own: WebChapter[] = [];
    if (!page.children.length || page.proseLength > 500) {
      const html = page.root.innerHTML;
      bytes += new TextEncoder().encode(html).byteLength;
      if (bytes > 8 * 1024 * 1024) throw new CatalogError('Текст слишком большой. Добавьте книгу файлом EPUB.', 422);
      own.push({ title: pageTitle === rootTitle ? first.bookTitle : pageTitle.slice(rootTitle.length + 1).split('/').join(' · '),
        url: wikiUrl(lang, pageTitle), html });
    }
    const groups = await orderedPool(page.children, 4, child => walk(child.title, depth + 1));
    return [...own, ...groups.flat()];
  };
  const chapters = await walk(first.title, 0, first);
  if (!chapters.length || chapters.every(chapter => plain(chapter.html).length < 40)) throw new CatalogError('В источнике нет читаемого текста. Выберите другое издание.', 404);
  return { kind: 'text', title: first.bookTitle, author: first.author || 'Автор не указан', language: lang, sourceUrl: wikiUrl(lang, first.title), chapters };
}
