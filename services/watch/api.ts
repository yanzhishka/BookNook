import { supabase } from '../supabase';
import type { Json, WatchRoomRow } from '../database.types';
import type { WatchRoom, WatchSnapshot, WatchSource, WatchAction, WatchCommand } from './model';
import { parseWatchInvite } from './model';

export class WatchUnavailableError extends Error {}

export function mapWatchRoom(row: WatchRoomRow): WatchRoom {
  return { id: row.id, ownerId: row.owner_id, title: row.title, provider: row.provider === 'youtube' ? 'youtube' : 'direct',
    mediaUrl: row.media_url, videoId: row.video_id, position: Number(row.position_seconds), playing: row.playing, playbackRate: Number(row.playback_rate) || 1,
    playbackAt: row.playback_at, version: Number(row.version), membersVersion: Number(row.members_version),
    updatedAt: row.updated_at, closedAt: row.closed_at, clientId: row.last_client_id };
}

function snapshot(data: Json | null, error: { message: string } | null): WatchSnapshot {
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || Array.isArray(data) || !data.room) throw new WatchUnavailableError('Комната недоступна. Откройте ссылку-приглашение заново.');
  const raw = data as unknown as { room: WatchRoomRow; server_now: string; applied?: boolean;
    members: { user_id: string; name: string | null; avatar: string | null; joined_at: string }[];
    queue?: { id: string; sort_order: number; title: string; provider: 'youtube' | 'direct'; media_url: string; video_id: string | null }[] };
  return { room: mapWatchRoom(raw.room), serverNow: Date.parse(raw.server_now), applied: raw.applied,
    members: (raw.members || []).map(member => ({ userId: member.user_id, name: member.name || 'Читатель', avatar: member.avatar, joinedAt: member.joined_at })),
    queue: (raw.queue || []).map(item => ({ id: item.id, sortOrder: item.sort_order, title: item.title, provider: item.provider, mediaUrl: item.media_url, videoId: item.video_id })) };
}

export const watchApi = {
  async list() {
    const { data, error } = await supabase.from('watch_rooms').select('*').is('closed_at', null).order('updated_at', { ascending: false }).limit(24);
    if (error) throw new Error(error.message);
    return (data || []).map(mapWatchRoom);
  },
  async create(title: string, source: WatchSource) {
    const { data, error } = await supabase.rpc('create_watch_room', { p_title: title, p_provider: source.provider, p_video_id: source.videoId, p_media_url: source.mediaUrl });
    return snapshot(data, error);
  },
  async join(id: string) {
    const { data, error } = await supabase.rpc('join_watch_room', { p_room_id: parseWatchInvite(id) });
    return snapshot(data, error);
  },
  async get(id: string) {
    const { data, error } = await supabase.rpc('get_watch_room', { p_room_id: id });
    return snapshot(data, error);
  },
  async control(room: WatchRoom, clientId: string, action: WatchAction, values: WatchCommand = {}) {
    if (!['state', 'source', 'close'].includes(action)) {
      const { data, error } = await supabase.rpc('watch_player_command', {
        p_room_id: room.id, p_version: room.version, p_action: action, p_client_id: clientId,
        p_rate: values.rate, p_item_id: values.itemId, p_direction: values.direction, p_title: values.title,
        p_provider: values.source?.provider, p_video_id: values.source?.videoId, p_media_url: values.source?.mediaUrl,
        p_position: values.position, p_playing: values.playing,
      });
      return snapshot(data, error);
    }
    const { data, error } = await supabase.rpc('control_watch_room', {
      p_room_id: room.id, p_version: room.version, p_action: action, p_client_id: clientId,
      p_position: values.position, p_playing: values.playing,
      p_provider: values.source?.provider, p_video_id: values.source?.videoId, p_media_url: values.source?.mediaUrl,
    });
    return snapshot(data, error);
  },
  subscribe(id: string, onUpdate: () => void, onStatus: (connected: boolean) => void) {
    const channel = supabase.channel(`watch:${id}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'watch_rooms', filter: `id=eq.${id}` }, onUpdate)
      .subscribe(status => { onStatus(status === 'SUBSCRIBED'); if (status === 'SUBSCRIBED') onUpdate(); });
    return () => { void supabase.removeChannel(channel); };
  },
};
