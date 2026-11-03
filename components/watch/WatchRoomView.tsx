import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Captions, Check, Copy, ListVideo, Loader2, Maximize, Pause, PictureInPicture2, Play, RotateCcw, RotateCw, SkipForward, Volume2, VolumeX, X, RefreshCw } from 'lucide-react';
import type { User } from '../../types';
import { watchApi } from '../../services/watch/api';
import { makeWatchInvite, parseWatchSource, watchPosition, watchTime, WATCH_RATES } from '../../services/watch/model';
import { ConfirmDialog } from '../ConfirmDialog';
import { ErrorNotice } from '../ErrorNotice';
import { useWatchRoom } from './useWatchRoom';
import { WatchPlayer, type WatchPlayerHandle } from './WatchPlayer';
import { FloatingCinema, type FloatingCinemaHandle } from './FloatingCinema';
import { useLocalCaptions } from './useLocalCaptions';
import { WatchQueue } from './WatchQueue';
import styles from './Watch.module.css';

interface Props { user: User; roomId: string; onRoomChange: (id: string | null) => void; api?: typeof watchApi }
const textError = (error: unknown) => error instanceof Error && /^[А-Яа-яЁё]/.test(error.message) ? error.message : 'Не удалось выполнить действие. Проверьте соединение и повторите.';

