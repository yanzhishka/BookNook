import { createWatchGuestClient } from '../supabase';
import { createWatchApi } from './api';

let client: ReturnType<typeof createWatchGuestClient> | undefined;
let api: ReturnType<typeof createWatchApi> | undefined;
let pending: Promise<WatchGuestAccess> | undefined;

export interface WatchGuestAccess {
  userId: string;
  api: ReturnType<typeof createWatchApi>;
}

async function restoreGuest(): Promise<WatchGuestAccess> {
  client ||= createWatchGuestClient();
  api ||= createWatchApi(client);
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error('Не удалось восстановить гостевой просмотр. Проверьте соединение и повторите.');
  if (data.session) return { userId: data.session.user.id, api };

  const signedIn = await client.auth.signInAnonymously();
  if (signedIn.error || !signedIn.data.user) {
    if (signedIn.error?.status === 429) throw new Error('Слишком много подключений. Попробуйте чуть позже.');
    throw new Error('Не удалось подключить гостевой просмотр. Попробуйте ещё раз.');
  }
  return { userId: signedIn.data.user.id, api };
}

export function openGuestWatch(): Promise<WatchGuestAccess> {
  // Share StrictMode requests and serialize first visits from different tabs.
  const start = async (): Promise<WatchGuestAccess> => typeof navigator !== 'undefined' && navigator.locks
    ? await navigator.locks.request('wnook-guest-identity', restoreGuest)
    : restoreGuest();
  pending ||= start().finally(() => { pending = undefined; });
  return pending;
}
