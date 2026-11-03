import JSZip from 'jszip';
import { EpubDocument, InlineNode, InlineTag, ReadingBlock, inlineText } from './document';

export interface ImportedEpub {
  document: EpubDocument;
  content: string;
  title: string;
  author: string;
  coverUrl?: string;
}

const localName = (el: Element) => el.localName.toLowerCase();
const descendants = (el: Document | Element, name: string): Element[] =>
  [...el.querySelectorAll('*')].filter(child => localName(child) === name);
const first = (el: Document | Element, name: string) => descendants(el, name)[0];
const semanticType = (el: Element) => `${el.getAttribute('epub:type') || ''} ${el.getAttribute('role') || ''}`;
const normalizeText = (text: string) => text.replace(/[\s\u00a0]+/g, ' ').trim();

export function resolveEpubHref(href: string, from: string): string | null {
  if (!href || /^(?:javascript|data|blob):/i.test(href.trim())) return null;
  try {
    const url = new URL(href, `https://epub.invalid/${from}`);
    if (url.origin !== 'https://epub.invalid') return null;
    return decodeURIComponent(url.pathname.slice(1)) + (url.hash ? `#${decodeURIComponent(url.hash.slice(1))}` : '');
  } catch { return null; }
}

function parseXml(text: string): Document {
  if (/<!ENTITY\s/i.test(text)) throw new Error('XML-сущности в этом EPUB не поддерживаются.');
  return new DOMParser().parseFromString(text, 'application/xhtml+xml');
}

function parseContent(text: string): Document {
  const xml = parseXml(text);
  if (!first(xml, 'parsererror')) return xml;
  // Some EPUB 2 converters put <title> inside body. In an HTML parser its
  // contents become literal markup, so repair this before the recovery parse.
  const body = text.search(/<body\b/i);
  const repaired = body < 0 ? text : text.slice(0, body) + text.slice(body)
    .replace(/<title\b[^>]*>/gi, '<h2>').replace(/<\/title\s*>/gi, '</h2>');
  return new DOMParser().parseFromString(repaired, 'text/html');
}

