import { useCallback, useEffect, useRef, useState } from 'react';
import { watchApi, WatchUnavailableError } from '../../services/watch/api';
import type { WatchSnapshot, WatchAction, WatchCommand } from '../../services/watch/model';

const message = (error: unknown, fallback: string) => error instanceof Error && /^[А-Яа-яЁё]/.test(error.message) ? error.message : fallback;

export function useWatchRoom(id: string, api = watchApi) {
  const [snapshot, setSnapshot] = useState<WatchSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [resync, setResync] = useState(0);
  const latest = useRef<WatchSnapshot | null>(null);
  const clockOffset = useRef(0);
  const clientId = useRef(crypto.randomUUID());
  const lock = useRef(false);
  const lifetime = useRef(0);
  const refreshRef = useRef<() => void>(() => {});
  const serverNow = useCallback(() => Date.now() + clockOffset.current, []);
  const accept = useCallback((value: WatchSnapshot, started: number) => {
    const current = latest.current;
    if (current && (value.room.version < current.room.version ||
      (value.room.version === current.room.version && value.room.membersVersion < current.room.membersVersion))) return;
    if (Number.isFinite(value.serverNow)) clockOffset.current = value.serverNow - (started + Date.now()) / 2;
    latest.current = value;
    setSnapshot(value);
  }, []);

  useEffect(() => {
    const generation = ++lifetime.current;
    let alive = true, fetching = false, again = false;
    let unsubscribe: (() => void) | undefined;
    let timer: number | undefined;
    latest.current = null;
    lock.current = false; setBusy(false); setNotice('');
    setSnapshot(null); setLoading(true); setError(''); setConnected(false);
    const refresh = async () => {
      if (!alive || latest.current?.room.closedAt) return;
      if (fetching) { again = true; return; }
      fetching = true;
      try {
        do {
          again = false;
          const started = Date.now();
          const value = await api.get(id);
          if (!alive) return;
          accept(value, started); setError('');
        } while (again && alive);
      } catch (failure) {
        if (alive) {
          setError(message(failure, 'Связь с комнатой прервалась. Попробуем подключиться снова.'));
          if (failure instanceof WatchUnavailableError) { latest.current = null; setSnapshot(null); }
        }
      } finally { fetching = false; }
    };
    refreshRef.current = () => { void refresh(); };
    void (async () => {
      const started = Date.now();
      try {
        const value = await api.join(id);
        if (!alive) return;
        accept(value, started); setLoading(false);
        unsubscribe = api.subscribe(id, () => { void refresh(); }, online => { if (alive) setConnected(online); });
        timer = window.setInterval(() => { void refresh(); }, 5000);
      } catch (failure) {
        if (alive) { setError(message(failure, 'Не удалось открыть комнату. Проверьте соединение и приглашение.')); setLoading(false); }
      }
    })();
    return () => {
      alive = false; if (generation === lifetime.current) lifetime.current++;
      unsubscribe?.(); window.clearInterval(timer);
    };
  }, [id, api, revision, accept]);

  const control = async (action: WatchAction, values: WatchCommand = {}) => {
    if (lock.current || !latest.current || latest.current.room.closedAt) return false;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const generation = lifetime.current;
    const started = Date.now();
    try {
      const value = await api.control(latest.current.room, clientId.current, action, values);
      if (generation !== lifetime.current) return false;
      accept(value, started);
      const alreadyPaused = action === 'state' && values.playing === false && !value.room.playing &&
        values.position !== undefined && Math.abs(value.room.position - values.position) < .1;
      if (value.applied === false && !alreadyPaused && !values.quiet) setNotice('Состояние комнаты обновилось. Повторите действие.');
      return value.applied !== false || alreadyPaused;
    } catch (failure) {
      if (generation === lifetime.current) {
        setError(message(failure, 'Не удалось передать действие. Проверьте соединение и повторите.'));
        setResync(value => value + 1);
      }
      return false;
    } finally { if (generation === lifetime.current) { lock.current = false; setBusy(false); } }
  };

  const retry = () => { if (latest.current) refreshRef.current(); else setRevision(value => value + 1); };
  return { snapshot, loading, connected, error, notice, busy, resync, serverNow, control, retry };
}
