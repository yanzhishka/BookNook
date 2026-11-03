import JSZip from 'jszip';
import type { CatalogText } from '../../shared/bookCatalog';
import { importEpub } from './import';

const xml = (value: string) => value.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]!));

// Reuse the safe EPUB importer; source HTML never enters the app DOM.
export async function importWebBook(book: Extract<CatalogText, { kind: 'text' }>, onProgress: (message: string) => void) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>');
  const paths = new Map(book.chapters.map((chapter, index) => [decodeURIComponent(new URL(chapter.url).pathname), `chapter${index}.xhtml`]));
  let externalImages = false;
  for (const [index, chapter] of book.chapters.entries()) {
    onProgress(`Подготавливаем главу ${index + 1} из ${book.chapters.length}…`);
    const dom = new DOMParser().parseFromString(chapter.html, 'text/html');
    dom.querySelectorAll('script,style,iframe,object,embed,form,input,button,link,base').forEach(node => node.remove());
    for (const link of dom.querySelectorAll('a[href]')) {
      const href = link.getAttribute('href')!;
      if (href.startsWith('#')) continue;
      try {
        const target = new URL(href, chapter.url);
        const local = target.origin === new URL(chapter.url).origin && paths.get(decodeURIComponent(target.pathname));
        link.setAttribute('href', local ? `${local}${target.hash}` : target.href);
      } catch { link.removeAttribute('href'); }
    }
    if (dom.querySelector('img,svg')) externalImages = true;
    dom.querySelectorAll('img,svg').forEach(node => node.remove());
    const content = [...dom.body.childNodes].map(node => new XMLSerializer().serializeToString(node)).join('');
    zip.file(`chapter${index}.xhtml`, `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${xml(chapter.title)}</title></head><body><h1>${xml(chapter.title)}</h1>${content}</body></html>`);
  }
  zip.file('source.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Об источнике</h1><p>Текст получен из Викитеки.</p><p><a href="${xml(book.sourceUrl)}">Страница произведения и сведения об издании</a></p></body></html>`);
  zip.file('book.opf', `<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>${xml(book.title)}</dc:title><dc:creator>${xml(book.author)}</dc:creator><dc:language>${xml(book.language)}</dc:language></metadata><manifest>${book.chapters.map((_, index) => `<item id="c${index}" href="chapter${index}.xhtml" media-type="application/xhtml+xml"/>`).join('')}<item id="source" href="source.xhtml" media-type="application/xhtml+xml"/></manifest><spine>${book.chapters.map((_, index) => `<itemref idref="c${index}"/>`).join('')}<itemref idref="source"/></spine></package>`);
  const result = await importEpub(await zip.generateAsync({ type: 'uint8array' }), onProgress);
  if (externalImages) result.document.warnings.push('Внешние иллюстрации доступны на странице источника.');
  return result;
}
