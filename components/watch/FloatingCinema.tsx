import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal, Maximize2, PictureInPicture2 } from 'lucide-react';
import styles from './Watch.module.css';

type Mode = 'inline' | 'pip' | 'mini';
interface PictureWindowAPI { requestWindow(options: { width: number; height: number }): Promise<Window> }
declare global { interface Window { documentPictureInPicture?: PictureWindowAPI } }
export interface FloatingCinemaHandle { toggle(preferMini?: boolean): void }

export const FloatingCinema = forwardRef<FloatingCinemaHandle, {
  title: string; children: ReactNode; onWindowChange: (target: Window) => void;
  onModeChange: (floating: boolean) => void; nativeFallback: () => Promise<boolean>;
}>(({ title, children, onWindowChange, onModeChange, nativeFallback }, ref) => {
  const [container] = useState(() => document.createElement('div'));
  const host = useRef<HTMLDivElement>(null), popup = useRef<Window | null>(null);
  const alive = useRef(true), opening = useRef(false);
  const [mode, setMode] = useState<Mode>('inline');
  const [height, setHeight] = useState(300);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const callbacks = useRef({ onWindowChange, onModeChange }); callbacks.current = { onWindowChange, onModeChange };
  const restore = () => {
    const current = popup.current; popup.current = null;
    if (host.current) host.current.append(container);
    if (alive.current) {
      setMode('inline'); setPosition(null);
      callbacks.current.onWindowChange(window); callbacks.current.onModeChange(false);
    }
    if (current && !current.closed) current.close();
  };
  useEffect(() => {
    alive.current = true; host.current?.append(container);
    return () => { alive.current = false; popup.current?.close(); popup.current = null; container.remove(); };
  }, [container]);
  useImperativeHandle(ref, () => ({ toggle: (preferMini = false) => {
    if (mode !== 'inline') { restore(); return; }
    if (opening.current) return;
    opening.current = true;
    setHeight(Math.max(240, container.getBoundingClientRect().height));
    void (async () => {
      if (preferMini) { setMode('mini'); callbacks.current.onModeChange(true); return; }
      if (window.documentPictureInPicture) {
        try {
          const target = await window.documentPictureInPicture.requestWindow({ width: 640, height: 520 });
          if (!alive.current) { target.close(); return; }
          target.document.documentElement.className = document.documentElement.className;
          for (const node of document.head.querySelectorAll('style,link[rel="stylesheet"]')) target.document.head.append(node.cloneNode(true));
          target.document.title = title;
          target.document.body.style.cssText = 'margin:0;background:#0c0a09;overflow:auto';
          popup.current = target;
          target.document.body.append(container);
          target.addEventListener('pagehide', () => { if (popup.current === target) restore(); }, { once: true });
          setMode('pip'); callbacks.current.onWindowChange(target); callbacks.current.onModeChange(true);
          return;
        } catch { /* Continue with native video PiP or the in-page mini-player. */ }
      }
      try { if (await nativeFallback()) return; } catch { /* A denied native window can still use the mini-player. */ }
      if (alive.current) { setMode('mini'); callbacks.current.onModeChange(true); }
    })().finally(() => { opening.current = false; });
  } }));
  useEffect(() => {
    container.className = `${styles.watchRoot} ${styles.floatingShell} ${mode === 'mini' ? styles.floatingMini : mode === 'pip' ? styles.floatingWindow : ''}`;
    container.style.left = mode === 'mini' && position ? `${position.left}px` : '';
    container.style.top = mode === 'mini' && position ? `${position.top}px` : '';
    container.style.right = mode === 'mini' && position ? 'auto' : '';
    container.style.bottom = mode === 'mini' && position ? 'auto' : '';
  }, [mode, position, container]);

  return <><div className={styles.cinemaHost} style={mode === 'inline' ? undefined : { minHeight: height }}>
    <div ref={host} />
    {mode !== 'inline' && <button className={styles.floatingPlaceholder} type="button" aria-label="Вернуть плеер" title="Вернуть плеер" onClick={restore}><PictureInPicture2 size={30} /></button>}
  </div>{createPortal(<>
    {mode !== 'inline' && <div className={styles.floatingHeader}>
      <div className={styles.dragHandle} onPointerDown={event => {
        if (mode !== 'mini' || event.button !== 0) return;
        const rect = container.getBoundingClientRect();
        drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={event => {
        if (!drag.current) return;
        const rect = container.getBoundingClientRect();
        setPosition({ left: Math.max(0, Math.min(window.innerWidth - rect.width, drag.current.left + event.clientX - drag.current.x)),
          top: Math.max(0, Math.min(window.innerHeight - 48, drag.current.top + event.clientY - drag.current.y)) });
      }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        {mode === 'mini' && <GripHorizontal size={16} />}<span>{title}</span>
      </div>
      <button className={styles.iconButton} aria-label="Вернуть плеер" title="Вернуть плеер" onClick={restore}><Maximize2 size={16} /></button>
    </div>}{children}
  </>, container)}</>;
});
FloatingCinema.displayName = 'FloatingCinema';
