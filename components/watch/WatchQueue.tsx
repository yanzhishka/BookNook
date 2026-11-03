import { useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, ListVideo, Play, Plus, Trash2 } from 'lucide-react';
import { parseWatchSource, sourceTitle, type WatchAction, type WatchCommand, type WatchQueueItem } from '../../services/watch/model';
import styles from './Watch.module.css';

export function WatchQueue({ items, isOwner, busy, control }: {
  items: WatchQueueItem[]; isOwner: boolean; busy: boolean;
  control: (action: WatchAction, values?: WatchCommand) => Promise<boolean>;
}) {
  const [url, setUrl] = useState(''), [title, setTitle] = useState(''), [error, setError] = useState('');
  const add = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    setError('');
    try {
      const source = parseWatchSource(url);
      if (await control('enqueue', { source, title: title.trim() || sourceTitle(source) })) { setUrl(''); setTitle(''); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Проверьте ссылку.'); }
  };
  return <section className={`${styles.smallCard} ${styles.queueCard}`}>
    <div className={styles.sectionHeading}><h2>Очередь</h2><span className={styles.count}>{items.length}</span></div>
    {items.length ? <ol className={styles.queueList}>{items.map((item, index) => <li key={item.id}>
      <button type="button" className={styles.queuePlay} disabled={busy} aria-label={`Смотреть «${item.title}»`} title={item.title} onClick={() => void control('next', { itemId: item.id, playing: true })}>
        <span className={styles.queueThumb}>{item.provider === 'youtube' ? <img src={`https://i.ytimg.com/vi/${item.videoId}/default.jpg`} alt="" /> : <ListVideo size={20} />}<Play size={13} className={styles.queuePlayIcon} /></span>
        <span>{item.title}</span>
      </button>
      {isOwner && <div className={styles.queueActions}>
        <button type="button" disabled={busy || index === 0} aria-label={`Выше: ${item.title}`} title="Выше" onClick={() => void control('move', { itemId: item.id, direction: -1 })}><ArrowUp size={14} /></button>
        <button type="button" disabled={busy || index === items.length - 1} aria-label={`Ниже: ${item.title}`} title="Ниже" onClick={() => void control('move', { itemId: item.id, direction: 1 })}><ArrowDown size={14} /></button>
        <button type="button" disabled={busy} aria-label={`Убрать: ${item.title}`} title="Убрать" onClick={() => void control('remove', { itemId: item.id })}><Trash2 size={14} /></button>
      </div>}
    </li>)}</ol> : <p className={styles.queueEmpty}>Пусто</p>}
    {isOwner && <form className={styles.form} onSubmit={event => void add(event)}>
      <input aria-label="Добавить видео в очередь" placeholder="Ссылка на видео" value={url} onChange={event => setUrl(event.target.value)} disabled={busy || items.length >= 50} required />
      <input aria-label="Название видео в очереди" placeholder="Название (необязательно)" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} disabled={busy || items.length >= 50} />
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <button className={styles.secondary} type="submit" disabled={busy || items.length >= 50}><Plus size={16} />Добавить</button>
    </form>}
  </section>;
}
