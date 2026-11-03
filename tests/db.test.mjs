import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadDb } from './helpers/load-db.mjs';

function fixture() {
  const calls = [];
  const tables = { books: new Map(), quotes: new Map(), profiles: new Map() };
  let failure = null;
  const client = { from(table) {
    const call = { table, operation: 'select', filters: {} };
    calls.push(call);
    const run = (single = false) => {
      if (failure) return { data: null, error: { message: failure } };
      const rows = table === 'book_shelf' ? new Map([...tables.books].map(([id, book]) => [id, {
        ...book, has_content: Boolean(book.content), annotation_count: [...tables.quotes.values()].filter(note => note.book_id === id && note.user_id === book.user_id).length,
      }])) : tables[table];
      const matching = () => [...rows.values()].filter(row =>
        Object.entries(call.filters).every(([key, value]) => row[key] === value));
      if (call.operation === 'upsert') {
        const row = { created_at: new Date().toISOString(), ...rows.get(call.payload.id), ...call.payload };
        rows.set(row.id, row);
        return { data: row, error: null };
      }
      if (call.operation === 'update') {
        const row = matching()[0];
        if (!row) return { data: null, error: { message: 'Row not found' } };
        Object.assign(row, call.payload);
        return { data: row, error: null };
      }
      if (call.operation === 'delete') {
        const selected = matching();
        selected.forEach(row => rows.delete(row.id));
        return { data: selected[0] || null, error: null };
      }
      const selected = matching().slice(call.start || 0, call.end === undefined ? undefined : call.end + 1);
      return { data: single ? selected[0] || null : selected, error: null };
    };
    const query = {
      upsert(payload) { call.operation = 'upsert'; call.payload = payload; return query; },
      update(payload) { call.operation = 'update'; call.payload = payload; return query; },
      delete() { call.operation = 'delete'; return query; },
      select(columns) { call.columns = columns; return query; },
      eq(key, value) { call.filters[key] = value; return query; },
      order() { return query; },
      range(start, end) { call.start = start; call.end = end; return query; },
      abortSignal(signal) { call.signal = signal; return query; },
      single() { return Promise.resolve(run(true)); },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return query;
  } };
  const db = loadDb(client);
  const userId = randomUUID();
  const book = { id: randomUUID(), title: 'Test book', author: 'Author', status: 'reading', progress: 10, currentPage: 1, totalPages: 10, annotations: [] };
  const annotation = { id: randomUUID(), quote: 'Selected text', comment: 'A note', color: 'amber', timestamp: Date.now() };
  return { db, calls, tables, book, userId, annotation, fail(message) { failure = message; } };
}

test('retrying a note save uses one persistent ID and produces one row', async () => {
  const { db, tables, book, userId, annotation } = fixture();
  const saved = await db.saveAnnotation(book.id, userId, book.title, annotation);
  await db.saveAnnotation(book.id, userId, book.title, annotation);
  assert.equal(saved.id, annotation.id);
  assert.equal(saved.quote, annotation.quote);
  assert.equal(tables.quotes.size, 1);
});

test('turning pages never re-saves annotations', async () => {
  const { db, calls, book, userId, annotation } = fixture();
  const saved = await db.addBook(book, userId);
  saved.annotations = [annotation];
  const updated = await db.updateBook({ ...saved, currentPage: 2, progress: 20 }, userId);
  await db.updateBook({ ...updated, currentPage: 3, progress: 30 }, userId);
  assert.equal(updated.annotations[0].id, annotation.id);
  assert.equal(calls.filter(call => call.table === 'quotes').length, 0);
  assert.equal(calls.at(-1).filters.user_id, userId);
});

test('note deletion reaches the DB with note, book and owner filters', async () => {
  const { db, calls, tables, book, userId, annotation } = fixture();
  await db.saveAnnotation(book.id, userId, book.title, annotation);
  await db.deleteAnnotation(annotation.id, book.id, userId);
  assert.equal(tables.quotes.size, 0);
  assert.deepEqual(calls.at(-1).filters, { id: annotation.id, book_id: book.id, user_id: userId });
});

test('failed note writes and deletes reject, so the UI can retain the draft', async () => {
  const { db, fail, book, userId, annotation } = fixture();
  fail('Network failure');
  await assert.rejects(db.saveAnnotation(book.id, userId, book.title, annotation), /Network failure/);
  await assert.rejects(db.deleteAnnotation(annotation.id, book.id, userId), /Network failure/);
});

test('retrying book creation does not duplicate a book', async () => {
  const { db, tables, book, userId } = fixture();
  await db.addBook(book, userId);
  await db.addBook(book, userId);
  assert.equal(tables.books.size, 1);
});

test('EPUB structure survives creation and replacement while progress writes stay small', async () => {
  const { db, calls, book, userId, annotation } = fixture();
  const document = { format: 'epub', version: 1, blocks: [{ id: 'stanza', text: 'Verse' }] };
  const saved = await db.addBook({ ...book, document, content: 'Verse' }, userId);
  assert.equal(saved.document, document);
  const replaced = await db.replaceBookContent({ ...saved, title: 'Correct title', annotations: [annotation] }, userId);
  assert.equal(replaced.id, book.id);
  assert.equal(replaced.document, document);
  assert.equal(replaced.annotations[0].id, annotation.id);
  assert.equal(calls.at(-1).filters.user_id, userId);
  await db.updateBook({ ...replaced, currentPage: 2 }, userId);
  assert.equal('document' in calls.at(-1).payload, false);
  assert.equal('content' in calls.at(-1).payload, false);
  assert.equal(calls.at(-1).columns.includes('document'), false);
  assert.notEqual(calls.at(-1).columns, '*');
  assert.equal(calls.filter(call => call.table === 'quotes').length, 0);
  await assert.rejects(db.replaceBookContent(replaced, 'different-owner'), /Row not found/);
});

test('screen-page progress stores a text anchor, including offset zero', async () => {
  const { db, calls, book, userId } = fixture();
  const created = await db.addBook({ ...book, readingOffset: 0 }, userId);
  assert.equal(created.readingOffset, 0);
  const moved = await db.updateBook({ ...created, currentPage: 2, readingOffset: 3210 }, userId);
  assert.equal(moved.readingOffset, 3210);
  assert.equal(calls.at(-1).payload.reading_offset, 3210);
  assert.equal(calls.at(-1).filters.user_id, userId);
  const reset = await db.updateBook({ ...moved, currentPage: 1, readingOffset: 0 }, userId);
  assert.equal(reset.readingOffset, 0);
});

test('public profile loading does not request private books, notes or email', async () => {
  const { db, tables, calls, userId } = fixture();
  tables.profiles.set(userId, { id: userId, name: 'Reader', completed_count: 3 });
  const profile = await db.getPublicProfile(userId);
  assert.equal(profile.totalBooksRead, 3);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, 'profiles');
  assert.equal(calls[0].columns.includes('email'), false);
});