function decodeXml(bytes: Uint8Array): string {
  const prefix = new TextDecoder('windows-1252').decode(bytes.slice(0, 300));
  const declared = prefix.match(/encoding\s*=\s*["']([^"']+)/i)?.[1];
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
    : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : declared || 'utf-8';
  try { return new TextDecoder(encoding).decode(bytes); }
  catch { throw new Error(`Не поддерживается кодировка EPUB: ${encoding}`); }
}

export async function importEpub(
  input: ArrayBuffer | Uint8Array,
  onProgress: (message: string) => void = () => {},
): Promise<ImportedEpub> {
  if (input.byteLength > 30 * 1024 * 1024) throw new Error('EPUB слишком большой. Максимум — 30 МБ.');
  onProgress('Читаем структуру EPUB...');
  const zip = await JSZip.loadAsync(input);
  const files = Object.values(zip.files);
  if (files.length > 4000) throw new Error('В EPUB слишком много файлов.');
  // Check central-directory sizes before allocating decompressed contents.
  const unpacked = files.reduce((sum, file) => sum +
    ((file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0), 0);
  if (unpacked > 100 * 1024 * 1024) throw new Error('Распакованный EPUB превышает 100 МБ.');
  const read = async (path: string) => {
    const entry = zip.file(path);
    if (!entry) throw new Error(`В EPUB отсутствует файл: ${path}`);
    const bytes = await entry.async('uint8array');
    if (bytes.length > 12 * 1024 * 1024) throw new Error('Раздел EPUB слишком большой.');
    return decodeXml(bytes);
  };
  const container = parseXml(await read('META-INF/container.xml'));
  const rootPath = first(container, 'rootfile')?.getAttribute('full-path');
  if (!rootPath) throw new Error('В EPUB не найден пакет книги (container.xml).');
  const packagePath = resolveEpubHref(rootPath, '');
  if (!packagePath) throw new Error('Некорректный путь пакета EPUB.');
  const opf = parseXml(await read(packagePath));
  if (first(opf, 'parsererror')) throw new Error('Повреждён пакет EPUB.');
  if (descendants(opf, 'meta').some(el => el.getAttribute('property') === 'rendition:layout' && el.textContent?.trim() === 'pre-paginated')) {
    throw new Error('Этот EPUB имеет фиксированную вёрстку. Пока поддерживаются книги с перетекающим текстом.');
  }
  if (zip.file('META-INF/encryption.xml')) {
    const encryption = parseXml(await read('META-INF/encryption.xml'));
    if (descendants(encryption, 'encryptionmethod').some(el => !/embedding|obfuscation/i.test(el.getAttribute('Algorithm') || ''))) {
      throw new Error('Зашифрованные EPUB с DRM не поддерживаются.');
    }
  }
  const title = normalizeText(first(opf, 'title')?.textContent || '') || 'Без названия';
  const author = descendants(opf, 'creator').map(el => normalizeText(el.textContent || '')).filter(Boolean).join(', ') || 'Автор не указан';
  const language = normalizeText(first(opf, 'language')?.textContent || '') || 'ru';
  const manifest = new Map(descendants(opf, 'item').map(el => [el.getAttribute('id') || '', {
    path: resolveEpubHref(el.getAttribute('href') || '', packagePath),
    media: el.getAttribute('media-type') || '', properties: el.getAttribute('properties') || '',
  }]));
  const spine = descendants(opf, 'itemref').map(el => ({ item: manifest.get(el.getAttribute('idref') || ''), linear: el.getAttribute('linear') !== 'no' }));
  if (!spine.length || spine.some(entry => !entry.item?.path)) throw new Error('В EPUB повреждён порядок чтения (spine).');

  const document: EpubDocument = {
    version: 1, format: 'epub', title, author, language,
    direction: /^(ar|he|fa|ur)(-|$)/i.test(language) ? 'rtl' : 'ltr',
    blocks: [], toc: [], targets: {}, notes: {}, warnings: [],
  };
  const warn = (text: string) => { if (!document.warnings.includes(text)) document.warnings.push(text); };
  const imageCache = new Map<string, string>();
  let imageBudget = 0;
  const image = async (path: string): Promise<string | undefined> => {
    if (imageCache.has(path)) return imageCache.get(path);
    const item = [...manifest.values()].find(item => item.path === path);
    const media = item?.media || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[path.split('.').pop()?.toLowerCase() || '']);
    if (!media || !/^image\/(?:jpeg|png|gif|webp)$/.test(media) || !zip.file(path)) {
      warn('Некоторые иллюстрации неподдерживаемого формата пропущены.'); return;
    }
    const bytes = await zip.file(path)!.async('uint8array');
    if (bytes.length > 4 * 1024 * 1024 || imageBudget + bytes.length > 12 * 1024 * 1024) {
      warn('Некоторые крупные иллюстрации пропущены.'); return;
    }
    imageBudget += bytes.length;
    const src = `data:${media};base64,${await zip.file(path)!.async('base64')}`;
    imageCache.set(path, src);
    return src;
  };
  const coverId = descendants(opf, 'meta').find(el => el.getAttribute('name') === 'cover')?.getAttribute('content');
  const cover = (coverId ? manifest.get(coverId) : undefined) || [...manifest.values()].find(item => item.properties.split(/\s+/).includes('cover-image'));
  const coverUrl = cover?.path ? await image(cover.path) : undefined;

  const contentDocs = new Map<string, Document>();
  const loadContent = async (path: string) => {
    if (contentDocs.has(path)) return contentDocs.get(path)!;
    const parsed = parseContent(await read(path));
    contentDocs.set(path, parsed);
    return parsed;
  };
  // Notes may be in a non-linear spine entry or a separate manifest document.
  for (const item of manifest.values()) {
    if (item.path && /(?:xhtml|html)/.test(item.media)) await loadContent(item.path);
  }
  for (const [path, dom] of contentDocs) {
    const body = first(dom, 'body');
    if (!body) continue;
    const images = new WeakMap<Element, string>();
    for (const el of [...descendants(body, 'img'), ...descendants(body, 'image')]) {
      const href = el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('xlink:href');
      const target = href && resolveEpubHref(href, path);
      const src = target ? await image(target.split('#')[0]) : undefined;
      if (src) images.set(el, src);
    }
    const inline = (nodes: Node[], pre = false): InlineNode[] => nodes.flatMap((node): InlineNode[] => {
      if (node.nodeType === 3) return [{ text: pre ? node.textContent || '' : (node.textContent || '').replace(/[\t\r\n ]+/g, ' ') }];
      if (node.nodeType !== 1) return [];
      const el = node as Element;
      const tag = localName(el);
      if (['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'base'].includes(tag)) return [];
      if (tag === 'br') return [{ tag: 'br' }];
      if (tag === 'img' || tag === 'image') return images.has(el) ? [{ tag: 'img', src: images.get(el), alt: el.getAttribute('alt') || 'Иллюстрация' }] : [];
      const children = inline([...el.childNodes], pre);
      if (tag === 'a') {
        const href = el.getAttribute('href');
        if (!href) return children;
        const target = resolveEpubHref(href, path);
        return [{ tag: 'a', href: target || (/^(https?:|mailto:)/i.test(href) ? href : undefined), children }];
      }
      const aliases: Record<string, InlineTag> = { i: 'em', b: 'strong', em: 'em', strong: 'strong', sup: 'sup', sub: 'sub', s: 's', del: 's', code: 'code', ruby: 'ruby', rt: 'rt', rp: 'rp' };
      if (aliases[tag]) return [{ tag: aliases[tag], children }];
      return ['p', 'div', 'li', 'blockquote'].includes(tag) ? [...children, { tag: 'br' }] : children;
    });
    const tidy = (nodes: InlineNode[]) => {
      const result = [...nodes];
      const empty = (node: InlineNode) => node.tag === 'br' || (!node.tag && !normalizeText(node.text || ''));
      while (result.length && empty(result[0])) result.shift();
      while (result.length && empty(result[result.length - 1])) result.pop();
      return result;
    };
    const noteId = (el: Element) => (el.getAttribute('id') || el.getAttribute('name') || '').replace(/^#/, '');
    const isNoteAnchor = (el: Element) => /^(?:n_|fn|note|footnote)[-_]?\d+$/i.test(noteId(el));
    for (const el of [...body.querySelectorAll('*')]) {
      const id = noteId(el);
      if (!id || document.notes[`${path}#${id}`]) continue;
      if (/\b(?:footnote|endnote|doc-footnote|doc-endnote)\b/.test(semanticType(el))) {
        const children = tidy(inline([...el.childNodes]));
        document.notes[`${path}#${id}`] = { label: id.match(/\d+$/)?.[0] || id, children, text: inlineText(children).trim() };
      } else if (isNoteAnchor(el)) {
        const children: InlineNode[] = [];
        for (let sibling = el.nextSibling; sibling; sibling = sibling.nextSibling) {
          if (sibling.nodeType === 1 && isNoteAnchor(sibling as Element) && noteId(sibling as Element) !== id) break;
          children.push(...inline([sibling]));
        }
        const trimmed = tidy(children);
        document.notes[`${path}#${id}`] = { label: id.replace(/^\D+/, ''), children: trimmed, text: inlineText(trimmed).trim() };
      }
    }

    if (!spine.some(entry => entry.linear && entry.item?.path === path)) continue;
    onProgress(`Сохраняем главы: ${document.blocks.length} блоков...`);
    let pendingTargets: string[] = [];
    const add = (kind: ReadingBlock['kind'], raw: InlineNode[], level?: number, sources: Node[] = []) => {
      // Inline anchors can be nested inside headings or paragraphs. Register
      // them with the block emitted from those nodes, including empty anchors.
      for (const node of sources) {
        if (node.nodeType !== 1) continue;
        const element = node as Element;
        for (const target of [element, ...element.querySelectorAll('*')]) {
          const id = noteId(target);
          if (id) pendingTargets.push(`${path}#${id}`);
        }
      }
      const children = kind === 'pre' ? raw : tidy(raw);
      // Text positions must describe exactly what the renderer consumes. In
      // particular, trimming only this string would shift inline text anchors
      // and would discard meaningful indentation from preformatted content.
      const text = inlineText(children);
      if (!text.trim() && kind !== 'rule' && !children.some(node => node.tag === 'img')) return;
      const block: ReadingBlock = { id: `b${document.blocks.length}`, kind, source: path, children, text, start: 0 };
      if (level) block.level = level;
      document.blocks.push(block);
      for (const key of pendingTargets) document.targets[key] = block.id;
      pendingTargets = [];
    };
    const blockTags = new Set(['div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'blockquote', 'p', 'pre', 'ul', 'ol', 'li', 'table', 'figure', 'figcaption', 'title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr']);
    const walk = (container: Element) => {
      let buffer: Node[] = [];
      const flush = () => { if (buffer.length) add('paragraph', inline(buffer), undefined, buffer); buffer = []; };
      for (const node of [...container.childNodes]) {
        if (node.nodeType !== 1) { buffer.push(node); continue; }
        const el = node as Element;
        const tag = localName(el);
        const id = noteId(el);
        if (!blockTags.has(tag)) {
          if (id) pendingTargets.push(`${path}#${id}`);
          buffer.push(node); continue;
        }
        flush();
        if (id) pendingTargets.push(`${path}#${id}`);
        const before = document.blocks.length;
        const raw = inline([...el.childNodes], tag === 'pre');
        const text = inlineText(raw).trim();
        const nested = [...el.children].some(child => blockTags.has(localName(child)));
        if (tag === 'title' || /^h[1-6]$/.test(tag)) {
          const roman = /^[IVXLCDM]+(?:[.\s–-]+[IVXLCDM]+)*\.?$/i.test(text);
          const level = roman || /^[*\s]+$/.test(text) ? 3 : tag === 'title' ? (/^Глава\s/i.test(text) || document.blocks.length < 3 ? 1 : 2) : Math.min(2, Number(tag[1]));
          add('heading', raw, level, [el]);
        } else if (tag === 'hr') add('rule', [], undefined, [el]);
        else if (tag === 'pre') add('pre', raw, undefined, [el]);
        else if (tag === 'table') {
          const rows = descendants(el, 'tr').map(row => [...row.children].map(cell => normalizeText(cell.textContent || '')).join(' | '));
          add('pre', [{ text: rows.join('\n') }], undefined, [el]);
          warn('Таблицы показаны в текстовом виде.');
        } else {
          const lines = text.split('\n').filter(line => normalizeText(line));
          const verse = /stanza|verse|strophe/i.test(`${el.getAttribute('class')} ${semanticType(el)}`) ||
            (!nested && lines.length >= 3 && lines.every(line => line.length < 180));
          if (tag === 'blockquote' && el.classList.contains('epigraph')) add('quote', raw, undefined, [el]);
          else if (verse) add('verse', raw, undefined, [el]);
          else if (nested) walk(el);
          else if (tag === 'blockquote') add('quote', raw, undefined, [el]);
          else if (tag === 'li') add('paragraph', [{ text: '• ' }, ...raw], undefined, [el]);
          else add('paragraph', raw, undefined, [el]);
        }
        if (id && document.blocks[before]) document.targets[`${path}#${id}`] = document.blocks[before].id;
      }
      flush();
    };
    const start = document.blocks.length;
    walk(body);
    if (document.blocks[start]) document.targets[path] = document.blocks[start].id;
  }
  // Manifest order is arbitrary. Restore the exact primary spine order.
  const rank = new Map(spine.filter(entry => entry.linear).map((entry, index) => [entry.item!.path, index]));
  document.blocks.sort((a, b) => (rank.get(a.source) || 0) - (rank.get(b.source) || 0));
  if (!document.blocks.length) throw new Error('В EPUB не найден читаемый текст.');
  let offset = 0;
  for (const block of document.blocks) { block.start = offset; offset += block.text.length + 2; }
  const content = document.blocks.map(block => block.text).join('\n\n');
  const addToc = (label: string, target?: string | null) => {
    const blockId = target && (document.targets[target] || document.targets[target.split('#')[0]]);
    if (label && blockId && !document.toc.some(item => item.blockId === blockId)) document.toc.push({ label: normalizeText(label), blockId });
  };
  const nav = [...manifest.values()].find(item => item.properties.split(/\s+/).includes('nav'));
  if (nav?.path) {
    const dom = await loadContent(nav.path);
    const toc = descendants(dom, 'nav').find(el => /\btoc\b/.test(semanticType(el)));
    for (const link of toc ? descendants(toc, 'a') : []) addToc(link.textContent || '', resolveEpubHref(link.getAttribute('href') || '', nav.path));
  }
  const ncx = [...manifest.values()].find(item => item.media === 'application/x-dtbncx+xml');
  if (!document.toc.length && ncx?.path) {
    const dom = parseXml(await read(ncx.path));
    for (const point of descendants(dom, 'navpoint')) {
      addToc(first(point, 'navlabel')?.textContent || '', resolveEpubHref(first(point, 'content')?.getAttribute('src') || '', ncx.path));
    }
  }
  // Many EPUB 2 books have only one NCX entry, despite containing many chapters.
  for (const block of document.blocks) {
    if (block.kind === 'heading' && (block.level || 3) <= 2 && !document.toc.some(item => item.blockId === block.id)) {
      document.toc.push({ label: normalizeText(block.text), blockId: block.id });
    }
  }
  document.toc.sort((a, b) => document.blocks.findIndex(block => block.id === a.blockId) - document.blocks.findIndex(block => block.id === b.blockId));
  return { document, content, title, author, coverUrl };
}
