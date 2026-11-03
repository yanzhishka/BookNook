import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, DoorOpen, Film, Loader2, Pause, Play, Plus, RefreshCw } from 'lucide-react';
import type { User } from '../../types';
import { watchApi } from '../../services/watch/api';
import { openGuestWatch, type WatchGuestAccess } from '../../services/watch/guest';
import { parseWatchInvite, parseWatchSource, type WatchRoom } from '../../services/watch/model';
import { ErrorNotice } from '../ErrorNotice';
import { WatchRoomView } from './WatchRoomView';
import styles from './Watch.module.css';

interface Props {
  user: User; roomId: string | null; view: 'home' | 'rooms';
  onRoomChange: (id: string | null) => void; api?: typeof watchApi;
}
const textError = (error: unknown) => error instanceof Error && /^[А-Яа-яЁё]/.test(error.message) ? error.message : 'Не удалось выполнить действие. Проверьте соединение и повторите.';

export function WatchPage(props: Props) {
  return props.user.id === 'guest' ? <GuestWatchPage {...props} /> : <ReadyWatchPage {...props} />;
}

function GuestWatchPage(props: Props) {
  const [access, setAccess] = useState<WatchGuestAccess | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    void openGuestWatch().then(value => { if (active) setAccess(value); })
      .catch(failure => { if (active) setError(textError(failure)); });
    return () => { active = false; };
  }, [revision]);
  if (error) return <div className={styles.watchRoot}><ErrorNotice message={error} onRetry={() => setRevision(value => value + 1)} /></div>;
  if (!access) return <div className={styles.roomLoader} role="status"><Loader2 className={styles.spin} size={28} /><p>Открываем…</p></div>;
  return <ReadyWatchPage {...props} user={{ ...props.user, id: access.userId }} api={access.api} />;
}

function ReadyWatchPage(props: Props) {
  return props.roomId ? <WatchRoomView key={props.roomId} {...props} roomId={props.roomId} /> : <WatchHome {...props} />;
}

function WatchHome({ view, onRoomChange, api = watchApi }: Props) {
  const [rooms, setRooms] = useState<WatchRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [revision, setRevision] = useState(0);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForms, setShowForms] = useState(view === 'home');
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setShowForms(view === 'home'); }, [view]);
  useEffect(() => {
    let active = true;
    setLoading(true); setListError('');
    void api.list().then(value => { if (active) setRooms(value); })
      .catch(failure => { if (active) setListError(textError(failure)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, revision]);
  const create = async (event: FormEvent) => {
    event.preventDefault(); if (lock.current) return;
    setError('');
    try {
      const source = parseWatchSource(url);
      lock.current = true; setCreating(true);
      const result = await api.create(title, source);
      if (alive.current) onRoomChange(result.room.id);
    } catch (failure) { if (alive.current) setError(textError(failure)); }
    finally { lock.current = false; if (alive.current) setCreating(false); }
  };
  const join = (event: FormEvent) => {
    event.preventDefault(); setInviteError('');
    try { onRoomChange(parseWatchInvite(invite)); } catch (failure) { setInviteError(textError(failure)); }
  };

  return <div className={styles.watchRoot}>
    <h1 className="sr-only">{view === 'home' ? 'Просмотр' : 'Комнаты'}</h1>
    {view === 'rooms' && <div className={styles.pageActions}><button className={styles.primary} onClick={() => setShowForms(value => !value)} aria-expanded={showForms}><Plus size={18} />Новая комната</button></div>}
    {showForms && <div className={styles.lobbyGrid}>
      <section className={styles.createCard}>
        <div className={styles.cardBody}><h2>Новая комната</h2>
          <form onSubmit={event => void create(event)} className={styles.form}>
            <input aria-label="Ссылка на видео" type="text" inputMode="url" required value={url} disabled={creating} onChange={event => setUrl(event.target.value)} placeholder="YouTube или MP4 / WebM" />
            <input aria-label="Название комнаты" value={title} maxLength={80} disabled={creating} onChange={event => setTitle(event.target.value)} placeholder="Название (необязательно)" />
            {error && <p className={styles.formError} role="alert">{error}</p>}
            <button className={styles.primary} type="submit" disabled={creating}>{creating ? <Loader2 className={styles.spin} size={18} /> : <Plus size={18} />}{creating ? 'Создаём…' : 'Создать'}</button>
          </form>
        </div>
      </section>
        <section className={styles.joinCard}><h2>По приглашению</h2>
          <form onSubmit={join} className={styles.form}><input aria-label="Ссылка-приглашение" value={invite} onChange={event => setInvite(event.target.value)} required placeholder="Ссылка или код комнаты" />
            {inviteError && <p className={styles.formError} role="alert">{inviteError}</p>}<button type="submit" className={styles.secondary}>Присоединиться<ArrowRight size={17} /></button></form>
        </section>
    </div>}
    <section className={styles.roomsSection}>
      <div className={styles.sectionHeading}><h2>Комнаты</h2>
        <button type="button" className={styles.iconButton} aria-label="Обновить комнаты" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={18} className={loading ? styles.spin : ''} /></button></div>
      {listError && <ErrorNotice message={listError} onRetry={() => setRevision(value => value + 1)} />}
      {loading && !rooms.length ? <p className={styles.empty} role="status">Загружаем…</p> : !rooms.length && !listError ? <div className={styles.empty}><DoorOpen size={22} /><p>Нет открытых комнат</p></div> : <div className={styles.roomCards}>
        {rooms.map(room => <button className={styles.roomCard} key={room.id} onClick={() => onRoomChange(room.id)} aria-label={`Открыть комнату «${room.title}»`}>
          <span className={styles.roomThumb}>{room.provider === 'youtube' ? <img src={`https://i.ytimg.com/vi/${room.videoId}/hqdefault.jpg`} alt="" loading="lazy" /> : <Film size={34} />}<span className={styles.thumbPlay}><Play size={18} fill="currentColor" /></span></span>
          <span className={styles.roomCardText}><strong>{room.title}</strong><span className={styles.roomMeta}><span>{room.provider === 'youtube' ? 'YouTube' : 'Видео'}</span><span title={room.playing ? 'Идёт просмотр' : 'На паузе'}>{room.playing ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}<span className="sr-only">{room.playing ? 'Идёт просмотр' : 'На паузе'}</span></span></span></span>
        </button>)}
      </div>}
    </section>
  </div>;
}