test('failed progress writes do not return a success result', async () => {
  const { db, fail, book, userId } = fixture();
  fail('Save rejected');
  await assert.rejects(db.updateBook(book, userId), /Save rejected/);
});

test('numeric login authenticates through Supabase and keeps the server profile role', async () => {
  let credentials;
  const db = loadDb({ auth: { async signInWithPassword(input) {
    credentials = input;
    return { data: { user: { id: 'server-user', email: input.email } }, error: null };
  } } });
  db.loadUserData = async id => ({ user: { id, role: 'user' }, books: [] });
  const session = await db.login(' 123 ', 'supplied-password');
  assert.equal(credentials.email, '123@booknook.local');
  assert.equal(credentials.password, 'supplied-password');
  assert.equal(session.user.role, 'user');
});

test('numeric login does not bypass a rejected password', async () => {
  const db = loadDb({ auth: { async signInWithPassword() {
    return { data: { user: null }, error: { message: 'Invalid login credentials' } };
  } } });
  db.loadUserData = async () => { throw new Error('Must not load a profile after failed authentication'); };
  await assert.rejects(db.login('123', 'wrong-password'), /Invalid login credentials/);
});

test('email login still passes the email and password to Supabase', async () => {
  let credentials;
  const db = loadDb({ auth: { async signInWithPassword(input) {
    credentials = input;
    return { data: { user: { id: 'email-user', email: input.email } }, error: null };
  } } });
  db.loadUserData = async id => ({ user: { id, role: 'user' }, books: [] });
  await db.login(' reader@example.com ', 'supplied-password');
  assert.equal(credentials.email, 'reader@example.com');
});

