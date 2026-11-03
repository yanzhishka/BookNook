import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { loadDb } from '../tests/helpers/load-db.mjs';

// Explicit opt-in: this creates and removes two temporary accounts in the
// selected project. It never deletes accounts that it did not create.
if (process.env.BOOKNOOK_ALLOW_REMOTE_TESTS !== '1') {
  throw new Error('Set BOOKNOOK_ALLOW_REMOTE_TESTS=1 to run remote data checks.');
}
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Configure .env.local before running verification.');
const settingsResponse = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
if (!settingsResponse.ok) throw new Error('Could not read test project auth settings.');
if (!(await settingsResponse.json()).mailer_autoconfirm) {
  throw new Error('Use a test project with email autoconfirm; no accounts were created.');
}
const newClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const clients = [newClient(), newClient()];
const accounts = [];
const password = `Bnook-${randomUUID()}-7a!`;
const anon = newClient();
const saved = result => {
  if (result.error) throw result.error;
  return result.data;
};

try {
  for (const client of clients) {
    const result = await client.auth.signUp({
      email: `bnook-data-${randomUUID()}@example.com`, password,
      options: { data: { name: 'Data Verification', terms_accepted_at: new Date().toISOString() } },
    });
    const account = saved(result);
    if (!account.session) throw new Error('Test accounts need confirmed sessions; use a test project with email autoconfirm.');
    accounts.push(account.user.id);
  }
  const [first, second] = clients;
  const firstDb = loadDb(first);
  const secondDb = loadDb(second);
  const ownerId = accounts[0];
  const bookDraft = {
    id: randomUUID(), title: 'Temporary data verification', author: 'BookNook',
    content: 'A reading passage for persistence checks. '.repeat(220),
    status: 'want_to_read', progress: 0, currentPage: 1, totalPages: 4,
  };
  const book = await firstDb.addBook(bookDraft, ownerId);
  await firstDb.addBook(bookDraft, ownerId);
  assert.equal(saved(await first.from('books').select('id').eq('id', book.id)).length, 1);

  const note = { id: randomUUID(), quote: 'A reading passage', comment: 'Persist this note', color: 'amber', timestamp: Date.now() };
  await firstDb.saveAnnotation(book.id, ownerId, book.title, note);
  await firstDb.saveAnnotation(book.id, ownerId, book.title, note);
  const progress = await firstDb.updateBook({ ...book, annotations: [note], currentPage: 2, status: 'reading', progress: 50 }, ownerId);
  await firstDb.updateBook({ ...progress, currentPage: 3, progress: 75 }, ownerId);
  const reloaded = await firstDb.loadUserData(ownerId);
  assert.equal(reloaded.books[0].currentPage, 3);
  assert.equal(reloaded.books[0].annotationCount, 1);
  assert.equal('content' in reloaded.books[0], false);
  assert.equal((await firstDb.getBookAnnotations(book.id, ownerId))[0].id, note.id);
  assert.equal((await firstDb.getBookContent(book.id, ownerId)).content, bookDraft.content);
  console.log('PASS: book and note retries, progress persistence, reload without duplicates');

  assert.equal(saved(await second.from('books').select('id').eq('id', book.id)).length, 0);
  assert.equal(saved(await second.from('quotes').select('id').eq('id', note.id)).length, 0);
  assert.equal(saved(await second.from('books').update({ progress: 99 }).eq('id', book.id).select('id')).length, 0);
  const foreignNote = await second.from('quotes').insert({ id: randomUUID(), user_id: accounts[1], book_id: book.id, text: 'Forbidden' });
  assert.equal(foreignNote.error?.code, '42501');
  const publicProfile = await loadDb(anon).getPublicProfile(ownerId);
  assert.equal(publicProfile.id, ownerId);
  assert.equal(publicProfile.email, undefined);
  assert.ok((await anon.from('books').select('id')).error);
  assert.equal((await secondDb.getPublicProfile(ownerId)).id, ownerId);
  console.log('PASS: public profiles; guest and second account cannot access private books or notes');

  await firstDb.updateBook({ ...book, currentPage: 4, status: 'completed', progress: 100 }, ownerId);
  assert.equal((await firstDb.getPublicProfile(ownerId)).totalBooksRead, 1);
  await firstDb.deleteAnnotation(note.id, book.id, ownerId);
  await firstDb.deleteAnnotation(note.id, book.id, ownerId);
  assert.equal((await firstDb.getBookAnnotations(book.id, ownerId)).length, 0);
  await firstDb.deleteBook(book.id, ownerId);
  assert.equal((await firstDb.loadUserData(ownerId)).books.length, 0);
  assert.equal((await firstDb.getPublicProfile(ownerId)).totalBooksRead, 0);
  console.log('PASS: note deletion survives reload; book deletion updates completion count');
} finally {
  const results = await Promise.allSettled(accounts.map(async (_, index) => {
    await loadDb(clients[index]).deleteAccount();
  }));
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) {
    console.error('Temporary account cleanup failed:', failures.map(result => result.reason?.message));
    process.exitCode = 1;
  } else if (accounts.length) {
    console.log('PASS: temporary accounts and their data removed');
  }
}
