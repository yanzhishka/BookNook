import { RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react';

const GAP = 32;
export function pageAtOffset(anchors: number[], offset: number): number {
  if (offset <= 0) return 0;
  let low = 0, high = anchors.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (anchors[middle] <= offset) low = middle + 1;
    else high = middle;
  }
  return Math.max(0, low - 1);
}

// Browser fragmentation does the typesetting. These anchors map its visual
// columns back to text positions, independent of font, screen or orientation.
function measureAnchors(flow: HTMLElement, width: number, length: number): number[] {
  const step = width + GAP;
  const count = Math.max(1, Math.ceil((flow.scrollWidth + GAP - 1) / step));
  const anchors = new Array<number>(count).fill(-1);
  const bounds = flow.getBoundingClientRect();
  // Font-size feedback scales the visible spread without changing its layout.
  // Normalize coordinates if a resize or image load arrives during that motion.
  const scale = bounds.width / parseFloat(getComputedStyle(flow).width) || 1;
  const pageOf = (rect: DOMRect) => Math.max(0, Math.min(count - 1, Math.floor(((rect.left - bounds.left) / scale + 1) / step)));
  for (const leaf of flow.querySelectorAll<HTMLElement>('[data-reading-start]')) {
    const start = Number(leaf.dataset.readingStart);
    const rects = [...leaf.getClientRects()].filter(rect => rect.height > 0);
    if (!rects.length) continue;
    let texts: { node: Text; start: number; end: number }[] | undefined;
    for (const rect of rects) {
      const page = pageOf(rect);
      if (anchors[page] >= 0) continue;
      if (page === pageOf(rects[0]) || !leaf.textContent) { anchors[page] = start; continue; }
      if (!texts) {
        texts = [];
        const walker = document.createTreeWalker(leaf, NodeFilter.SHOW_TEXT);
        let node: Node | null, offset = 0;
        while ((node = walker.nextNode())) {
          texts.push({ node: node as Text, start: offset, end: offset + (node.textContent?.length || 0) });
          offset += node.textContent?.length || 0;
        }
      }
      const range = document.createRange();
      const charPage = (index: number) => {
        const text = texts!.find(text => text.end > index) || texts![texts!.length - 1];
        if (!text) return page;
        const offset = Math.min(text.node.length - 1, Math.max(0, index - text.start));
        range.setStart(text.node, offset);
        range.setEnd(text.node, offset + 1);
        return pageOf(range.getBoundingClientRect());
      };
      let low = 0, high = leaf.textContent.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (charPage(middle) < page) low = middle + 1;
        else high = middle;
      }
      anchors[page] = Math.min(length, start + low);
    }
  }
  anchors[0] = 0;
  for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i - 1], anchors[i] < 0 ? anchors[i - 1] : anchors[i]);
  return anchors;
}

export function useScreenPages(viewport: RefObject<HTMLDivElement>, flow: RefObject<HTMLDivElement>, initialOffset: number, length: number, layoutKey: string) {
  const anchor = useRef(initialOffset);
  const anchors = useRef([0]);
  const [layout, setLayout] = useState({ page: 0, count: 1, ready: false, width: 0 });
  useLayoutEffect(() => {
    const box = viewport.current, content = flow.current;
    if (!box || !content) return;
    let frame = 0, disposed = false;
    const measure = () => {
      if (disposed) return;
      const fontSize = parseFloat(getComputedStyle(content).fontSize);
      const inset = Math.ceil(fontSize / 2);
      const width = Math.floor(box.clientWidth), height = Math.floor(box.clientHeight) - inset * 2;
      if (width < 1 || height < 1) return;
      content.style.setProperty('--reader-page-width', `${width}px`);
      const columns = width >= 1100 ? 2 : 1;
      content.style.setProperty('--reader-column-width', `${(width - GAP * (columns - 1)) / columns}px`);
      content.style.setProperty('--reader-page-height', `${height}px`);
      content.style.setProperty('--reader-page-gap', `${GAP}px`);
      content.style.height = `${height}px`;
      content.style.marginTop = `${inset}px`;
      anchors.current = measureAnchors(content, width, length);
      const page = pageAtOffset(anchors.current, anchor.current);
      const count = anchors.current.length;
      setLayout(previous => previous.page === page && previous.count === count && previous.width === width && previous.ready
        ? previous : { page, count, width, ready: true });
    };
    const schedule = () => { if (!disposed) { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); } };
    const observer = new ResizeObserver(schedule);
    observer.observe(box);
    content.addEventListener('load', schedule, true);
    document.fonts.addEventListener('loadingdone', schedule);
    void document.fonts.ready.then(schedule);
    measure();
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); content.removeEventListener('load', schedule, true); document.fonts.removeEventListener('loadingdone', schedule); };
  }, [viewport, flow, length, layoutKey]);

  const move = useCallback((page: number, exactOffset?: number) => {
    const clamped = Math.max(0, Math.min(anchors.current.length - 1, page));
    anchor.current = exactOffset ?? anchors.current[clamped];
    setLayout(previous => ({ ...previous, page: clamped }));
  }, []);
  return { ...layout, offset: anchor.current, move,
    offsetForPage: (page: number) => anchors.current[page] ?? 0,
    pageForOffset: (offset: number) => pageAtOffset(anchors.current, offset),
    transform: `translateX(${-layout.page * (layout.width + GAP)}px)`,
  };
}
