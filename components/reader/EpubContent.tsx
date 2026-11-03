import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { EpubDocument, InlineNode, ReadingBlock, findTextRange, inlineText, safeExternalLink, safeImage } from '../../services/epub/document';
import styles from './EpubContent.module.css';

// Split a verse into visual lines while retaining emphasis and links across <br>.
function verseLines(nodes: InlineNode[]): InlineNode[][] {
  const lines: InlineNode[][] = [[]];
  for (const node of nodes) {
    if (node.tag === 'br') { lines.push([]); continue; }
    if (node.children) {
      verseLines(node.children).forEach((children, i) => {
        if (i) lines.push([]);
        lines[lines.length - 1].push({ ...node, children });
      });
    } else lines[lines.length - 1].push(node);
  }
  return lines;
}

interface ContentProps {
  document: EpubDocument;
  blocks: ReadingBlock[];
  onNavigate: (href: string) => void;
  highlight?: { quote: string; color: string };
  paginated?: boolean;
}

export function EpubContent({ document, blocks, onNavigate, highlight, paginated = false }: ContentProps) {
  const range = highlight && findTextRange(blocks.map(block => inlineText(block.children)).join('\n\n'), highlight.quote);
  let cursor = 0;
  let blockOffset = 0;
  let blockCursor = 0;
  const renderInline = (nodes: InlineNode[], prefix: string): React.ReactNode => nodes.map((node, i) => {
    const key = `${prefix}-${i}`;
    if (node.text !== undefined) {
      const start = cursor;
      cursor += node.text.length;
      const from = range ? Math.max(0, range.start - start) : 0;
      const to = range ? Math.min(node.text.length, range.end - start) : 0;
      const text = range && to > from ? <>{node.text.slice(0, from)}<mark style={{ backgroundColor: highlight!.color, color: '#292524' }}>{node.text.slice(from, to)}</mark>{node.text.slice(to)}</> : node.text;
      return paginated ? <span key={key} data-reading-start={blockOffset + start - blockCursor}>{text}</span> : <React.Fragment key={key}>{text}</React.Fragment>;
    }
    if (node.tag === 'br') { cursor++; return <br key={key} />; }
    if (node.tag === 'img') { const start = cursor; cursor += (node.alt || '').length; return safeImage(node.src) ? <img key={key} data-reading-start={paginated ? blockOffset + start - blockCursor : undefined} src={node.src} alt={node.alt || 'Иллюстрация'} loading={paginated ? 'eager' : 'lazy'} /> : null; }
    const children = renderInline(node.children || [], key);
    if (node.tag === 'a') {
      if (node.href && (document.notes[node.href] || document.targets[node.href])) {
        const note = document.notes[node.href];
        return <button type="button" key={key} className={styles.link} aria-label={note ? `Сноска ${inlineText(node.children || []) || note.label}` : undefined} onClick={() => onNavigate(node.href!)}>{children}</button>;
      }
      return safeExternalLink(node.href) ? <a key={key} href={node.href} target="_blank" rel="noopener noreferrer">{children}</a> : <React.Fragment key={key}>{children}</React.Fragment>;
    }
    const tag = node.tag;
    return tag && ['em', 'strong', 'sup', 'sub', 's', 'code', 'ruby', 'rt', 'rp'].includes(tag)
      ? React.createElement(tag, { key }, children) : <React.Fragment key={key}>{children}</React.Fragment>;
  });

  return <article className={`${styles.document} ${paginated ? styles.paginated : ''}`} lang={document.language} dir={paginated ? 'ltr' : document.direction} aria-label="Текст книги">
    {blocks.map(block => {
      blockOffset = block.start;
      blockCursor = cursor;
      const props = { id: `epub-${block.id}`, 'data-epub-block': block.id, dir: document.direction };
      let result: React.ReactNode;
      if (block.kind === 'verse') result = <div key={block.id} {...props} className={styles.verse}>{verseLines(block.children).map((line, i) => {
        if (i) cursor++;
        return <span key={i} className={styles.verseLine}>{renderInline(line, `${block.id}-${i}`)}</span>;
      })}</div>;
      else {
        const children = renderInline(block.children, block.id);
        if (block.kind === 'heading') result = React.createElement(`h${Math.min(4, (block.level || 2) + 1)}`, { ...props, key: block.id, className: block.level === 3 ? styles.stanzaTitle : styles.chapterTitle }, children);
        else if (block.kind === 'quote') result = <blockquote key={block.id} {...props} className={styles.epigraph}>{children}</blockquote>;
        else if (block.kind === 'pre') result = <pre key={block.id} {...props}>{children}</pre>;
        else if (block.kind === 'rule') result = <hr key={block.id} {...props} />;
        else result = <p key={block.id} {...props} className={styles.paragraph}>{children}</p>;
      }
      cursor += 2;
      return result;
    })}
  </article>;
}

export function ReaderDialog({ title, onClose, children, background, color }: {
  title: string; onClose: () => void; children: React.ReactNode; background: string; color: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={styles.dialog} aria-label={title} onCancel={onClose}
    style={{ backgroundColor: background, color }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.dialogHeader}><h3>{title}</h3><button type="button" autoFocus aria-label={`Закрыть: ${title}`} onClick={onClose}><X size={24} /></button></div>
    <div className={styles.dialogBody}>{children}</div>
  </dialog>;
}
