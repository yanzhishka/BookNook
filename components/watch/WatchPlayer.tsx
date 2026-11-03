import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Play, RotateCw } from 'lucide-react';
import { loadYouTube, type YouTubePlayer } from '../../services/watch/youtube';
import { WATCH_RATES, watchPlaybackKey, watchPosition, type WatchRoom } from '../../services/watch/model';
import { subtitleText, type SubtitleCue } from '../../services/watch/subtitles';
import styles from './Watch.module.css';

export interface WatchPlayerHandle { playFromGesture(): void; pause(): void; currentTime(): number; pictureInPicture(): Promise<boolean> }
export interface LocalCaptions { src: string; label: string; cues: SubtitleCue[]; offset: number; enabled: boolean }
interface Props {
  room: WatchRoom; serverNow: () => number; resync: number; volume: number; busy: boolean;
  onDuration: (duration: number) => void; onIntent: (position: number, playing: boolean) => void;
  onEnded?: (duration: number) => void; onRates?: (rates: number[]) => void; onRateIntent?: (rate: number) => void;
  captions?: LocalCaptions; playerWindow?: Window;
}

export const WatchPlayer = forwardRef<WatchPlayerHandle, Props>((props, ref) => {
  const latest = useRef(props); latest.current = props;
  const video = useRef<HTMLVideoElement>(null);
  const youtubeContainer = useRef<HTMLDivElement>(null);
  const youtube = useRef<YouTubePlayer | null>(null);
  const ready = useRef(false), hasPlayed = useRef(false), suppressedUntil = useRef(0);
  const activated = useRef(false);
  const appliedState = useRef('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsPlay, setNeedsPlay] = useState(false);
  const needsPlayRef = useRef(false);
  const [retry, setRetry] = useState(0);
  const [captionText, setCaptionText] = useState('');
  const observed = useRef({ time: 0, at: 0, playing: false });
  const pendingSeek = useRef<{ time: number; at: number } | null>(null);
  const seekYouTube = (time: number) => { pendingSeek.current = { time, at: performance.now() }; youtube.current?.seekTo(time, true); };
  const askToPlay = useCallback((value: boolean) => { needsPlayRef.current = value; setNeedsPlay(value); }, []);
  const currentTime = () => latest.current.room.provider === 'direct' ? video.current?.currentTime || 0 : youtube.current?.getCurrentTime() || 0;
  const play = () => {
    if (!ready.current) return;
    activated.current = true;
    askToPlay(false);
    if (latest.current.room.playing) {
      const target = watchPosition(latest.current.room, latest.current.serverNow());
      if (latest.current.room.provider === 'direct' && video.current) video.current.currentTime = Math.min(video.current.duration || target, target);
      else seekYouTube(target);
    }
    if (latest.current.room.provider === 'direct') void video.current?.play().catch(() => askToPlay(true));
    else youtube.current?.playVideo();
  };
  useImperativeHandle(ref, () => ({
    playFromGesture: () => { suppressedUntil.current = performance.now() + 1500; play(); },
    pause: () => { suppressedUntil.current = performance.now() + 1500; video.current?.pause(); youtube.current?.pauseVideo(); },
    currentTime,
    pictureInPicture: async () => {
      const element = video.current;
      if (!element || !document.pictureInPictureEnabled || !element.requestPictureInPicture) return false;
      if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await element.requestPictureInPicture();
      return true;
    },
  }));
  const synchronize = useCallback(() => {
    if (!ready.current || latest.current.busy) return;
    const { room, serverNow } = latest.current;
    const duration = room.provider === 'direct' ? video.current?.duration || 0 : youtube.current?.getDuration() || 0;
    if (Number.isFinite(duration) && duration > 0) latest.current.onDuration(duration);
    const target = Math.min(duration > 0 ? Math.max(0, duration - .05) : 172800, watchPosition(room, serverNow()));
    const time = room.provider === 'direct' ? video.current?.currentTime || 0 : youtube.current?.getCurrentTime() || 0;
    const youtubeState = room.provider === 'youtube' ? youtube.current?.getPlayerState() : undefined;
    const playing = room.provider === 'direct' ? !video.current?.paused : youtubeState === 1;
    const key = watchPlaybackKey(room, latest.current.resync);
    const changed = appliedState.current !== key;
    appliedState.current = key;
    // Explicit seeks and pauses align precisely; periodic drift correction is
    // less aggressive while playing so it does not interrupt smooth playback.
    // A new shared command can seek during buffering. Periodic corrections must
    // wait for playback: seeking every second would keep restarting the buffer.
    const canCorrect = room.provider === 'direct' || changed || youtubeState === 1 || (!room.playing && youtubeState === 2);
    const seek = canCorrect && Math.abs(time - target) > (changed ? .03 : room.provider === 'youtube' ? 1.2 : room.playing ? .75 : .08);
    if (seek || playing !== room.playing) suppressedUntil.current = performance.now() + 1500;
    if (room.playing && !activated.current) askToPlay(true);
    if (room.provider === 'direct' && video.current) {
      video.current.playbackRate = room.playbackRate || 1;
      if (seek) video.current.currentTime = target;
      if (room.playing && video.current.paused && !needsPlayRef.current) void video.current.play().catch(() => askToPlay(true));
      else if (!room.playing && !video.current.paused) video.current.pause();
    } else if (youtube.current) {
      if (youtube.current.getPlaybackRate?.() !== (room.playbackRate || 1)) youtube.current.setPlaybackRate?.(room.playbackRate || 1);
      if (seek) seekYouTube(target);
      if (room.playing && !playing && youtubeState !== 3 && !needsPlayRef.current) youtube.current.playVideo();
      // Let a native click finish buffering and report its intent. A newly
      // received shared pause still interrupts buffering immediately.
      else if (!room.playing && (playing || (youtubeState === 3 && changed))) youtube.current.pauseVideo();
    }
  }, [askToPlay]);

  const observeNativeSeek = useCallback(() => {
    const player = youtube.current;
    if (!ready.current || !player) return false;
    const time = player.getCurrentTime(), at = performance.now(), playing = player.getPlayerState() === 1;
    const before = observed.current;
    observed.current = { time, at, playing };
    if (pendingSeek.current) {
      if (Math.abs(time - pendingSeek.current.time) <= 1.5 || at - pendingSeek.current.at > 5000) pendingSeek.current = null;
      return false;
    }
    const expected = before.time + (before.playing ? (at - before.at) / 1000 * (latest.current.room.playbackRate || 1) : 0);
    // Buffering freezes time; a native scrub changes it discontinuously. A seek
    // matching the shared clock is an acknowledgement of our own command.
    if (before.at && !latest.current.busy && Math.abs(time - before.time) > .5 && Math.abs(time - expected) > 1.5 &&
      Math.abs(time - watchPosition(latest.current.room, latest.current.serverNow())) > 1.5) {
      latest.current.onIntent(time, playing); return true;
    }
    return false;
  }, []);

  useEffect(() => {
    let alive = true;
    ready.current = false; hasPlayed.current = false; appliedState.current = ''; askToPlay(false); setLoading(true); setError('');
    observed.current = { time: 0, at: 0, playing: false };
    pendingSeek.current = null;
    latest.current.onDuration(0);
    const timeout = window.setTimeout(() => {
      if (alive && !ready.current && !video.current?.error) { setLoading(false); setError('Видео не ответило. Повторите загрузку или смените источник.'); }
    }, 20000);
    if (props.room.provider === 'direct') {
      const element = video.current;
      latest.current.onRates?.(WATCH_RATES);
      if (retry > 0) element?.load();
      if (element && element.readyState >= 1) { ready.current = true; setLoading(false); synchronize(); }
      return () => { alive = false; window.clearTimeout(timeout); element?.pause(); };
    }
    const container = youtubeContainer.current;
    if (!container) { window.clearTimeout(timeout); return; }
    const mount = document.createElement('div'); container.append(mount);
    void loadYouTube(props.playerWindow || window).then(api => {
      if (!alive) return;
      youtube.current = new api.Player(mount, { width: '100%', height: '100%', videoId: props.room.videoId,
        host: 'https://www.youtube-nocookie.com', playerVars: { controls: 1, playsinline: 1, disablekb: 1, origin: window.location.origin, rel: 0 },
        events: {
          onReady: () => {
            if (!alive) return;
            window.clearTimeout(timeout); ready.current = true; setLoading(false); setError(''); youtube.current?.setVolume(latest.current.volume * 100);
            latest.current.onRates?.((youtube.current?.getAvailablePlaybackRates?.() || [1]).filter(rate => WATCH_RATES.includes(rate)));
            synchronize(); observed.current = { time: youtube.current?.getCurrentTime() || 0, at: performance.now(), playing: false };
          },
          onAutoplayBlocked: () => { if (alive) askToPlay(true); },
          onError: () => { if (alive) { window.clearTimeout(timeout); ready.current = false; latest.current.onDuration(0); setLoading(false); setError('YouTube не разрешил воспроизведение. Выберите другое видео.'); } },
          onStateChange: (event: { data: number }) => {
            if (!alive) return;
            if (event.data === 1) { activated.current = true; hasPlayed.current = true; askToPlay(false); }
            if ([1, 2].includes(event.data) && observeNativeSeek()) return;
            if (event.data === 0 && latest.current.room.playing) {
              const end = youtube.current?.getDuration() || 0;
              if (latest.current.onEnded) latest.current.onEnded(end); else latest.current.onIntent(end, false);
            }
            else if ([1, 2].includes(event.data) && performance.now() > suppressedUntil.current && hasPlayed.current && !needsPlayRef.current && !latest.current.busy && (event.data === 1) !== latest.current.room.playing)
              latest.current.onIntent(youtube.current?.getCurrentTime() || 0, event.data === 1);
          },
          onPlaybackRateChange: (event: { data: number }) => {
            if (alive && !latest.current.busy && WATCH_RATES.includes(event.data) && event.data !== (latest.current.room.playbackRate || 1)) latest.current.onRateIntent?.(event.data);
          },
        },
      });
    }).catch(failure => { if (alive) { window.clearTimeout(timeout); setLoading(false); setError(failure.message); } });
    return () => { alive = false; window.clearTimeout(timeout); ready.current = false; try { youtube.current?.destroy(); } catch { /* The floating document may already be closed. */ } youtube.current = null; container.replaceChildren(); };
  }, [props.room.provider, props.room.mediaUrl, props.room.videoId, props.playerWindow, retry, askToPlay, synchronize, observeNativeSeek]);

  useEffect(() => { synchronize(); }, [props.room.version, props.resync, props.busy, synchronize]);
  useEffect(() => {
    if (video.current) video.current.volume = props.volume;
    if (ready.current) {
      youtube.current?.setVolume(props.volume * 100);
      if (props.volume === 0) youtube.current?.mute(); else youtube.current?.unMute();
    }
  }, [props.volume]);
  useEffect(() => {
    const target = props.playerWindow || window;
    const timer = target.setInterval(() => { if (!observeNativeSeek()) synchronize(); }, 1000);
    return () => target.clearInterval(timer);
  }, [synchronize, observeNativeSeek, props.playerWindow]);
  useEffect(() => {
    const element = video.current;
    const update = () => { if (element) for (const track of Array.from(element.textTracks || [])) track.mode = props.captions?.enabled ? 'showing' : 'disabled'; };
    update(); element?.textTracks?.addEventListener?.('addtrack', update);
    return () => element?.textTracks?.removeEventListener?.('addtrack', update);
  }, [props.captions?.enabled, props.captions?.src, props.room.mediaUrl]);
  useEffect(() => {
    if (props.room.provider !== 'youtube' || !props.captions?.enabled) { setCaptionText(''); return; }
    const update = () => setCaptionText(subtitleText(props.captions!.cues, currentTime(), props.captions!.offset));
    const target = props.playerWindow || window;
    update(); const timer = target.setInterval(update, 150);
    return () => target.clearInterval(timer);
  }, [props.room.provider, props.captions, props.playerWindow]);

  return <div className={styles.playerSurface} data-watch-player data-provider={props.room.provider}>
    {props.room.provider === 'direct' ? <video key={props.room.mediaUrl} ref={video} src={props.room.mediaUrl} playsInline preload="metadata"
      aria-label="Видео комнаты" onLoadedMetadata={() => { ready.current = true; setLoading(false); setError(''); synchronize(); }}
      onError={() => { ready.current = false; latest.current.onDuration(0); setLoading(false); setError('Не удалось открыть видео. Нужна доступная участникам прямая ссылка на MP4 / WebM.'); }}
      onEnded={() => { if (latest.current.room.playing) {
        const end = video.current?.duration || 0;
        if (latest.current.onEnded) latest.current.onEnded(end); else latest.current.onIntent(end, false);
      } }}>
      {props.captions?.src && <track key={props.captions.src} kind="subtitles" label={props.captions.label} srcLang="und" src={props.captions.src} default={props.captions.enabled} />}
    </video>
      : <div ref={youtubeContainer} className={styles.youtube} />}
    {captionText && <div className={styles.subtitleOverlay} aria-hidden="true">{captionText}</div>}
    {loading && <div className={styles.playerMessage} role="status"><span className={styles.loadingRing} /><p>Подключаем видео…</p></div>}
    {error && <div className={styles.playerMessage} role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}><RotateCw size={16} />Повторить</button></div>}
    {!loading && !error && needsPlay && props.room.playing && <button type="button" className={styles.resume} onClick={play}><Play size={20} fill="currentColor" />Включить у меня</button>}
  </div>;
});
WatchPlayer.displayName = 'WatchPlayer';
