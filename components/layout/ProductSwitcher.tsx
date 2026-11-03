import { useEffect, useId, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, Play } from 'lucide-react';
import { PRODUCTS, type Product } from '../../services/ecosystem';
import styles from './ProductSwitcher.module.css';

export function ProductSwitcher({ product, onChange }: { product: Product; onChange: (product: Product) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const selected = PRODUCTS.find(item => item.id === product)!;
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, [open]);
  return <div ref={root} className={styles.switcher}>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={`Проекты: ${selected.name}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span className={styles.mark}>{product === 'books' ? 'B' : <Play size={20} fill="currentColor" />}</span>
      <span className={styles.name}>{selected.name}</span><ChevronDown size={17} className={open ? styles.chevronOpen : styles.chevron} />
    </button>
    <div className={`${styles.reveal} ${open ? styles.revealOpen : ''}`} {...(!open ? { inert: '' } : {})} aria-hidden={!open}>
      <nav id={id} className={styles.panel} aria-label="Проекты экосистемы">
        {PRODUCTS.map(item => <button key={item.id} type="button" aria-current={product === item.id ? 'true' : undefined}
          onClick={() => { onChange(item.id); setOpen(false); trigger.current?.focus(); }}>
          <span className={styles.icon}>{item.id === 'books' ? <BookOpen size={20} /> : <Play size={20} />}</span>
          <span className={styles.copy}><strong>{item.name}</strong></span>
          {product === item.id && <Check size={16} className={styles.check} />}
        </button>)}
      </nav>
    </div>
  </div>;
}
