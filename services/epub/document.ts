export type InlineTag = 'em' | 'strong' | 'sup' | 'sub' | 's' | 'code' | 'br' | 'a' | 'img' | 'ruby' | 'rt' | 'rp';

export interface InlineNode {
  text?: string;
  tag?: InlineTag;
  children?: InlineNode[];
  href?: string;
  src?: string;
  alt?: string;
}

export interface ReadingBlock {
  id: string;
  kind: 'heading' | 'paragraph' | 'verse' | 'quote' | 'image' | 'rule' | 'pre';
  source: string;
  children: InlineNode[];
  text: string;
  start: number;
  level?: number;
}

export interface EpubDocument {
  version: 1;
  format: 'epub';
  title: string;
  author: string;
  language: string;
  direction: 'ltr' | 'rtl';
  blocks: ReadingBlock[];
  toc: { label: string; blockId: string }[];
  targets: Record<string, string>;
  notes: Record<string, { label: string; children: InlineNode[]; text: string }>;
  warnings: string[];
}

export interface ReadingPage {
  blocks: ReadingBlock[];
  start: number;
  end: number;
}

export function textDocument(content: string, title: string, author: string): EpubDocument {
  const blocks: ReadingBlock[] = [];
  let start = 0;
  const add = (end: number) => {
    const text = content.slice(start, end);
    if (text.trim()) blocks.push({ id: `text-${blocks.length}`, kind: 'paragraph', source: '', start, text, children: [{ text }] });
  };
  for (const match of content.matchAll(/(?:\r?\n[\t ]*){2,}/g)) {
    add(match.index!);
    start = match.index! + match[0].length;
  }
  add(content.length);
  return { version: 1, format: 'epub', title, author, language: 'ru', direction: 'ltr', blocks, toc: [], targets: {}, notes: {}, warnings: [] };
}

export const inlineText = (nodes: InlineNode[]): string => nodes.map(node =>
  node.tag === 'br' ? '\n' : node.tag === 'img' ? node.alt || '' : node.text ?? inlineText(node.children || []),
).join('');

// Fragments are stable across fonts and viewport sizes. A heading stays with
// its following block; a stanza is never cut into arbitrary character slices.
export function paginateDocument(document: EpubDocument, targetLength = 2200): ReadingPage[] {
  const units: ReadingBlock[][] = [];
  let pending: ReadingBlock[] = [];
  for (const block of document.blocks) {
    pending.push(block);
    if (block.kind !== 'heading' && block.kind !== 'rule') {
      units.push(pending);
      pending = [];
    }
  }
  if (pending.length) units.push(pending);
  const pages: ReadingPage[] = [];
  let blocks: ReadingBlock[] = [];
  let length = 0;
  const flush = () => {
    if (!blocks.length) return;
    const last = blocks[blocks.length - 1];
    pages.push({ blocks, start: blocks[0].start, end: last.start + last.text.length });
    blocks = [];
    length = 0;
  };
  for (const unit of units) {
    const size = unit.reduce((sum, block) => sum + block.text.length + 2, 0);
    const chapter = unit.some(block => block.kind === 'heading' && block.level === 1);
    const stanza = unit.some(block => block.kind === 'verse');
    if (blocks.length && (chapter || length + size > targetLength ||
      (stanza && blocks.some(block => block.kind === 'verse')))) flush();
    blocks.push(...unit);
    length += size;
  }
  flush();
  return pages;
}

export function pageForOffset(pages: ReadingPage[], offset: number): number {
  const index = pages.findIndex(page => page.end > offset);
  return index < 0 ? Math.max(0, pages.length - 1) : index;
}

export function findTextRange(text: string, quote: string): { start: number; end: number } | null {
  if (!quote.trim()) return null;
  const exact = text.indexOf(quote);
  if (exact >= 0) return { start: exact, end: exact + quote.length };
  const positions: number[] = [];
  let normalized = '';
  for (let i = 0; i < text.length; i++) {
    const char = /\s/.test(text[i]) ? ' ' : text[i];
    if (char === ' ' && normalized.endsWith(' ')) continue;
    normalized += char;
    positions.push(i);
  }
  const needle = quote.replace(/\s+/g, ' ').trim();
  const start = normalized.indexOf(needle);
  return start < 0 ? null : { start: positions[start], end: positions[start + needle.length - 1] + 1 };
}

// Stored documents can also be written through the Data API. Validate them
// before rendering; the renderer never evaluates imported HTML or CSS.
export function isEpubDocument(value: unknown): value is EpubDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as EpubDocument;
  if (doc.version !== 1 || doc.format !== 'epub' || !Array.isArray(doc.blocks) ||
    !doc.blocks.length || doc.blocks.length > 20000 || !Array.isArray(doc.toc) ||
    !doc.targets || !doc.notes || !Array.isArray(doc.warnings) ||
    typeof doc.title !== 'string' || typeof doc.author !== 'string' || typeof doc.language !== 'string' ||
    !['ltr', 'rtl'].includes(doc.direction)) return false;
  let budget = 200000;
  const tags = new Set(['em', 'strong', 'sup', 'sub', 's', 'code', 'br', 'a', 'img', 'ruby', 'rt', 'rp']);
  const nodesValid = (nodes: unknown, depth = 0): boolean => Array.isArray(nodes) && depth < 16 && nodes.every(node => {
    if (--budget < 0 || !node || typeof node !== 'object') return false;
    if (typeof node.text === 'string') return true;
    return tags.has(node.tag) && (!node.children || nodesValid(node.children, depth + 1));
  });
  return doc.blocks.every(block => block && typeof block.id === 'string' &&
    typeof block.text === 'string' && Number.isFinite(block.start) && block.start >= 0 &&
    ['heading', 'paragraph', 'verse', 'quote', 'image', 'rule', 'pre'].includes(block.kind) && nodesValid(block.children)) &&
    doc.toc.every(item => item && typeof item.label === 'string' && typeof item.blockId === 'string') &&
    Object.values(doc.targets).every(target => typeof target === 'string') &&
    Object.values(doc.notes).every(note => note && typeof note.text === 'string' && typeof note.label === 'string' && nodesValid(note.children));
}

export const safeImage = (src?: string) => Boolean(src && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(src));

export function safeExternalLink(href?: string): boolean {
  if (!href) return false;
  try { return ['https:', 'http:', 'mailto:'].includes(new URL(href).protocol); }
  catch { return false; }
}
