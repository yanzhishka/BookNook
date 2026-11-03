import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, URL, URLSearchParams });
  return exports;
}
const { parseWatchSource, parseWatchInvite, makeWatchInvite, watchPosition, watchPlaybackKey, watchTime } = load('services/watch/model.ts');
const { parseSubtitles, subtitleText, subtitlesVtt } = load('services/watch/subtitles.ts');
const { initialDestination } = load('services/ecosystem.ts');
const id = 'b854787a-221c-4b57-83b9-7ee822a1174b';

test('YouTube links normalize across mobile, short, embed and Shorts formats', () => {
  for (const link of ['https://www.youtube.com/watch?v=M7lc1UVf-VE&list=ignored', 'https://youtu.be/M7lc1UVf-VE?t=10',
    'https://m.youtube.com/watch?v=M7lc1UVf-VE', 'youtube.com/shorts/M7lc1UVf-VE', 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE']) {
    const source = parseWatchSource(link);
    assert.equal(source.provider, 'youtube'); assert.equal(source.videoId, 'M7lc1UVf-VE');
    assert.equal(source.mediaUrl, 'https://www.youtube.com/watch?v=M7lc1UVf-VE');
  }
});
test('video sources reject active schemes, credentials, unsupported sites and channel links', () => {
  for (const link of ['javascript:alert(1)', 'data:video/mp4,abc', 'file:///test.mp4', 'http://example.com/test.mp4',
    'https://user:password@example.com/test.mp4', 'https://youtube.com/@channel', 'https://youtube.com/playlist?list=123',
    'https://youtube.com/watch?v=invalid', 'https://example.com/movie.html']) assert.throws(() => parseWatchSource(link));
  const source = parseWatchSource('https://example.com/video.WEBM?signature=keep#t=10');
  assert.equal(source.provider, 'direct'); assert.equal(source.mediaUrl, 'https://example.com/video.WEBM?signature=keep');
});
test('invitation links carry only the room and app, without copying auth parameters or fragments', () => {
  const invite = makeWatchInvite(id, 'https://example.com/?access_token=private#private');
  assert.equal(invite, `https://example.com/?app=watch&room=${id}`);
  assert.equal(parseWatchInvite(invite), id);
  assert.equal(parseWatchInvite(id.toUpperCase()), id);
  for (const value of ['', '1234', 'https://example.com/?room=invalid', `javascript:?room=${id}`]) assert.throws(() => parseWatchInvite(value));
});
test('shared position advances on server time, freezes on pause and remains bounded', () => {
  const room = { position: 15, playing: true, playbackAt: '2026-11-02T00:00:00Z', closedAt: null };
  const start = Date.parse(room.playbackAt);
  assert.equal(watchPosition(room, start + 5000), 20);
  assert.equal(watchPosition({ ...room, playing: false }, start + 5000), 15);
  assert.equal(watchPosition({ ...room, closedAt: room.playbackAt }, start + 5000), 15);
  assert.equal(watchPosition(room, start - 5000), 15);
  assert.equal(watchPosition(room, start + 999999999), 172800);
  assert.equal(watchTime(3661), '1:01:01'); assert.equal(watchTime(61), '1:01');
});
test('shared speed scales elapsed media time without reacting to queue-only revisions', () => {
  const room = { id, provider: 'direct', mediaUrl: 'https://example.com/a.mp4', position: 10, playing: true,
    playbackAt: '2026-11-03T00:00:00Z', closedAt: null, playbackRate: 2, version: 5 };
  const now = Date.parse(room.playbackAt) + 5000;
  assert.equal(watchPosition(room, now), 20);
  assert.equal(watchPosition({ ...room, playbackRate: .5 }, now), 12.5);
  assert.equal(watchPlaybackKey(room, 0), watchPlaybackKey({ ...room, version: 6 }, 0));
  assert.notEqual(watchPlaybackKey(room, 0), watchPlaybackKey({ ...room, playbackRate: 1 }, 0));
  assert.notEqual(watchPlaybackKey(room, 0), watchPlaybackKey(room, 1));
});
test('SRT and WebVTT normalize BOM, line endings, identifiers and safe cue text', () => {
  const cues = parseSubtitles('\uFEFF1\r\n00:00:01,000 --> 00:00:03,500\r\n<b>Привет</b> &amp; мир\r\n\r\n2\r\n00:00:03,000 --> 00:00:05,000\r\nВторая строка');
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, 'Привет & мир');
  assert.equal(subtitleText(cues, 3.2), 'Привет & мир\nВторая строка');
  assert.equal(subtitleText(cues, 1, 1), '');
  assert.equal(subtitleText(cues, 2, 1), 'Привет & мир');
  const vtt = subtitlesVtt(cues, -.5);
  assert.match(vtt, /^WEBVTT\n\n00:00:00\.500 --> 00:00:03\.000/);
  assert.equal(parseSubtitles(vtt)[0].text, cues[0].text);
  const styled = parseSubtitles('WEBVTT\n\nSTYLE\n::cue { color:red; }\n\ncue-id\n00:01.000 --> 00:02.000 align:start\n<v Speaker><i>Text</i></v>');
  assert.equal(styled.length, 1); assert.equal(styled[0].text, 'Text');
});
test('subtitle files reject invalid timing, empty documents and excessive input', () => {
  for (const value of ['', 'not subtitles', '1\n00:00:06,000 --> 00:00:01,000\nBad', '1\n00:99:00,000 --> 00:99:01,000\nBad'])
    assert.throws(() => parseSubtitles(value));
  assert.throws(() => parseSubtitles('x'.repeat(5 * 1024 * 1024 + 1)));
  const vtt = subtitlesVtt([{ start: 0, end: 1, text: '<img src=x> & text' }]);
  assert.match(vtt, /&lt;img src=x&gt; &amp; text/);
  assert.equal(subtitlesVtt([{ start: 0, end: 1, text: 'Gone' }], -2), 'WEBVTT\n\n\n');
});
test('room invitations open the watch product and existing book routes still migrate correctly', () => {
  assert.equal(initialDestination(`?app=watch&room=${id}`, 'books', 'library').tab, 'watch-home');
  assert.equal(initialDestination(`?room=${id}`, null, null).roomId, id);
  assert.equal(initialDestination('', 'books', 'feed').tab, 'board');
  assert.equal(initialDestination('', 'watch', 'library').tab, 'watch-home');
  assert.equal(initialDestination('?app=books', 'watch', 'watch-home').product, 'books');
  assert.equal(initialDestination('', 'books', 'watch-home').product, 'books');
});
