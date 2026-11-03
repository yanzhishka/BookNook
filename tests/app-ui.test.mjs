import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const project = fileURLToPath(new URL('..', import.meta.url));
const window = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost' }).window;
for (const name of ['window', 'document', 'HTMLElement', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'navigator']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no layout; model only controls hidden by HTML/CSS rather than every element as invisible.
window.HTMLElement.prototype.getClientRects = function () {
  return this.hidden || this.classList.contains('hidden') || this.style.display === 'none' ? [] : [{ width: 10, height: 10 }];
};
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
const h = React.createElement;

function loadUi(db = {}, overrides = {}) {
  const cache = new Map();
  const load = (filename) => {
    if (cache.has(filename)) return cache.get(filename);
    const exports = {};
    cache.set(filename, exports);
    const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(source, {
      exports, console, document: window.document, window, HTMLElement: window.HTMLElement,
      navigator: window.navigator, localStorage: window.localStorage,
      AbortController, URL, URLSearchParams, crypto: globalThis.crypto, performance,
      requestAnimationFrame: callback => window.setTimeout(callback, 0),
      cancelAnimationFrame: id => window.clearTimeout(id),
      require(id) {
        if (!id.startsWith('.')) return require(id);
        const resolved = path.resolve(path.dirname(filename), id);
        const override = overrides[path.relative(project, resolved)];
        if (override) return override;
        if (resolved === path.join(project, 'services/db')) return { db };
        if (id.endsWith('.css')) return { default: {} };
        return load(existsSync(`${resolved}.tsx`) ? `${resolved}.tsx` : `${resolved}.ts`);
      },
    }, { filename });
    return exports;
  };
  return (relative) => load(path.join(project, relative));
}

async function mount(t, element) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  t.after(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  await act(async () => root.render(element));
  return { container, render: async (next) => { await act(async () => root.render(next)); } };
}

function key(value, shiftKey = false) {
  const event = new window.KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  return event;
}

async function fill(input, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};

test('ecosystem logo expands both projects, selects W.Nook and returns keyboard focus on Escape', async (t) => {
  const { ProductSwitcher } = loadUi()('components/layout/ProductSwitcher.tsx');
  function App() { const [product, setProduct] = React.useState('books'); return h(ProductSwitcher, { product, onChange: setProduct }); }
  const { container } = await mount(t, h(App));
  let trigger = container.querySelector('[aria-expanded]');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.ok(container.querySelector('[inert]'));
  await act(async () => trigger.click());
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  const watch = [...container.querySelectorAll('nav button')].find(button => button.textContent.includes('W.Nook'));
  await act(async () => watch.click());
  trigger = container.querySelector('[aria-expanded]');
  assert.equal(trigger.getAttribute('aria-label'), 'Проекты: W.Nook');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  await act(async () => trigger.click());
  await act(async () => key('Escape'));
  assert.equal(document.activeElement, trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
});

const watchSnapshot = (version = 0, values = {}) => ({ room: { id: 'room', ownerId: 'owner', title: 'Private room', provider: 'direct',
  mediaUrl: 'https://example.com/video.mp4', videoId: null, position: 0, playing: false, playbackAt: new Date().toISOString(),
  version, membersVersion: 1, updatedAt: new Date().toISOString(), closedAt: null, clientId: null, ...values },
  members: [], serverNow: Date.now() + 120000 });

test('W.Nook opens a direct invitation without account auth and still allows explicit sign-in', async (t) => {
  const room = 'b854787a-221c-4b57-83b9-7ee822a1174b';
  window.localStorage.clear(); window.history.replaceState(null, '', `/?app=watch&room=${room}`);
  window.matchMedia ||= () => ({ matches: false });
  t.after(() => { window.localStorage.clear(); window.history.replaceState(null, '', '/'); });
  const App = loadUi({ getSession: async () => null }, {
    'components/CustomCursor': { CustomCursor: () => null },
    'components/Auth': { Auth: ({ onGuestLogin }) => h('section', { 'data-auth': true }, h('button', { onClick: onGuestLogin }, 'Continue guest')) },
    'components/Layout': { Layout: ({ onLoginClick, children }) => h('main', null, h('button', { onClick: onLoginClick }, 'Account login'), children) },
    'components/watch/WatchPage': { WatchPage: ({ user, roomId }) => h('div', { 'data-watch-user': user.id, 'data-room': roomId }) },
    'services/supabase': { MOBILE_AUTH_CALLBACK: 'nook://auth', establishSessionFromAuthUrl: async () => false },
  })('App.tsx').default;
  const { container } = await mount(t, h(App));
  assert.equal(container.querySelector('[data-auth]'), null);
  assert.equal(container.querySelector('[data-watch-user]').dataset.watchUser, 'guest');
  assert.equal(container.querySelector('[data-room]').dataset.room, room);
  await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Account login').click());
  assert.ok(container.querySelector('[data-auth]'));
  await act(async () => container.querySelector('[data-auth] button').click());
  assert.equal(container.querySelector('[data-auth]'), null);
  assert.equal(container.querySelector('[data-room]').dataset.room, room);
});

test('guest can create a room from the real watch form without a login gate', async (t) => {
  const created = [], opened = [];
  const api = { list: async () => [], create: async (title, source) => { created.push({ title, source }); return watchSnapshot(); } };
  const { WatchPage } = loadUi({}, {
    'services/watch/api': { watchApi: {} },
    'services/watch/guest': { openGuestWatch: async () => ({ userId: 'guest-owner', api }) },
    'components/watch/WatchRoomView': { WatchRoomView: () => null },
  })('components/watch/WatchPage.tsx');
  const { container } = await mount(t, h(WatchPage, { user: { id: 'guest' }, roomId: null, view: 'home', onRoomChange: id => opened.push(id) }));
  await fill(container.querySelector('[aria-label="Ссылка на видео"]'), 'https://example.com/video.mp4');
  await fill(container.querySelector('[aria-label="Название комнаты"]'), 'Guest room');
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(created.length, 1);
  assert.equal(created[0].title, 'Guest room');
  assert.equal(created[0].source.provider, 'direct');
  assert.deepEqual(opened, ['room']);
  assert.ok(!container.textContent.includes('Войдите'));
});

test('guest invitation hands the persistent identity and guest API to the room player', async (t) => {
  const api = {}, received = [];
  const { WatchPage } = loadUi({}, {
    'services/watch/api': { watchApi: {} },
    'services/watch/guest': { openGuestWatch: async () => ({ userId: 'guest-member', api }) },
    'components/watch/WatchRoomView': { WatchRoomView: props => { received.push(props); return h('div', null, 'Room player'); } },
  })('components/watch/WatchPage.tsx');
  const { container } = await mount(t, h(WatchPage, { user: { id: 'guest' }, roomId: 'invited-room', view: 'home', onRoomChange: () => {} }));
  assert.equal(container.textContent, 'Room player');
  assert.equal(received.at(-1).user.id, 'guest-member');
  assert.equal(received.at(-1).roomId, 'invited-room');
  assert.equal(received.at(-1).api, api);
});

test('watch controls lock duplicate requests and stale commands accept the newer shared state', async (t) => {
  const request = deferred();
  const calls = [];
  const api = { join: async () => watchSnapshot(), get: async () => watchSnapshot(),
    subscribe: (_id, _update, status) => { status(true); return () => {}; },
    control: async (...args) => { calls.push(args); return request.promise; } };
  const { useWatchRoom } = hooksLoader()('components/watch/useWatchRoom.ts');
  let sync;
  function App() { sync = useWatchRoom('room', api); return null; }
  await mount(t, h(App));
  assert.equal(sync.connected, true);
  assert.ok(Math.abs(sync.serverNow() - Date.now() - 120000) < 1000);
  let pending;
  await act(async () => { pending = sync.control('state', { position: 10, playing: true }); void sync.control('state', { position: 99, playing: true }); });
  assert.equal(calls.length, 1);
  assert.equal(sync.busy, true);
  await act(async () => { request.resolve({ ...watchSnapshot(2, { position: 25 }), applied: false }); await pending; });
  assert.equal(sync.snapshot.room.position, 25);
  assert.equal(sync.snapshot.room.version, 2);
  assert.ok(sync.notice);
  assert.equal(sync.busy, false);
});

test('late playback responses never rewind a newer realtime snapshot and unmount releases the channel', async (t) => {
  const request = deferred();
  let update, removed = 0;
  const api = { join: async () => watchSnapshot(), get: async () => watchSnapshot(5, { position: 50 }),
    subscribe: (_id, callback) => { update = callback; return () => removed++; }, control: async () => request.promise };
  const { useWatchRoom } = hooksLoader()('components/watch/useWatchRoom.ts');
  let sync;
  function App() { sync = useWatchRoom('room', api); return null; }
  const view = await mount(t, h(App));
  let pending;
  await act(async () => { pending = sync.control('state', { position: 10, playing: true }); });
  await act(async () => update());
  assert.equal(sync.snapshot.room.version, 5);
  await act(async () => { request.resolve({ ...watchSnapshot(1, { position: 10 }), applied: true }); await pending; });
  assert.equal(sync.snapshot.room.version, 5);
  assert.equal(sync.snapshot.room.position, 50);
  await view.render(null);
  assert.equal(removed, 1);
});

test('a failed playback write keeps the shared snapshot and asks the player to restore it', async (t) => {
  const api = { join: async () => watchSnapshot(), get: async () => watchSnapshot(), subscribe: () => () => {},
    control: async () => { throw new Error('Network unavailable'); } };
  const { useWatchRoom } = hooksLoader()('components/watch/useWatchRoom.ts');
  let sync;
  function App() { sync = useWatchRoom('room', api); return null; }
  await mount(t, h(App));
  await act(async () => sync.control('state', { position: 10, playing: true }));
  assert.equal(sync.snapshot.room.position, 0);
  assert.equal(sync.snapshot.room.playing, false);
  assert.equal(sync.resync, 1);
  assert.equal(sync.busy, false);
  assert.ok(sync.error);
});

test('YouTube buffering survives periodic sync while explicit shared seeks and pauses still apply', async (t) => {
  const intervals = [], seeks = [], intents = [];
  let events, state = 2, time = 0, now = 10000, plays = 0, pauses = 0, destroyed = 0;
  const originalInterval = window.setInterval;
  window.setInterval = callback => { intervals.push(callback); return 99999; };
  t.after(() => { window.setInterval = originalInterval; });
  class Player {
    constructor(_element, options) { events = options.events; }
    getDuration() { return 300; }
    getCurrentTime() { return time; }
    getPlayerState() { return state; }
    playVideo() { plays++; state = 3; }
    pauseVideo() { pauses++; state = 2; }
    seekTo(value) { seeks.push(value); time = value; }
    setVolume() {} mute() {} unMute() {}
    destroy() { destroyed++; }
  }
  const { WatchPlayer } = loadUi({}, {
    'services/watch/youtube': { loadYouTube: async () => ({ Player }) },
  })('components/watch/WatchPlayer.tsx');
  const ref = React.createRef();
  const room = watchSnapshot(0, { provider: 'youtube', mediaUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE', videoId: 'M7lc1UVf-VE', playbackAt: new Date(now).toISOString() }).room;
  const renderPlayer = value => h(WatchPlayer, { ref, room: value, serverNow: () => now, resync: 0, busy: false, volume: .7,
    onDuration: () => {}, onIntent: (...args) => intents.push(args) });
  const view = await mount(t, renderPlayer(room));
  await act(async () => events.onReady());
  await act(async () => ref.current.playFromGesture());
  await act(async () => intervals.forEach(callback => callback()));
  assert.equal(pauses, 0, 'periodic sync must let a local start finish buffering before its play event');
  await view.render(renderPlayer({ ...room, version: 1, playing: true }));
  now = 20000;
  await act(async () => intervals.forEach(callback => callback()));
  assert.deepEqual(seeks, [], 'buffering must not be restarted by clock drift');
  assert.equal(plays, 1, 'buffering must not receive repeated play commands');
  await view.render(renderPlayer({ ...room, version: 2, position: 120, playing: true, playbackAt: new Date(now).toISOString() }));
  assert.deepEqual(seeks, [120], 'an explicit seek applies even during buffering');
  state = 1;
  now += 3000;
  await act(async () => intervals.forEach(callback => callback()));
  assert.deepEqual(seeks, [120, 123], 'drift correction resumes when playback runs');
  state = 3;
  await view.render(renderPlayer({ ...room, version: 3, position: 45, playing: false }));
  assert.equal(pauses, 1, 'shared pause also stops buffering');
  assert.equal(seeks.at(-1), 45);
  assert.deepEqual(intents, [], 'synchronization must never masquerade as a user seek');
  await view.render(null);
  assert.equal(destroyed, 1);
});

test('floating cinema moves one portal into the PiP document, keeps controls live and restores on close', async (t) => {
  const popup = new JSDOM('<!doctype html><head></head><body></body>').window;
  const previous = window.documentPictureInPicture;
  window.documentPictureInPicture = { requestWindow: async () => popup };
  t.after(() => { window.documentPictureInPicture = previous; popup.close(); });
  const { FloatingCinema } = loadUi()('components/watch/FloatingCinema.tsx');
  const ref = React.createRef(), targets = [], modes = [];
  let clicks = 0;
  const view = await mount(t, h(FloatingCinema, { ref, title: 'A film', onWindowChange: target => targets.push(target), onModeChange: mode => modes.push(mode), nativeFallback: async () => false },
    h('button', { 'data-player-control': '', onClick: () => clicks++ }, 'Play')));
  const original = view.container.querySelector('[data-player-control]');
  await act(async () => ref.current.toggle());
  assert.equal(popup.document.querySelector('[data-player-control]'), original, 'media tree must keep its identity');
  await act(async () => original.click());
  assert.equal(clicks, 1, 'React events must work in the floating document');
  assert.equal(targets[0], popup);
  await act(async () => popup.dispatchEvent(new popup.Event('pagehide')));
  assert.equal(view.container.querySelector('[data-player-control]'), original);
  assert.equal(targets.at(-1), window);
  assert.deepEqual(modes, [true, false]);
});

test('closing a room while a PiP window is opening closes the late window without mounting stale UI', async (t) => {
  const request = deferred();
  const previous = window.documentPictureInPicture;
  window.documentPictureInPicture = { requestWindow: () => request.promise };
  t.after(() => { window.documentPictureInPicture = previous; });
  const { FloatingCinema } = loadUi()('components/watch/FloatingCinema.tsx');
  const ref = React.createRef(); let closed = 0, changed = 0;
  const view = await mount(t, h(FloatingCinema, { ref, title: 'Film', onWindowChange: () => changed++, onModeChange: () => {}, nativeFallback: async () => false }, h('video')));
  await act(async () => ref.current.toggle());
  await view.render(null);
  await act(async () => request.resolve({ close: () => closed++ }));
  assert.equal(closed, 1); assert.equal(changed, 0);
});

test('opening books ignores late responses from an earlier choice and leaves shelf state lightweight', async (t) => {
  const slow = deferred();
  const summaries = ['a', 'b'].map(id => ({ id, title: `Book ${id}`, author: 'Author', hasContent: true, annotationCount: 0, status: 'reading', progress: 0 }));
  let shelf;
  const { Library } = loadUi({
    getBookContent: id => id === 'a' ? slow.promise : Promise.resolve({ content: 'Text B' }),
    getBookAnnotations: async () => [],
  }, {
    'components/Reader': { Reader: ({ book, onClose }) => h('section', { 'data-reader': book.id }, book.content, h('button', { onClick: onClose }, 'Close reader')) },
    'components/books/AddBookModal': { AddBookModal: () => null },
  })('components/Library.tsx');
  function App() {
    const [books, setBooks] = React.useState(summaries);
    shelf = books;
    return h(Library, { books, setBooks, user: { id: 'owner' } });
  }
  const { container } = await mount(t, h(App));
  await act(async () => container.querySelector('[aria-label="Читать «Book a»"]').click());
  assert.match(container.querySelector('[role="status"]').textContent, /Открываем книгу/);
  await act(async () => container.querySelector('[aria-label="Читать «Book b»"]').click());
  assert.equal(document.querySelector('[data-reader]').dataset.reader, 'b');
  await act(async () => slow.resolve({ content: 'Late text A' }));
  assert.equal(document.querySelector('[data-reader]').textContent, 'Text BClose reader');
  assert.ok(shelf.every(book => !('content' in book) && !('document' in book) && !('annotations' in book)));
  await act(async () => document.querySelector('[data-reader] button').click());
  assert.equal(document.querySelector('[data-reader]'), null);
});

test('cancelled book opening never reopens the reader after its request finishes', async (t) => {
  const request = deferred();
  const { Library } = loadUi({ getBookContent: () => request.promise, getBookAnnotations: async () => [] }, {
    'components/Reader': { Reader: () => h('section', { 'data-reader': 'open' }) },
    'components/books/AddBookModal': { AddBookModal: () => null },
  })('components/Library.tsx');
  const { container } = await mount(t, h(Library, {
    books: [{ id: 'a', title: 'Book A', hasContent: true }], setBooks: () => {}, user: { id: 'owner' },
  }));
  await act(async () => container.querySelector('[aria-label="Читать «Book A»"]').click());
  const cancel = [...container.querySelectorAll('button')].find(button => button.textContent === 'Отмена');
  await act(async () => cancel.click());
  await act(async () => request.resolve({ content: 'Late text' }));
  assert.equal(document.querySelector('[data-reader]'), null);
  assert.equal(container.querySelector('[role="status"]'), null);
});

const topic = (id, repliesCount = 0) => ({ id, source: 'thread', title: `Topic ${id}`, content: 'Book discussion', authorId: 'author', authorName: 'Reader', kind: 'discussion', repliesCount, likesCount: 0, likedByMe: false, book: null });
function hooksLoader(db) { return loadUi(db, { 'services/supabase': { supabase: {} } }); }

test('topic filters ignore stale requests and pagination appends without duplicates', async (t) => {
  const slow = deferred();
  const calls = [];
  const api = { list: async options => {
    calls.push(options);
    if (!options.query) return slow.promise;
    return { topics: options.offset ? [topic('b'), topic('c')] : [topic('a'), topic('b')], hasMore: !options.offset };
  } };
  const { useTopicList } = hooksLoader()('components/board/useTopicList.ts');
  let list;
  function App() { list = useTopicList(api); return null; }
  await mount(t, h(App));
  await act(async () => list.changeCriteria({ query: 'new' }));
  await act(async () => slow.resolve({ topics: [topic('stale')], hasMore: false }));
  assert.deepEqual(Array.from(list.topics, item => item.id), ['a', 'b']);
  await act(async () => { list.loadMore(); list.loadMore(); });
  assert.deepEqual(Array.from(list.topics, item => item.id), ['a', 'b', 'c']);
  assert.equal(calls.at(-1).offset, 20);
});

test('switching topics ignores late replies and keeps each topic draft separate', async (t) => {
  const slow = deferred();
  const { useTopicConversation } = hooksLoader()('components/board/useTopicConversation.ts');
  const api = { get: async ({ id }) => topic(id), replies: async ({ id }) => id === 'a' ? slow.promise : { replies: [{ id: 'b-reply' }], hasMore: false } };
  const options = { api, userId: 'owner', onTopicUpdate: () => {}, onOpenError: () => {} };
  let conversation;
  function App() { conversation = useTopicConversation(options); return null; }
  await mount(t, h(App));
  await act(async () => conversation.open(topic('a')));
  await act(async () => conversation.setReplyDraft({ content: 'Draft A' }));
  const draftId = conversation.replyDraft.id;
  await act(async () => conversation.open(topic('b')));
  await act(async () => slow.resolve({ replies: [{ id: 'stale-a' }], hasMore: false }));
  assert.equal(conversation.replies[0].id, 'b-reply');
  assert.equal(conversation.replyDraft, undefined);
  await act(async () => conversation.open(topic('a')));
  assert.equal(conversation.replyDraft.content, 'Draft A');
  assert.equal(conversation.replyDraft.id, draftId);
});

test('failed replies retain their ID and draft; duplicate submit is locked and retry succeeds once', async (t) => {
  const failed = deferred();
  const ids = [];
  const api = { get: async () => topic('a'), replies: async () => ({ replies: [], hasMore: false }),
    reply: async (_, input) => { ids.push(input.id); if (ids.length === 1) return failed.promise; return { id: input.id, content: input.content }; } };
  const { useTopicConversation } = hooksLoader()('components/board/useTopicConversation.ts');
  const options = { api, userId: 'owner', onTopicUpdate: () => {}, onOpenError: () => {} };
  let conversation;
  function App() { conversation = useTopicConversation(options); return null; }
  await mount(t, h(App));
  await act(async () => conversation.open(topic('a')));
  await act(async () => conversation.setReplyDraft({ content: 'Keep this answer' }));
  let pending;
  await act(async () => { pending = conversation.sendReply(); void conversation.sendReply(); });
  assert.equal(ids.length, 1);
  await act(async () => { failed.reject(new Error('Network failed')); await pending; });
  assert.equal(conversation.replyDraft.content, 'Keep this answer');
  assert.ok(conversation.operationError);
  await act(async () => conversation.sendReply());
  assert.equal(ids[0], ids[1]);
  assert.equal(conversation.replyDraft, undefined);
  assert.equal(conversation.replies.length, 1);
});

test('a reply finishing after another topic opens updates its own topic without entering the new conversation', async (t) => {
  const request = deferred();
  const updated = [];
  const api = { get: async ({ id }) => topic(id), replies: async () => ({ replies: [], hasMore: false }), reply: async () => request.promise };
  const { useTopicConversation } = hooksLoader()('components/board/useTopicConversation.ts');
  const options = { api, userId: 'owner', onTopicUpdate: value => updated.push(value), onOpenError: () => {} };
  let conversation;
  function App() { conversation = useTopicConversation(options); return null; }
  await mount(t, h(App));
  await act(async () => conversation.open(topic('a')));
  await act(async () => conversation.setReplyDraft({ content: 'Answer for A' }));
  let pending;
  await act(async () => { pending = conversation.sendReply(); });
  await act(async () => conversation.open(topic('b')));
  await act(async () => { request.resolve({ id: 'reply-a', content: 'Answer for A' }); await pending; });
  assert.equal(conversation.activeTopic.id, 'b');
  assert.equal(conversation.replies.length, 0);
  assert.equal(updated.at(-1).id, 'a');
  assert.equal(updated.at(-1).repliesCount, 1);
});

test('topic creation retries the same ID without losing the form or allowing duplicate requests', async (t) => {
  const request = deferred();
  const ids = [], created = [];
  const api = { create: async input => { ids.push(input.id); if (ids.length === 1) return request.promise; return topic(input.id); } };
  const { useTopicComposer } = hooksLoader()('components/board/useTopicComposer.ts');
  let composer;
  function App() { composer = useTopicComposer(api, 'owner', value => created.push(value)); return null; }
  await mount(t, h(App));
  await act(async () => { composer.setNewTitle('Title'); composer.setNewContent('Draft content'); composer.setShowCreate(true); });
  let pending;
  await act(async () => { pending = composer.create(); void composer.create(); });
  assert.equal(ids.length, 1);
  await act(async () => { request.reject(new Error('Network failed')); await pending; });
  assert.equal(composer.newContent, 'Draft content');
  assert.equal(composer.showCreate, true);
  await act(async () => composer.create());
  assert.equal(ids[0], ids[1]);
  assert.equal(created.length, 1);
  assert.equal(composer.showCreate, false);
  assert.equal(composer.newContent, '');
});

function readerHooks() {
  return loadUi({}, { 'components/reader/useScreenPages': { useScreenPages: (_viewport, _flow, initialOffset) => {
    const [page, move] = React.useState(Math.floor(initialOffset / 2500));
    return { page, count: 3, width: 500, ready: true, offset: page * 2500, transform: '', move,
      offsetForPage: index => index * 2500, pageForOffset: offset => Math.min(2, Math.floor(offset / 2500)) };
  } } });
}

test('reader keeps the visible page on write failure and advances only after the retry is saved', async (t) => {
  const request = deferred();
  const writes = [];
  const load = readerHooks();
  const { useReaderProgress } = load('components/reader/useReaderProgress.ts');
  const { useReaderNavigation } = load('components/reader/useReaderNavigation.ts');
  const book = { id: 'book', content: 'x'.repeat(7500), status: 'want_to_read', currentPage: 1 };
  const save = async value => { writes.push(value); if (writes.length === 1) return request.promise; };
  let progress, navigation;
  const onPageChanged = () => {};
  function App() {
    progress = useReaderProgress(book, save);
    const viewportRef = React.useRef(null), flowRef = React.useRef(null);
    navigation = useReaderNavigation({ book, document: { blocks: [] }, viewportRef, flowRef, fontSize: 22, fontFamily: 'serif', blocked: false, progress, onPageChanged });
    return null;
  }
  await mount(t, h(App));
  let pending;
  await act(async () => { pending = navigation.handlePageChange(2); void navigation.handlePageChange(3); });
  assert.equal(writes.length, 1);
  assert.equal(navigation.currentPage, 1);
  const originalError = console.error;
  console.error = () => {};
  try { await act(async () => { request.reject(new Error('Write failed')); await pending; }); }
  finally { console.error = originalError; }
  assert.equal(navigation.currentPage, 1);
  assert.ok(progress.saveError);
  await act(async () => navigation.handlePageChange(2));
  assert.equal(navigation.currentPage, 2);
  assert.equal(writes[1].readingOffset, 2500);
  assert.equal(writes[1].currentPage, 2);
  assert.equal(writes[1].status, 'reading');
  assert.equal(progress.saveError, null);
});

test('reader footnotes do not move progress and keyboard page turns respect open windows and inputs', async (t) => {
  const load = readerHooks();
  const { useReaderProgress } = load('components/reader/useReaderProgress.ts');
  const { useReaderNavigation } = load('components/reader/useReaderNavigation.ts');
  const writes = [];
  const epub = { blocks: [{ id: 'chapter', start: 2500 }], notes: { footnote: { text: 'Note' } }, targets: { chapter: 'chapter' } };
  const book = { id: 'book', content: 'x'.repeat(7500), status: 'reading', currentPage: 1 };
  const save = async value => { writes.push(value); };
  let navigation;
  const onPageChanged = () => {};
  function App() {
    const progress = useReaderProgress(book, save);
    const viewportRef = React.useRef(null), flowRef = React.useRef(null);
    navigation = useReaderNavigation({ book, document: epub, epub, viewportRef, flowRef, fontSize: 22, fontFamily: 'serif', blocked: false, progress, onPageChanged });
    return h('input', { id: 'reader-test-input' });
  }
  await mount(t, h(App));
  await act(async () => navigation.navigateEpub('footnote'));
  await act(async () => document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  assert.equal(writes.length, 0);
  assert.equal(navigation.footnote, 'footnote');
  await act(async () => navigation.setFootnote(null));
  await act(async () => document.querySelector('#reader-test-input').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  assert.equal(writes.length, 0);
  await act(async () => navigation.goToBlock('chapter'));
  assert.equal(navigation.currentPage, 2);
  assert.equal(writes[0].readingOffset, 2500);
});

test('reader note retries preserve both the quote and persistent ID, then clear the draft after success', async (t) => {
  const load = readerHooks();
  const { useReaderProgress } = load('components/reader/useReaderProgress.ts');
  const { useReaderAnnotations } = load('components/reader/useReaderAnnotations.ts');
  const attempts = [];
  let saved = 0, notes;
  const book = { id: 'book' };
  const write = async annotation => { attempts.push(annotation); if (attempts.length === 1) throw new Error('Network failed'); };
  function App() {
    const progress = useReaderProgress(book, async () => {});
    notes = useReaderAnnotations({ book, user: { id: 'owner' }, quote: 'Selected passage', progress,
      onSaveAnnotation: write, onDeleteAnnotation: async () => {}, onActivitySaved: async () => {}, onSaved: () => saved++ });
    return null;
  }
  await mount(t, h(App));
  await act(async () => { notes.startNote(); notes.setNoteText('My thought'); });
  const originalError = console.error;
  console.error = () => {};
  try { await act(async () => notes.saveNote()); }
  finally { console.error = originalError; }
  assert.equal(notes.noteText, 'My thought');
  assert.equal(saved, 0);
  await act(async () => notes.saveNote());
  assert.equal(attempts[0].id, attempts[1].id);
  assert.equal(attempts[1].quote, 'Selected passage');
  assert.equal(saved, 1);
  assert.equal(notes.noteText, '');
});

test('a failed screen exposes recovery controls and another route can still render', async (t) => {
  const { AppErrorBoundary } = loadUi()('components/AppErrorBoundary.tsx');
  function BrokenScreen() { throw new Error('Screen failed'); }
  let reloads = 0, backs = 0;
  const originalError = console.error;
  console.error = () => {};
  try {
    const view = await mount(t, h(AppErrorBoundary, { resetKey: 'library', onBack: () => backs++, onReload: () => reloads++ }, h(BrokenScreen)));
    assert.match(view.container.querySelector('[role="alert"]').textContent, /Не удалось открыть раздел/);
    const buttons = [...view.container.querySelectorAll('button')];
    await act(async () => buttons.find(button => button.textContent === 'Обновить страницу').click());
    await act(async () => buttons.find(button => button.textContent === 'На главную').click());
    assert.equal(reloads, 1);
    assert.equal(backs, 1);
    await view.render(h(AppErrorBoundary, { resetKey: 'home' }, h('p', null, 'Главная доступна')));
    assert.equal(view.container.querySelector('[role="alert"]'), null);
    assert.match(view.container.textContent, /Главная доступна/);
  } finally { console.error = originalError; }
});

test('rejected lazy imports show a startup recovery screen instead of leaving an empty app', async (t) => {
  const { AppErrorBoundary } = loadUi()('components/AppErrorBoundary.tsx');
  const request = deferred();
  const LazyScreen = React.lazy(() => request.promise);
  const originalError = console.error;
  console.error = () => {};
  try {
    const view = await mount(t, h(AppErrorBoundary, null, h(React.Suspense, { fallback: h('p', null, 'Загрузка') }, h(LazyScreen))));
    assert.match(view.container.textContent, /Загрузка/);
    await act(async () => request.reject(new Error('Chunk unavailable')));
    assert.match(view.container.querySelector('[role="alert"]').textContent, /Не удалось открыть BookNook/);
    assert.equal(view.container.querySelectorAll('button').length, 1);
  } finally { console.error = originalError; }
});

test('nested dialogs own keyboard focus and retain scroll lock until the final dialog closes', async (t) => {
  const { useDialog } = loadUi()('utils/useDialog.ts');
  const closed = [];
  function Dialog({ name, open = true, busy = false }) {
    const ref = useDialog(() => closed.push(name), busy, false, open);
    return open ? h('section', { ref, tabIndex: -1, 'data-dialog': name },
      h('button', { 'data-first': name }, 'First'), h('button', { 'data-last': name }, 'Last')) : null;
  }
  const opener = document.createElement('button');
  document.body.append(opener);
  t.after(() => { opener.remove(); document.body.style.overflow = ''; });
  opener.focus();
  document.body.style.overflow = 'clip';
  const tree = (child, busy = false) => h(React.Fragment, null, h(Dialog, { key: 'parent', name: 'parent' }), child && h(Dialog, { key: 'child', name: 'child', busy }));
  const view = await mount(t, tree(false));
  const parentOpener = document.querySelector('[data-last="parent"]');
  parentOpener.focus();
  await view.render(tree(true));
  assert.equal(document.activeElement.dataset.first, 'child');
  const first = document.querySelector('[data-first="child"]');
  const last = document.querySelector('[data-last="child"]');
  last.focus();
  assert.equal(key('Tab').defaultPrevented, true);
  assert.equal(document.activeElement, first);
  key('Tab', true);
  assert.equal(document.activeElement, last);
  key('Escape');
  assert.deepEqual(closed, ['child']);
  await view.render(tree(true, true));
  key('Escape');
  assert.deepEqual(closed, ['child'], 'busy top dialog must not close itself or its parent');
  await view.render(tree(false));
  assert.equal(document.activeElement, parentOpener);
  assert.equal(document.body.style.overflow, 'hidden');
  key('Escape');
  assert.deepEqual(closed, ['child', 'parent']);
  await view.render(null);
  assert.equal(document.activeElement, opener);
  assert.equal(document.body.style.overflow, 'clip');
});

test('removing a parent behind a portal preserves the child lock and eventual focus restoration', async (t) => {
  const { useDialog } = loadUi()('utils/useDialog.ts');
  function Dialog({ name, open }) {
    const ref = useDialog(() => {}, false, false, open);
    return open ? h('section', { ref, tabIndex: -1 }, h('button', { 'data-first': name }, name)) : null;
  }
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  t.after(() => opener.remove());
  const tree = (parent, child) => h(React.Fragment, null,
    h(Dialog, { key: 'parent', name: 'parent', open: parent }), h(Dialog, { key: 'child', name: 'child', open: child }));
  const view = await mount(t, tree(true, false));
  await view.render(tree(true, true));
  const childButton = document.querySelector('[data-first="child"]');
  await view.render(tree(false, true));
  assert.equal(document.activeElement, childButton);
  assert.equal(document.body.style.overflow, 'hidden');
  await view.render(tree(false, false));
  assert.equal(document.activeElement, opener);
  assert.equal(document.body.style.overflow, '');
});

test('guest login prompt takes focus above an open topic and Escape returns to that topic', async (t) => {
  const load = loadUi();
  const { useDialog } = load('utils/useDialog.ts');
  const { LoginPrompt } = load('components/LoginPrompt.tsx');
  let parentCloses = 0;
  function Topic() {
    const ref = useDialog(() => parentCloses++);
    return h('section', { ref, tabIndex: -1 }, h('button', { id: 'topic-login' }, 'Login'));
  }
  function App() {
    const [open, setOpen] = React.useState(false);
    return h(React.Fragment, null, h(Topic), h('button', { id: 'open-prompt', onClick: () => setOpen(true) }, 'Open'),
      h(LoginPrompt, { isOpen: open, onClose: () => setOpen(false), onLogin: () => {} }));
  }
  await mount(t, h(App));
  const opener = document.querySelector('#topic-login');
  opener.focus();
  await act(async () => document.querySelector('#open-prompt').click());
  const prompt = document.querySelector('[aria-labelledby="login-prompt-title"]');
  assert.ok(prompt.contains(document.activeElement));
  await act(async () => key('Escape'));
  assert.equal(document.querySelector('[aria-labelledby="login-prompt-title"]'), null);
  assert.equal(parentCloses, 0);
  assert.equal(document.activeElement, opener);
  assert.equal(document.body.style.overflow, 'hidden');
});

test('pending sign-in rejects duplicate submit and prevents switching into guest or registration', async (t) => {
  const request = deferred();
  let logins = 0, guests = 0, signedIn = 0;
  const { Auth } = loadUi({ login: () => { logins++; return request.promise; } })('components/Auth.tsx');
  const { container } = await mount(t, h(Auth, { onLogin: () => signedIn++, onGuestLogin: () => guests++ }));
  await fill(container.querySelector('#auth-login'), 'reader@example.com');
  await fill(container.querySelector('#auth-password'), 'password');
  const form = container.querySelector('form');
  const guest = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Продолжить как гость'));
  const register = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Впервые здесь'));
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(logins, 1);
  assert.equal(guest.disabled, true);
  assert.equal(register.disabled, true);
  await act(async () => { guest.click(); register.click(); });
  assert.equal(guests, 0);
  assert.equal(container.querySelector('#auth-name'), null);
  await act(async () => request.resolve({ user: { id: 'reader' }, books: [] }));
  assert.equal(signedIn, 1);
  assert.equal(guest.disabled, false);
});

test('failed sign-in keeps credentials, announces the error, and enables retry', async (t) => {
  const request = deferred();
  const { Auth } = loadUi({ login: () => request.promise })('components/Auth.tsx');
  const { container } = await mount(t, h(Auth, { onLogin: () => assert.fail('unexpected login'), onGuestLogin: () => {} }));
  await fill(container.querySelector('#auth-login'), 'reader@example.com');
  await fill(container.querySelector('#auth-password'), 'password');
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  const originalError = console.error;
  console.error = () => {};
  try { await act(async () => request.reject(new Error('Неверный пароль'))); }
  finally { console.error = originalError; }
  assert.match(container.querySelector('[role="alert"]').textContent, /Неверный пароль/);
  assert.equal(container.querySelector('#auth-login').value, 'reader@example.com');
  assert.equal(container.querySelector('#auth-password').value, 'password');
  assert.equal(container.querySelector('button[type="submit"]').disabled, false);
});

test('successful profile save remains successful when a subsequent profile read is unavailable', async (t) => {
  const user = { id: 'reader', name: 'Анна', handle: '@anna', role: 'user', avatar: 'avatar', level: 2, xp: 1500, joinedDate: '2026-01-01', booksReadThisYear: 0, streakDays: 0 };
  const saved = [];
  const { Profile } = loadUi({
    updateUserProfile: async () => {},
    getPublicProfile: async () => { throw new Error('Network unavailable'); },
  })('components/Profile.tsx');
  const { container } = await mount(t, h(Profile, { user, books: [], onUpdateUser: next => saved.push(next) }));
  await act(async () => container.querySelector('[aria-label="Редактировать профиль"]').click());
  await fill(container.querySelector('#profile-name'), 'Мария');
  const save = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Сохранить'));
  await act(async () => save.click());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, 'Мария');
  assert.equal(saved[0].xp, 1500);
  assert.match(container.querySelector('h1').textContent, /Мария/);
  assert.equal(container.querySelector('#profile-name'), null);
  assert.equal(container.querySelector('[role="alert"]'), null);
});

test('failed profile save preserves the draft and blocks cancel or duplicate writes while pending', async (t) => {
  const request = deferred();
  let writes = 0;
  const user = { id: 'reader', name: 'Анна', handle: '@anna', role: 'user', avatar: 'avatar', level: 1, xp: 0, joinedDate: '2026-01-01', booksReadThisYear: 0, streakDays: 0 };
  const { Profile } = loadUi({ updateUserProfile: () => { writes++; return request.promise; } })('components/Profile.tsx');
  const { container } = await mount(t, h(Profile, { user, books: [], onUpdateUser: () => assert.fail('failed write cannot update the user') }));
  await act(async () => container.querySelector('[aria-label="Редактировать профиль"]').click());
  await fill(container.querySelector('#profile-name'), 'Мария');
  const save = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Сохранить'));
  const cancel = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Отмена'));
  await act(async () => { save.click(); save.click(); });
  assert.equal(writes, 1);
  assert.equal(cancel.disabled, true);
  assert.equal(container.querySelector('#profile-name').disabled, true);
  const originalError = console.error;
  console.error = () => {};
  try { await act(async () => request.reject(new Error('Network unavailable'))); }
  finally { console.error = originalError; }
  assert.equal(container.querySelector('#profile-name').value, 'Мария');
  assert.equal(container.querySelector('#profile-name').disabled, false);
  assert.match(container.querySelector('[role="alert"]').textContent, /Изменения остались в форме/);
  assert.equal(save.disabled, false);
});

test('moderation report and block cannot race, and pending work keeps its dialog open', async (t) => {
  const request = deferred();
  let reports = 0, blocks = 0, closes = 0;
  const { ModerationDialog } = loadUi({
    reportContent: () => { reports++; return request.promise; },
    blockUser: async () => { blocks++; },
  })('components/ModerationDialog.tsx');
  await mount(t, h(ModerationDialog, {
    currentUser: { id: 'reader' }, target: { userId: 'author', contentType: 'user', userName: 'Анна' },
    onBlocked: () => {}, onClose: () => closes++,
  }));
  const dialog = document.querySelector('[aria-labelledby="moderation-title"]');
  const report = [...dialog.querySelectorAll('button')].find(button => button.textContent.includes('Отправить жалобу'));
  const block = [...dialog.querySelectorAll('button')].find(button => button.textContent.includes('Заблокировать'));
  await act(async () => { report.click(); block.click(); });
  assert.equal(reports, 1);
  assert.equal(blocks, 0);
  assert.equal(block.disabled, true);
  await act(async () => key('Escape'));
  assert.equal(closes, 0);
  await act(async () => request.resolve());
  assert.match(dialog.querySelector('[role="status"]').textContent, /Жалоба отправлена/);
  assert.equal(block.disabled, false);
});

test('delete confirmation announces its title and description and focuses the safe action', async (t) => {
  const { ConfirmDialog } = loadUi()('components/ConfirmDialog.tsx');
  await mount(t, h(ConfirmDialog, { isOpen: true, title: 'Удалить тему?', message: 'Отменить это действие нельзя.', onConfirm: () => {}, onCancel: () => {} }));
  const dialog = document.querySelector('[role="alertdialog"]');
  assert.equal(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent, 'Удалить тему?');
  assert.equal(document.getElementById(dialog.getAttribute('aria-describedby')).textContent, 'Отменить это действие нельзя.');
  assert.equal(document.activeElement.textContent, 'Отмена');
});