test('session bootstrap loads metadata and note counts without book bodies or private note text', async () => {
  const { db, tables, calls, book, userId, annotation } = fixture();
  tables.profiles.set(userId, { id: userId, name: 'Reader' });
  await db.addBook({ ...book, content: 'Large private text', document: { format: 'epub' } }, userId);
  await db.saveAnnotation(book.id, userId, book.title, annotation);
  calls.length = 0;
  const session = await db.loadUserData(userId);
  assert.equal(session.books[0].hasContent, true);
  assert.equal(session.books[0].annotationCount, 1);
  for (const field of ['content', 'document', 'annotations']) assert.equal(field in session.books[0], false);
  assert.equal('quotes' in session, false);
  assert.deepEqual(calls.map(call => call.table).sort(), ['book_shelf', 'profiles']);
});

test('opening a book fetches only its own content, deduplicates it, and reads fresh notes separately', async () => {
  const { db, calls, book, userId, annotation } = fixture();
  await db.addBook({ ...book, content: 'Private reading text' }, userId);
  calls.length = 0;
  const [first, second] = await Promise.all([db.getBookContent(book.id, userId), db.getBookContent(book.id, userId)]);
  assert.equal(first.content, 'Private reading text');
  assert.equal(second, first);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].columns, 'content,document');
  assert.deepEqual(calls[0].filters, { id: book.id, user_id: userId });
  await db.getBookContent(book.id, userId);
  assert.equal(calls.length, 1);
  await db.saveAnnotation(book.id, userId, book.title, annotation);
  const notes = await db.getBookAnnotations(book.id, userId);
  assert.equal(notes[0].id, annotation.id);
  assert.deepEqual(calls.at(-1).filters, { book_id: book.id, user_id: userId });
  await db.deleteAnnotation(annotation.id, book.id, userId);
  assert.equal((await db.getBookAnnotations(book.id, userId)).length, 0);
  await assert.rejects(db.getBookContent(book.id, 'another-owner'));
});

test('large shelves and note lists are not truncated at the API row limit', async () => {
  const { db, tables, userId, book } = fixture();
  for (let index = 0; index < 1005; index++) {
    const id = `book-${index}`;
    tables.books.set(id, { id, user_id: userId, title: id });
    tables.quotes.set(`note-${index}`, { id: `note-${index}`, user_id: userId, book_id: book.id, text: 'Note' });
  }
  assert.equal((await db.getBookShelf(userId)).length, 1005);
  assert.equal((await db.getBookAnnotations(book.id, userId)).length, 1005);
});

test('replacing and deleting a cached book cannot leave its previous document available', async () => {
  const { db, book, userId } = fixture();
  await db.addBook({ ...book, content: 'Old text' }, userId);
  assert.equal((await db.getBookContent(book.id, userId)).content, 'Old text');
  await db.replaceBookContent({ ...book, content: 'New text', annotationCount: 7 }, userId);
  assert.equal((await db.getBookContent(book.id, userId)).content, 'New text');
  await db.deleteBook(book.id, userId);
  await assert.rejects(db.getBookContent(book.id, userId));
});