export function WatchRoomView({ roomId, user, onRoomChange, api = watchApi }: Props) {
  const sync = useWatchRoom(roomId, api);
  const room = sync.snapshot?.room;
  const player = useRef<WatchPlayerHandle>(null), cinema = useRef<HTMLDivElement>(null), inviteInput = useRef<HTMLInputElement>(null);
  const [duration, setDuration] = useState(0), [volume, setVolume] = useState(.7);
  const [tick, setTick] = useState(0), [seek, setSeek] = useState<string | null>(null);
  const [source, setSource] = useState(''), [sourceError, setSourceError] = useState('');
  const [copied, setCopied] = useState(false), [confirmEnd, setConfirmEnd] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const floating = useRef<FloatingCinemaHandle>(null), captionRoot = useRef<HTMLDivElement>(null), captionButton = useRef<HTMLButtonElement>(null), captionInput = useRef<HTMLInputElement>(null);
  const floatRoot = useRef<HTMLDivElement>(null), floatButton = useRef<HTMLButtonElement>(null);
  const [floatMenu, setFloatMenu] = useState(false);
  const [playerWindow, setPlayerWindow] = useState<Window>(window), [isFloating, setIsFloating] = useState(false);
  const [rates, setRates] = useState<number[]>(WATCH_RATES), [captionOpen, setCaptionOpen] = useState(false), [queueOpen, setQueueOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const captions = useLocalCaptions(room?.mediaUrl || '');
  const shortcuts = useRef<((key: string) => boolean) | null>(null); shortcuts.current = null;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || target?.closest?.('input,textarea,select,[contenteditable="true"],[role="dialog"],[role="menu"]')) return;
      if ([' ', 'Enter'].includes(event.key) && target?.closest?.('button,a,summary')) return;
      if (shortcuts.current?.(event.key.toLowerCase())) event.preventDefault();
    };
    playerWindow.addEventListener('keydown', key);
    return () => playerWindow.removeEventListener('keydown', key);
  }, [playerWindow]);
  useEffect(() => {
    if (!captionOpen && !floatMenu) return;
    const outside = (event: PointerEvent) => {
      if (!captionRoot.current?.contains(event.target as Node)) setCaptionOpen(false);
      if (!floatRoot.current?.contains(event.target as Node)) setFloatMenu(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setCaptionOpen(false); setFloatMenu(false); (floatMenu ? floatButton : captionButton).current?.focus(); } };
    const doc = captionRoot.current?.ownerDocument || document;
    doc.addEventListener('pointerdown', outside); doc.addEventListener('keydown', escape);
    return () => { doc.removeEventListener('pointerdown', outside); doc.removeEventListener('keydown', escape); };
  }, [captionOpen, floatMenu, playerWindow]);
  useEffect(() => { setCaptionOpen(false); }, [room?.mediaUrl]);
  useEffect(() => { setSource(room?.mediaUrl || ''); }, [room?.mediaUrl]);
  useEffect(() => {
    if (!room?.playing) return;
    const timer = window.setInterval(() => setTick(value => value + 1), 250);
    return () => window.clearInterval(timer);
  }, [room?.playing]);
  useEffect(() => () => { if (copyTimer.current !== null) window.clearTimeout(copyTimer.current); }, []);
  void tick;
  if (sync.loading) return <div className={styles.roomLoader} role="status"><Loader2 className={styles.spin} size={28} /><p>Открываем комнату…</p></div>;
  if (!room) return <div className={styles.watchRoot}><button className={styles.back} onClick={() => onRoomChange(null)}><ArrowLeft size={17} />К комнатам</button><ErrorNotice message={sync.error || 'Комната недоступна.'} onRetry={sync.retry} /></div>;
  if (room.closedAt) return <div className={styles.inviteGate}><span className={styles.heroIcon}><Check size={30} /></span><h1>Просмотр завершён</h1><button className={styles.primary} onClick={() => onRoomChange(null)}>К комнатам<ArrowRight size={18} /></button></div>;
  const isOwner = room.ownerId === user.id;
  const invitation = makeWatchInvite(room.id, window.location.origin);
  const position = Math.min(duration || 172800, watchPosition(room, sync.serverNow()));
  const current = seek === null ? position : Number(seek);
  const publish = (time: number, playing: boolean) => { void sync.control('state', { position: Math.max(0, time), playing }); };
  const skip = (seconds: number) => {
    if (sync.busy || !duration) return;
    publish(Math.max(0, Math.min(duration, (player.current?.currentTime() ?? position) + seconds)), room.playing);
  };
  const fullscreen = () => {
    const doc = cinema.current?.ownerDocument || document;
    if (!doc.fullscreenElement && !cinema.current?.requestFullscreen) { setActionError('Полный экран недоступен в этом окне.'); return; }
    const request = doc.fullscreenElement ? doc.exitFullscreen() : cinema.current?.requestFullscreen();
    void request?.catch(() => setActionError('Полный экран недоступен в этом окне.'));
  };
  const toggle = () => {
    if (sync.busy || !duration) return;
    if (room.playing) player.current?.pause(); else player.current?.playFromGesture();
    publish(!room.playing && position >= duration - .2 ? 0 : player.current?.currentTime() ?? position, !room.playing);
  };
  const commitSeek = () => {
    if (seek === null || sync.busy) return;
    void sync.control('state', { position: Number(seek), playing: room.playing }).finally(() => setSeek(null));
  };
  shortcuts.current = key => {
    if (key === ' ' || key === 'k') toggle();
    else if (key === 'arrowleft' || key === 'j') skip(key === 'j' ? -10 : -5);
    else if (key === 'arrowright' || key === 'l') skip(key === 'l' ? 10 : 5);
    else if (key === 'm') setVolume(value => value ? 0 : .7);
    else if (key === 'f') fullscreen();
    else return false;
    return true;
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invitation); setCopied(true);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch { inviteInput.current?.focus(); inviteInput.current?.select(); }
  };
  const changeSource = async (event: FormEvent) => {
    event.preventDefault(); setSourceError('');
    try { await sync.control('source', { source: parseWatchSource(source) }); } catch (failure) { setSourceError(textError(failure)); }
  };
  return <div className={styles.watchRoot}>
    <header className={styles.roomHeader}><div className={styles.roomHeading}><button className={styles.back} onClick={() => onRoomChange(null)}><ArrowLeft size={17} />Комнаты</button><div className={styles.roomTitle}><h1>{room.title}</h1>
      <span className={styles.syncStatus} data-connected={sync.connected} role="status" aria-label={sync.connected ? 'Синхронизация активна' : 'Проверяем связь'} title={sync.connected ? 'Синхронизация активна' : 'Проверяем связь'}><span />{!sync.connected && 'Проверяем связь'}</span></div></div>
      {isOwner && <button className={styles.iconButton} aria-label="Завершить просмотр" title="Завершить просмотр" onClick={() => setConfirmEnd(true)}><X size={19} /></button>}
    </header>
    {sync.error && <ErrorNotice message={sync.error} onRetry={sync.retry} />}
    {actionError && <ErrorNotice message={actionError} onRetry={() => setActionError('')} />}
    {sync.notice && <p role="status" className={styles.notice}>{sync.notice}</p>}
    <div className={styles.roomGrid}>
      <FloatingCinema ref={floating} title={room.title} onWindowChange={setPlayerWindow} onModeChange={setIsFloating} nativeFallback={async () => await player.current?.pictureInPicture() || false}>
      <div className={styles.cinema} ref={cinema}>
        <WatchPlayer ref={player} room={room} serverNow={sync.serverNow} resync={sync.resync} busy={sync.busy} volume={volume} onDuration={setDuration} onIntent={publish}
          onEnded={time => { void sync.control('next', { position: time, playing: true, quiet: true }); }} onRates={setRates} onRateIntent={rate => { void sync.control('rate', { rate }); }} playerWindow={playerWindow} captions={captions.captions} />
        <div className={styles.transport}>
          <div className={styles.timeline}><span>{watchTime(current)}</span><input type="range" aria-label="Позиция видео" min={0} max={duration || 1} step={.1} disabled={!duration || sync.busy} value={Math.min(current, duration || 1)} onChange={event => setSeek(event.target.value)} onPointerUp={commitSeek} onKeyUp={commitSeek} onBlur={commitSeek} /><span>{watchTime(duration)}</span></div>
          <div className={styles.transportRow}><div className={styles.playbackButtons}><button className={styles.playButton} type="button" aria-label={room.playing ? 'Пауза для всех' : 'Воспроизвести для всех'} title={room.playing ? 'Пауза · K' : 'Смотреть · K'} disabled={sync.busy || !duration} onClick={toggle}>
            {sync.busy ? <Loader2 className={styles.spin} size={20} /> : room.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
            <button className={`${styles.iconButton} ${styles.seekButton}`} aria-label="Назад на 10 секунд" title="−10 с · J" disabled={sync.busy || !duration} onClick={() => skip(-10)}><RotateCcw size={18} /></button>
            <button className={`${styles.iconButton} ${styles.seekButton}`} aria-label="Вперёд на 10 секунд" title="+10 с · L" disabled={sync.busy || !duration} onClick={() => skip(10)}><RotateCw size={18} /></button>
            <button className={styles.iconButton} aria-label="Следующее видео" title="Следующее видео" disabled={sync.busy || !sync.snapshot?.queue?.length} onClick={() => void sync.control('next')}><SkipForward size={18} /></button>
          </div><div className={styles.transportTools}>
            <div className={styles.volume}><button type="button" aria-label={volume ? 'Выключить звук у меня' : 'Включить звук у меня'} onClick={() => setVolume(value => value ? 0 : .7)}>{volume ? <Volume2 size={19} /> : <VolumeX size={19} />}</button><input type="range" aria-label="Громкость у меня" min={0} max={1} step={.05} value={volume} onChange={event => setVolume(Number(event.target.value))} /></div>
            <div className={styles.captionControl} ref={captionRoot}>
              <button ref={captionButton} className={styles.iconButton} type="button" aria-label="Субтитры" title="Субтитры" aria-expanded={captionOpen} data-active={captions.enabled} onClick={() => setCaptionOpen(value => !value)}><Captions size={19} /></button>
              {captionOpen && <div className={styles.captionMenu} role="dialog" aria-label="Субтитры">
                {room.provider === 'youtube' && <p className={styles.captionHint}>YouTube: кнопка CC в видео</p>}
                <input ref={captionInput} type="file" accept=".srt,.vtt" aria-label="Файл субтитров" className="sr-only" tabIndex={-1} onChange={event => { void captions.load(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                <button className={styles.secondary} type="button" disabled={captions.loading} onClick={() => captionInput.current?.click()}>{captions.loading ? 'Читаем…' : 'Загрузить SRT / VTT'}</button>
                {captions.file && <><label className={styles.captionToggle}><input type="checkbox" checked={captions.enabled} onChange={event => captions.setEnabled(event.target.checked)} aria-label="Показывать субтитры" /><span title={captions.file.name}>{captions.file.name}</span></label>
                  <div className={styles.captionOffset}><span>Сдвиг</span><button type="button" aria-label="Субтитры раньше на 0,5 с" onClick={() => captions.setOffset(value => Math.max(-60, value - .5))}>−</button><output>{captions.offset > 0 ? '+' : ''}{captions.offset.toFixed(1)} с</output><button type="button" aria-label="Субтитры позже на 0,5 с" onClick={() => captions.setOffset(value => Math.min(60, value + .5))}>+</button></div>
                </>}
                {captions.error && <p className={styles.formError} role="alert">{captions.error}</p>}
              </div>}
            </div>
            <select className={styles.rateSelect} aria-label="Скорость воспроизведения" title="Скорость для всех" value={room.playbackRate || 1} disabled={sync.busy || !duration} onChange={event => void sync.control('rate', { rate: Number(event.target.value) })}>
              {Array.from(new Set([...rates, room.playbackRate || 1])).sort((a,b) => a-b).map(rate => <option value={rate} key={rate}>{rate}×</option>)}
            </select>
            <button className={styles.iconButton} type="button" aria-label="Очередь" title="Очередь" aria-expanded={queueOpen} onClick={() => setQueueOpen(value => !value)}><ListVideo size={19} />{!!sync.snapshot?.queue?.length && <span className={styles.queueBadge}>{sync.snapshot.queue.length}</span>}</button>
            <div className={styles.captionControl} ref={floatRoot}>
              <button ref={floatButton} className={styles.iconButton} type="button" aria-label="Плавающее окно" title={isFloating ? 'Вернуть плеер' : 'Плавающее окно'} aria-expanded={floatMenu} aria-pressed={isFloating} onClick={() => { if (isFloating) floating.current?.toggle(); else setFloatMenu(value => !value); }}><PictureInPicture2 size={19} /></button>
              {floatMenu && <div className={`${styles.captionMenu} ${styles.floatMenu}`} role="dialog" aria-label="Режим окна">
                <button className={styles.secondary} type="button" onClick={() => { setFloatMenu(false); floating.current?.toggle(); }}>Отдельное окно</button>
                <button className={styles.secondary} type="button" onClick={() => { setFloatMenu(false); floating.current?.toggle(true); }}>Мини-плеер</button>
              </div>}
            </div>
            <button className={styles.iconButton} type="button" aria-label="Полный экран" title="Полный экран · F" onClick={fullscreen}><Maximize size={19} /></button>
          </div></div>
        </div>
        {queueOpen && <WatchQueue items={sync.snapshot?.queue || []} isOwner={isOwner} busy={sync.busy} control={sync.control} />}
      </div>
      </FloatingCinema>
      <aside className={styles.roomAside}>
        <section className={styles.smallCard}><div className={styles.sectionHeading}><h2>Участники</h2><span className={styles.count}>{sync.snapshot?.members.length}</span></div>
          <ul className={styles.members}>{sync.snapshot?.members.map(member => <li key={member.userId}><span className={styles.memberAvatar}>{member.avatar ? <img src={member.avatar} alt="" /> : member.name.slice(0, 1).toUpperCase()}</span><span><strong>{member.name}{member.userId === user.id && <small> · Вы</small>}</strong>{member.userId === room.ownerId && <small>Создатель</small>}</span></li>)}</ul>
        </section>
        <section className={styles.smallCard}><h2>Пригласить</h2><div className={styles.inviteField}><input ref={inviteInput} aria-label="Ссылка для друзей" value={invitation} readOnly onFocus={event => event.currentTarget.select()} /><button type="button" aria-label={copied ? 'Скопировано' : 'Скопировать приглашение'} title={copied ? 'Скопировано' : 'Скопировать приглашение'} onClick={() => void copy()}>{copied ? <Check size={17} /> : <Copy size={17} />}</button></div><span className="sr-only" role="status">{copied ? 'Приглашение скопировано' : ''}</span></section>
        <section className={styles.smallCard}><div className={styles.sectionHeading}><h2>Видео</h2><a href={room.mediaUrl} target="_blank" rel="noopener noreferrer" className={styles.iconButton} aria-label="Открыть источник" title="Открыть источник"><ArrowRight size={16} /></a></div>{isOwner && <form className={styles.form} onSubmit={event => void changeSource(event)}><input aria-label="Ссылка на видео" placeholder="Ссылка на видео" value={source} onChange={event => setSource(event.target.value)} disabled={sync.busy} required />{sourceError && <p className={styles.formError} role="alert">{sourceError}</p>}<button className={styles.secondary} type="submit" disabled={sync.busy || source === room.mediaUrl}>Сменить<RefreshCw size={15} /></button></form>}
        </section>
      </aside>
    </div>
    <ConfirmDialog isOpen={confirmEnd} title="Завершить просмотр?" message="Видео остановится у всех участников." confirmLabel="Завершить" isConfirming={sync.busy} onConfirm={async () => { if (await sync.control('close')) setConfirmEnd(false); }} onCancel={() => { if (!sync.busy) setConfirmEnd(false); }} />
  </div>;
}
