import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCommunity } from './helpers/load-community.mjs';

const row = (id = 'topic', patch = {}) => ({ id, source: 'thread', kind: 'discussion', title: 'Тема', content: 'Текст', author_id: 'owner', created_at: '2026-11-01T10:00:00Z', ...patch });
function fakeClient(results) {
  const calls = [];
  const client = { calls };
  function request(table) {
    const call = { table, methods: [] };
    calls.push(call);
    const result = results.shift();
    assert.ok(result, `Missing response for ${table}`);
    const chain = { then(resolve, reject) { return Promise.resolve(typeof result === 'function' ? result() : result).then(resolve, reject); } };
    for (const name of ['select','eq','insert','upsert','delete','order','range','single','abortSignal']) {
      chain[name] = (...args) => { call.methods.push([name, ...args]); return chain; };
    }
    return chain;
  }
  client.from = request;
  client.rpc = (name, args) => { const chain = request(name); calls.at(-1).args = args; return chain; };
  return client;
}

test('topic mapping exposes only public book metadata and identities include source', () => {
  const { mapCommunityTopic, topicKey } = loadCommunity({});
  const topic = mapCommunityTopic(row('same', { source: 'post', kind: 'quote', replies_count: 3, book_snapshot: { title: 'Онегин', author: 'Пушкин', coverUrl: 'cover', content: 'PRIVATE', notes: ['SECRET'] } }));
  assert.equal(JSON.stringify(topic.book), JSON.stringify({ title: 'Онегин', author: 'Пушкин', coverUrl: 'cover' }));
  assert.equal(topicKey(topic), 'post:same');
  assert.notEqual(topicKey(topic), topicKey({ source: 'thread', id: 'same' }));
  assert.equal(topic.kind, 'quote');
  assert.equal(topic.repliesCount, 3);
  assert.throws(() => mapCommunityTopic(row(null)), /Некорректная/);
});

test('search sends all criteria to the server and uses one extra row for pagination', async () => {
  const client = fakeClient([{ data: [row('a'),row('b'),row('c')], error: null }]);
  const { community } = loadCommunity(client);
  const result = await community.list({ query: '  Пушкин  ', kind: 'quote', scope: 'mine', sort: 'popular', offset: 20, pageSize: 2 });
  assert.equal(JSON.stringify(client.calls[0].args), JSON.stringify({ p_query: 'Пушкин', p_kind: 'quote', p_scope: 'mine', p_sort: 'popular', p_offset: 20, p_limit: 3 }));
  assert.equal(result.topics.length, 2);
  assert.equal(result.hasMore, true);
});

test('an aborted request cannot return late topics even if the transport ignores cancellation', async () => {
  const controller = new AbortController();
  const client = fakeClient([() => { controller.abort(); return { data: [row()], error: null }; }]);
  await assert.rejects(loadCommunity(client).community.list({ query: '', kind: 'all', scope: 'all', sort: 'new' }, controller.signal), { name: 'AbortError' });
});

test('likes are idempotent and use the correct source table', async () => {
  for (const source of ['thread', 'post']) {
    const client = fakeClient([{ error: null },{ data: row('t',{source,liked_by_me:true,likes_count:1}),error:null },{ error: null },{ data:row('t',{source}),error:null }]);
    const { community } = loadCommunity(client);
    assert.equal((await community.like({source,id:'t'}, 'owner', true)).likedByMe, true);
    await community.like({source,id:'t'}, 'owner', false);
    assert.equal(client.calls[0].table, source === 'thread' ? 'thread_likes' : 'activity_likes');
    assert.equal(client.calls[0].methods[0][2].ignoreDuplicates, true);
    assert.equal(client.calls[2].methods[0][0], 'delete');
    assert.ok(client.calls[2].methods.some(x => x[0] === 'eq' && x[1] === 'user_id' && x[2] === 'owner'));
  }
});

test('reply pagination reverses only the current page into reading order and preserves legacy authors', async () => {
  const rows = Array.from({length:31}, (_,i) => ({id:`r${i}`, user_id:'reader',content:`Ответ ${i}`,profile:{name:'Анна'},created_at:'2026-11-01T10:00:00Z'}));
  const client = fakeClient([{data:rows,error:null}]);
  const result = await loadCommunity(client).community.replies({source:'post',id:'p'},30);
  assert.equal(result.hasMore,true);
  assert.equal(result.replies.length,30);
  assert.equal(result.replies[0].id,'r29');
  assert.equal(result.replies[29].id,'r0');
  assert.equal(result.replies[0].authorName,'Анна');
  assert.equal(JSON.stringify(client.calls[0].methods.find(x=>x[0]==='range')),JSON.stringify(['range',30,60]));
});

test('ambiguous create retry reuses its UUID and verifies that the existing record belongs to the author', async () => {
  const input = { id:'stable', title:'  Название ',content:' Текст ',kind:'discussion',bookId:null,imageUrl:null };
  const client = fakeClient([{error:{code:'23505',message:'duplicate'}},{data:row('stable'),error:null}]);
  assert.equal((await loadCommunity(client).community.create(input,'owner')).id,'stable');
  assert.equal(client.calls[0].methods[0][1].title,'Название');
  const other = fakeClient([{error:{code:'23505',message:'duplicate'}},{data:row('stable',{author_id:'other'}),error:null}]);
  await assert.rejects(loadCommunity(other).community.create(input,'owner'), /Не удалось создать/);
});

test('reply retries are scoped to both the parent and author; legacy comments reject unsupported images and long text', async () => {
  const client = fakeClient([{data:null,error:{code:'23505',message:'duplicate'}},{data:{id:'r',author_id:'owner',author_name:'Анна',content:'Ответ',created_at:'2026-11-01T10:00:00Z'},error:null}]);
  const {community}=loadCommunity(client);
  await community.reply({source:'thread',id:'t'},{id:'r',content:'Ответ',imageUrl:null},'owner');
  assert.ok(client.calls[1].methods.some(x=>x[0]==='eq'&&x[1]==='thread_id'&&x[2]==='t'));
  assert.ok(client.calls[1].methods.some(x=>x[0]==='eq'&&x[1]==='author_id'&&x[2]==='owner'));
  await assert.rejects(community.reply({source:'post',id:'p'},{id:'r',content:'Ответ',imageUrl:'data:image/png;base64,AA'},'owner'), /текстовый ответ/);
  await assert.rejects(community.reply({source:'post',id:'p'},{id:'r',content:'а'.repeat(2001),imageUrl:null},'owner'), /2000/);
});

test('deletion does not report success for an inaccessible or already deleted row', async () => {
  const client = fakeClient([{data:[],error:null},{data:[],error:null}]);
  const {community}=loadCommunity(client);
  await assert.rejects(community.remove({source:'thread',id:'t'}), /нет права/);
  await assert.rejects(community.removeReply({source:'post',id:'p'},'r'), /нет права/);
  assert.ok(client.calls[1].methods.some(x=>x[0]==='eq'&&x[1]==='activity_id'&&x[2]==='p'));
});
