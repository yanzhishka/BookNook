export interface WatchSource { provider: 'youtube' | 'direct'; mediaUrl: string; videoId: string | null }
export interface WatchRoom extends WatchSource {
  id: string; ownerId: string; title: string; position: number; playing: boolean; playbackRate: number;
  playbackAt: string; version: number; membersVersion: number; updatedAt: string;
  closedAt: string | null; clientId: string | null;
}
export interface WatchMember { userId: string; name: string; avatar: string | null; joinedAt: string }
export interface WatchQueueItem extends WatchSource { id: string; title: string; sortOrder: number }
export interface WatchSnapshot { room: WatchRoom; members: WatchMember[]; queue: WatchQueueItem[]; serverNow: number; applied?: boolean }
export type WatchAction = 'state' | 'source' | 'close' | 'rate' | 'enqueue' | 'remove' | 'move' | 'next';
export interface WatchCommand {
  position?: number; playing?: boolean; source?: WatchSource; rate?: number;
  itemId?: string; direction?: number; title?: string; quiet?: boolean;
}
export const WATCH_RATES = [.25, .5, .75, 1, 1.25, 1.5, 1.75, 2];

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function parseWatchSource(value: string): WatchSource {
  const text = value.trim();
  if (!text || text.length > 2000) throw new Error('Вставьте ссылку на YouTube или файл MP4 / WebM.');
  let url: URL;
  try { url = new URL(/^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(text) ? `https://${text}` : text); }
  catch { throw new Error('Проверьте ссылку на видео.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Нужна обычная HTTPS-ссылка на видео.');
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  if (['youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) {
    const id = host === 'youtu.be' ? url.pathname.split('/')[1]
      : url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(embed|shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : null;
    if (!id || !/^[\w-]{11}$/.test(id)) throw new Error('Нужна ссылка на отдельное видео YouTube, а не на канал или плейлист.');
    return { provider: 'youtube', videoId: id, mediaUrl: `https://www.youtube.com/watch?v=${id}` };
  }
  if (!/\.(mp4|webm)$/i.test(url.pathname)) throw new Error('Пока поддерживаются YouTube и прямые ссылки на MP4 / WebM.');
  url.hash = '';
  return { provider: 'direct', videoId: null, mediaUrl: url.href };
}

export function parseWatchInvite(value: string): string {
  const text = value.trim();
  if (UUID.test(text)) return text.toLowerCase();
  try {
    const url = new URL(text);
    const id = url.searchParams.get('room') || '';
    if (['http:', 'https:'].includes(url.protocol) && UUID.test(id)) return id.toLowerCase();
  } catch { /* Show the same error for malformed links and unknown code formats. */ }
  throw new Error('Вставьте ссылку-приглашение или полный код комнаты.');
}

export function makeWatchInvite(id: string, origin: string): string {
  if (!UUID.test(id)) throw new Error('Некорректный код комнаты.');
  const url = new URL('/', origin);
  url.search = new URLSearchParams({ app: 'watch', room: id }).toString();
  return url.href;
}

export function watchPosition(room: Pick<WatchRoom, 'position' | 'playing' | 'playbackAt' | 'closedAt'> & { playbackRate?: number }, now: number): number {
  const elapsed = room.playing && !room.closedAt ? Math.max(0, (now - Date.parse(room.playbackAt)) / 1000) : 0;
  return Math.max(0, Math.min(172800, room.position + (Number.isFinite(elapsed) ? elapsed * (room.playbackRate || 1) : 0)));
}

export function watchPlaybackKey(room: WatchRoom, resync: number): string {
  return [room.id, room.provider, room.mediaUrl, room.position, room.playing, room.playbackAt, room.playbackRate || 1, resync].join(':');
}

export function sourceTitle(source: WatchSource): string {
  if (source.provider === 'youtube') return `YouTube · ${source.videoId}`;
  try { return decodeURIComponent(new URL(source.mediaUrl).pathname.split('/').pop() || 'Видео').slice(0, 120); }
  catch { return 'Видео'; }
}

export function watchTime(seconds: number): string {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return value >= 3600 ? `${Math.floor(value / 3600)}:${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
    : `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
