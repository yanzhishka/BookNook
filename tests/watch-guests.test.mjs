import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, require = () => { throw new Error('Unexpected import'); }, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require, URL, ...globals });
  return exports;
}

function guestSession(auth, globals) {
  const client = { auth }, api = {};
  const { openGuestWatch } = load('services/watch/guest.ts', name => {
    if (name === '../supabase') return { createWatchGuestClient: () => client };
    if (name === './api') return { createWatchApi: received => { assert.equal(received, client); return api; } };
    throw new Error(`Unexpected import: ${name}`);
  }, globals);
  return { openGuestWatch, api };
}

test('watch guest restores browser identity without creating another user or touching account auth', async () => {
  let restored = 0;
  const { openGuestWatch, api } = guestSession({
    getSession: async () => { restored++; return { data: { session: { user: { id: 'returning-guest' } } }, error: null }; },
    signInAnonymously: () => assert.fail('must reuse guest identity'),
    signOut: () => assert.fail('must keep the session'),
  });
  const access = await openGuestWatch();
  assert.equal(access.userId, 'returning-guest');
  assert.equal(access.api, api);
  assert.equal((await openGuestWatch()).userId, access.userId);
  assert.equal(restored, 2);
});

test('concurrent guest entry creates one identity inside a browser-wide lock', async () => {
  let creates = 0, locks = 0;
  const { openGuestWatch } = guestSession({
    getSession: async () => ({ data: { session: null }, error: null }),
    signInAnonymously: async () => { creates++; return { data: { user: { id: 'new-guest' } }, error: null }; },
  }, { navigator: { locks: { request: async (name, action) => {
    assert.equal(name, 'wnook-guest-identity'); locks++; return action();
  } } } });
  const [a, b] = await Promise.all([openGuestWatch(), openGuestWatch()]);
  assert.equal(a.userId, 'new-guest'); assert.equal(b.userId, a.userId);
  assert.equal(creates, 1); assert.equal(locks, 1);
});

test('failed guest connection can retry and presents a useful rate-limit error', async () => {
  let creates = 0;
  const { openGuestWatch } = guestSession({
    getSession: async () => ({ data: { session: null }, error: null }),
    signInAnonymously: async () => ++creates === 1
      ? { data: { user: null }, error: { status: 429 } }
      : { data: { user: { id: 'retry-guest' } }, error: null },
  });
  await assert.rejects(openGuestWatch(), /Слишком много подключений/);
  assert.equal((await openGuestWatch()).userId, 'retry-guest');
  assert.equal(creates, 2);
});

test('guest restore failure never replaces an existing identity with a new one', async () => {
  const { openGuestWatch } = guestSession({
    getSession: async () => ({ data: { session: null }, error: { message: 'network' } }),
    signInAnonymously: () => assert.fail('network failure must not create a new guest'),
  });
  await assert.rejects(openGuestWatch(), /восстановить гостевой просмотр/);
});

test('watch commands use the supplied session client for guest and account independently', async () => {
  const calls = [];
  const client = label => ({ rpc: async (name, values) => {
    calls.push({ label, name, values });
    return { data: { room: { id: label, owner_id: label }, server_now: new Date().toISOString() }, error: null };
  } });
  const { createWatchApi } = load('services/watch/api.ts', name => name === '../supabase'
    ? { supabase: client('account') }
    : { parseWatchInvite: value => value });
  const guest = createWatchApi(client('guest'));
  assert.equal((await guest.create('', { provider: 'direct', mediaUrl: 'https://example.com/a.mp4', videoId: null })).room.ownerId, 'guest');
  await guest.join('room');
  await guest.control({ id: 'room', version: 3 }, 'client', 'rate', { rate: 1.5 });
  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => call.label === 'guest'));
  assert.equal(calls[2].values.p_rate, 1.5);
});

test('book proxy admits permanent accounts and rejects anonymous or expired sessions', async () => {
  for (const [status, body, expected] of [
    [200, { id: 'account', is_anonymous: false }, true],
    [200, { id: 'guest', is_anonymous: true }, false],
    [401, {}, false],
  ]) {
    const { isAuthenticatedRequest } = load('supabase/functions/_shared/auth.ts', undefined, {
      Deno: { env: { get: () => 'configured' } },
      AbortSignal,
      fetch: async () => ({ ok: status === 200, json: async () => body }),
    });
    assert.equal(await isAuthenticatedRequest(new Request('https://example.com', { headers: { Authorization: 'Bearer session' } })), expected);
  }
});
