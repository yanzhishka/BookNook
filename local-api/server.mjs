import Database from 'better-sqlite3';
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.LOCAL_API_PORT || 8787);
const DB_PATH = process.env.LOCAL_DB_PATH || join(__dirname, 'bnook.sqlite');
const SCHEMA_PATH = join(__dirname, 'schema.sql');

const database = new Database(DB_PATH);
database.pragma('foreign_keys = ON');
database.exec(readFileSync(SCHEMA_PATH, 'utf8'));

const JSON_COLUMNS = new Set(['liked_by', 'comments', 'deleted_by']);
const BOOLEAN_COLUMNS = new Set(['is_lendable', 'is_read']);

const CRUD_TABLES = {
  activities: ['id', 'user_id', 'book_id', 'type', 'content', 'timestamp', 'liked_by', 'comments', 'created_at'],
  books: ['id', 'user_id', 'title', 'author', 'cover_url', 'progress', 'status', 'my_rating', 'is_lendable', 'content', 'created_at', 'current_page', 'total_pages'],
  chat_participants: ['chat_id', 'user_id', 'joined_at'],
  chats: ['id', 'created_at', 'updated_at'],
  messages: ['id', 'chat_id', 'sender_id', 'content', 'is_read', 'created_at', 'deleted_by'],
  profiles: ['id', 'email', 'name', 'handle', 'avatar', 'banner_url', 'bio', 'location', 'joined_date', 'streak_days', 'role', 'xp', 'level'],
  quotes: ['id', 'user_id', 'book_id', 'book_title', 'text', 'color', 'timestamp', 'created_at', 'comment'],
  thread_replies: ['id', 'thread_id', 'content', 'image_url', 'author_id', 'author_name', 'created_at'],
  threads: ['id', 'title', 'content', 'image_url', 'author_id', 'author_name', 'created_at'],
};

const PRIMARY_KEY_TABLES = new Set(
  Object.entries(CRUD_TABLES)
    .filter(([, columns]) => columns.includes('id'))
    .map(([table]) => table),
);

const nowIso = () => new Date().toISOString();

const hashPassword = (password, salt = randomBytes(16).toString('hex')) => ({
  salt,
  hash: pbkdf2Sync(password, salt, 120_000, 64, 'sha512').toString('hex'),
});

const safeLower = (value) => String(value || '').trim().toLowerCase();

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const parseBody = async (request) => {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    throw httpError(400, 'Invalid JSON body');
  }
};

const sendJson = (response, status, payload) => {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
};

const readJson = (value, fallback) => {
  if (Array.isArray(value) || typeof value === 'object') return value;
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeValue = (column, value) => {
  if (JSON_COLUMNS.has(column)) {
    return JSON.stringify(value ?? []);
  }

  if (BOOLEAN_COLUMNS.has(column)) {
    return value ? 1 : 0;
  }

  return value ?? null;
};

const normalizeRow = (row) => {
  if (!row) return null;

  const normalized = { ...row };

  for (const column of JSON_COLUMNS) {
    if (column in normalized) {
      normalized[column] = readJson(normalized[column], []);
    }
  }

  for (const column of BOOLEAN_COLUMNS) {
    if (column in normalized) {
      normalized[column] = Boolean(normalized[column]);
    }
  }

  return normalized;
};

const pickColumns = (source, allowedColumns, { includeId = true } = {}) => {
  const picked = {};

  for (const column of allowedColumns) {
    if (!includeId && column === 'id') continue;
    if (column in source) {
      picked[column] = normalizeValue(column, source[column]);
    }
  }

  return picked;
};

const getById = (table, id) => {
  const row = database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  return normalizeRow(row);
};

const insertRow = (table, data, { generatedId = true } = {}) => {
  const allowedColumns = CRUD_TABLES[table];
  const payload = pickColumns(data, allowedColumns);

  if (generatedId && allowedColumns.includes('id') && !payload.id) {
    payload.id = randomUUID();
  }

  const columns = Object.keys(payload);
  if (columns.length === 0) {
    throw httpError(400, `No writable fields provided for ${table}`);
  }

  const placeholders = columns.map(() => '?').join(', ');
  database
    .prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
    .run(columns.map((column) => payload[column]));

  if (payload.id) {
    return getById(table, payload.id);
  }

  return normalizeRow(payload);
};

const updateRow = (table, id, data) => {
  const payload = pickColumns(data, CRUD_TABLES[table], { includeId: false });
  const columns = Object.keys(payload);

  if (columns.length === 0) {
    throw httpError(400, `No writable fields provided for ${table}`);
  }

  database
    .prepare(`UPDATE ${table} SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`)
    .run([...columns.map((column) => payload[column]), id]);

  return getById(table, id);
};

const deleteById = (table, id) => {
  database.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return { ok: true };
};

const getProfile = (userId) => normalizeRow(database.prepare('SELECT * FROM profiles WHERE id = ?').get(userId));
const getBook = (bookId) => normalizeRow(database.prepare('SELECT * FROM books WHERE id = ?').get(bookId));

const getChat = (chatId) => {
  const chat = getById('chats', chatId);
  if (!chat) return null;

  const participants = database
    .prepare(`
      SELECT profiles.*
      FROM chat_participants
      JOIN profiles ON profiles.id = chat_participants.user_id
      WHERE chat_participants.chat_id = ?
      ORDER BY chat_participants.joined_at ASC
    `)
    .all(chatId)
    .map(normalizeRow);

  const lastMessage = database
    .prepare('SELECT content FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(chatId);

  return {
    ...chat,
    last_message: lastMessage?.content || '',
    participants,
  };
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
};

const getCoverUrl = (coverId, title) => {
  if (coverId) {
    return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(title || 'Book')}&background=random&size=512`;
};

const mapOpenLibraryDoc = (doc) => {
  const firstSentence = toArray(doc.first_sentence)[0];
  const iaIds = toArray(doc.ia).filter(Boolean);

  return {
    id: doc.key || randomUUID(),
    title: doc.title || 'Без названия',
    author: toArray(doc.author_name).join(', ') || 'Автор не указан',
    coverUrl: getCoverUrl(doc.cover_i, doc.title),
    firstPublishYear: doc.first_publish_year,
    pageCount: doc.number_of_pages_median,
    editionCount: doc.edition_count,
    iaIds,
    hasReadableText: Boolean(doc.public_scan_b && iaIds.length > 0),
    description: firstSentence ? `Первое предложение: ${firstSentence}` : '',
  };
};

const encodeArchivePath = (fileName) => fileName.split('/').map(encodeURIComponent).join('/');

const findTextFile = (files = []) => {
  const readableFiles = files.filter((file) => typeof file.name === 'string');

  return (
    readableFiles.find((file) => file.format === 'DjVuTXT') ||
    readableFiles.find((file) => file.name.endsWith('_djvu.txt')) ||
    readableFiles.find((file) => file.name.endsWith('.txt') && !file.name.includes('_meta'))
  );
};

const register = database.transaction(({ email, password, name }) => {
  const normalizedEmail = safeLower(email);
  if (!normalizedEmail || !password || !name?.trim()) {
    throw httpError(400, 'Email, password and name are required');
  }

  const existing = database.prepare('SELECT id FROM auth_users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    throw httpError(409, 'User with this email already exists');
  }

  const id = randomUUID();
  const { salt, hash } = hashPassword(password);
  const displayName = name.trim();
  const createdAt = nowIso();

  database
    .prepare('INSERT INTO auth_users (id, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, normalizedEmail, hash, salt, createdAt);

  database
    .prepare(`
      INSERT INTO profiles (id, email, name, handle, avatar, joined_date, xp, level)
      VALUES (?, ?, ?, ?, ?, ?, 0, 1)
    `)
    .run(
      id,
      normalizedEmail,
      displayName,
      normalizedEmail.split('@')[0],
      `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`,
      new Date().toLocaleDateString('ru-RU'),
    );

  return getProfile(id);
});

const login = ({ email, password }) => {
  const normalizedEmail = safeLower(email);
  const authUser = database.prepare('SELECT * FROM auth_users WHERE email = ?').get(normalizedEmail);

  if (!authUser) {
    throw httpError(401, 'Invalid email or password');
  }

  const { hash } = hashPassword(password, authUser.password_salt);
  const expected = Buffer.from(authUser.password_hash, 'hex');
  const actual = Buffer.from(hash, 'hex');

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw httpError(401, 'Invalid email or password');
  }

  return getProfile(authUser.id);
};

const handleCrudRoute = async (request, url, parts) => {
  const table = parts[2];
  const id = parts[3];

  if (!CRUD_TABLES[table]) {
    throw httpError(404, 'Unknown table');
  }

  if (table === 'chat_participants') {
    if (request.method === 'GET') {
      const chatId = url.searchParams.get('chatId');
      const userId = url.searchParams.get('userId');
      if (chatId && userId) {
        return normalizeRow(
          database
            .prepare('SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?')
            .get(chatId, userId),
        );
      }

      return database.prepare('SELECT * FROM chat_participants ORDER BY joined_at DESC').all().map(normalizeRow);
    }

    if (request.method === 'POST') {
      return insertRow(table, await parseBody(request), { generatedId: false });
    }

    if (request.method === 'PATCH') {
      const chatId = url.searchParams.get('chatId');
      const userId = url.searchParams.get('userId');
      if (!chatId || !userId) throw httpError(400, 'chatId and userId are required');

      const body = await parseBody(request);
      const joinedAt = body.joined_at || body.joinedAt;
      if (!joinedAt) throw httpError(400, 'joined_at is required');

      database
        .prepare('UPDATE chat_participants SET joined_at = ? WHERE chat_id = ? AND user_id = ?')
        .run(joinedAt, chatId, userId);

      return normalizeRow(
        database
          .prepare('SELECT * FROM chat_participants WHERE chat_id = ? AND user_id = ?')
          .get(chatId, userId),
      );
    }

    if (request.method === 'DELETE') {
      const chatId = url.searchParams.get('chatId');
      const userId = url.searchParams.get('userId');
      if (!chatId || !userId) throw httpError(400, 'chatId and userId are required');
      database.prepare('DELETE FROM chat_participants WHERE chat_id = ? AND user_id = ?').run(chatId, userId);
      return { ok: true };
    }
  }

  if (request.method === 'GET' && !id) {
    const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500);
    return database.prepare(`SELECT * FROM ${table} LIMIT ?`).all(limit).map(normalizeRow);
  }

  if (request.method === 'POST' && !id) {
    return insertRow(table, await parseBody(request));
  }

  if (!PRIMARY_KEY_TABLES.has(table)) {
    throw httpError(400, `Table ${table} does not have a single id primary key`);
  }

  if (request.method === 'GET' && id) return getById(table, id);
  if (request.method === 'PATCH' && id) return updateRow(table, id, await parseBody(request));
  if (request.method === 'DELETE' && id) return deleteById(table, id);

  throw httpError(405, 'Method not allowed');
};

const route = async (request) => {
  const url = new URL(request.url, `http://${request.headers.host || `localhost:${PORT}`}`);
  const parts = url.pathname.split('/').filter(Boolean);

  if (parts[0] !== 'api') {
    throw httpError(404, 'Not found');
  }

  if (url.pathname === '/api/health') {
    return { ok: true, dbPath: DB_PATH };
  }

  if (url.pathname === '/api/open-library/search' && request.method === 'GET') {
    const query = String(url.searchParams.get('query') || '').trim();
    if (query.length < 2) return [];

    const fields = [
      'key',
      'title',
      'author_name',
      'cover_i',
      'first_publish_year',
      'edition_count',
      'ia',
      'public_scan_b',
      'ebook_access',
      'has_fulltext',
      'first_sentence',
      'number_of_pages_median',
    ].join(',');

    const searchUrl = new URL('https://openlibrary.org/search.json');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('fields', fields);
    searchUrl.searchParams.set('limit', '12');

    const openLibraryResponse = await fetch(searchUrl);
    if (!openLibraryResponse.ok) {
      throw httpError(502, 'Open Library search is unavailable');
    }

    const data = await openLibraryResponse.json();
    return (data.docs || []).map(mapOpenLibraryDoc);
  }

  if (url.pathname === '/api/open-library/text' && request.method === 'GET') {
    const iaId = String(url.searchParams.get('iaId') || '').trim();
    if (!iaId) throw httpError(400, 'iaId is required');

    const metadataResponse = await fetch(`https://archive.org/metadata/${encodeURIComponent(iaId)}`);
    if (!metadataResponse.ok) {
      throw httpError(502, 'Internet Archive metadata is unavailable');
    }

    const metadata = await metadataResponse.json();
    const textFile = findTextFile(metadata.files);

    if (!textFile) {
      throw httpError(404, 'Readable text file was not found for this archive item');
    }

    const textUrl = `https://archive.org/download/${encodeURIComponent(iaId)}/${encodeArchivePath(textFile.name)}`;
    const textResponse = await fetch(textUrl);

    if (!textResponse.ok) {
      throw httpError(502, 'Readable text file could not be downloaded');
    }

    const content = await textResponse.text();
    if (content.trim().length < 1000) {
      throw httpError(404, 'Downloaded text is too short to use as book content');
    }

    return {
      content,
      source: textUrl,
    };
  }

  if (url.pathname === '/api/auth/register' && request.method === 'POST') {
    const profile = register(await parseBody(request));
    return { userId: profile.id, profile };
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const profile = login(await parseBody(request));
    return { userId: profile.id, profile };
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    return { ok: true };
  }

  if (parts[1] === 'users' && parts[3] === 'data' && request.method === 'GET') {
    const userId = parts[2];
    const profile = getProfile(userId);
    if (!profile) throw httpError(404, 'User not found');

    return {
      profile,
      books: database.prepare('SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC').all(userId).map(normalizeRow),
      quotes: database.prepare('SELECT * FROM quotes WHERE user_id = ? ORDER BY created_at DESC').all(userId).map(normalizeRow),
    };
  }

  if (parts[1] === 'profiles' && parts[2] === 'search' && request.method === 'GET') {
    const email = safeLower(url.searchParams.get('email'));
    const found = database.prepare('SELECT id FROM profiles WHERE lower(email) = ?').get(email);
    return found ? getProfile(found.id) : null;
  }

  if (parts[1] === 'profiles' && parts[2] && request.method === 'PATCH') {
    return updateRow('profiles', parts[2], await parseBody(request));
  }

  if (url.pathname === '/api/xp' && request.method === 'POST') {
    const { userId, amount } = await parseBody(request);
    const profile = getProfile(userId);
    if (!profile) throw httpError(404, 'User not found');

    let xp = Number(profile.xp || 0) + Number(amount || 0);
    let level = Number(profile.level || 1);

    while (xp >= 1000) {
      level += 1;
      xp -= 1000;
    }

    database.prepare('UPDATE profiles SET xp = ?, level = ? WHERE id = ?').run(xp, level, userId);
    return getProfile(userId);
  }

  if (url.pathname === '/api/feed' && request.method === 'GET') {
    const limit = Math.min(Number(url.searchParams.get('limit') || 15), 100);
    return database
      .prepare('SELECT * FROM activities ORDER BY created_at DESC LIMIT ?')
      .all(limit)
      .map((activity) => ({
        ...normalizeRow(activity),
        profile: getProfile(activity.user_id),
        book: activity.book_id ? getBook(activity.book_id) : null,
      }));
  }

  if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
    const limit = Number(url.searchParams.get('limit') || 5);
    const rows = database
      .prepare(`
        SELECT profiles.*, COUNT(books.id) AS completed_count
        FROM profiles
        LEFT JOIN books ON books.user_id = profiles.id AND books.status = 'completed'
        GROUP BY profiles.id
        ORDER BY completed_count DESC, profiles.xp DESC
      `)
      .all()
      .map(normalizeRow);

    return limit === -1 ? rows : rows.slice(0, limit);
  }

  if (parts[1] === 'activities') {
    if (request.method === 'POST' && parts.length === 2) {
      return insertRow('activities', {
        ...(await parseBody(request)),
        liked_by: [],
        comments: [],
      });
    }

    if (parts[3] === 'toggle-like' && request.method === 'POST') {
      const activity = getById('activities', parts[2]);
      if (!activity) throw httpError(404, 'Activity not found');
      const { userId } = await parseBody(request);
      const likedBy = activity.liked_by.includes(userId)
        ? activity.liked_by.filter((id) => id !== userId)
        : [...activity.liked_by, userId];

      database.prepare('UPDATE activities SET liked_by = ? WHERE id = ?').run(JSON.stringify(likedBy), parts[2]);
      return getById('activities', parts[2]);
    }

    if (parts[3] === 'comments' && request.method === 'POST') {
      const activity = getById('activities', parts[2]);
      if (!activity) throw httpError(404, 'Activity not found');
      const { comment } = await parseBody(request);
      const comments = [...activity.comments, comment];
      database.prepare('UPDATE activities SET comments = ? WHERE id = ?').run(JSON.stringify(comments), parts[2]);
      return getById('activities', parts[2]);
    }

    if (parts[3] === 'comments' && parts[4] && request.method === 'DELETE') {
      const activity = getById('activities', parts[2]);
      if (!activity) throw httpError(404, 'Activity not found');
      const comments = activity.comments.filter((comment) => comment.id !== parts[4]);
      database.prepare('UPDATE activities SET comments = ? WHERE id = ?').run(JSON.stringify(comments), parts[2]);
      return getById('activities', parts[2]);
    }

    if (parts[2] && request.method === 'DELETE') {
      return deleteById('activities', parts[2]);
    }
  }

  if (parts[1] === 'books') {
    if (request.method === 'POST' && parts.length === 2) {
      return insertRow('books', await parseBody(request));
    }

    if (request.method === 'PATCH' && parts[2]) {
      return updateRow('books', parts[2], await parseBody(request));
    }

    if (request.method === 'DELETE' && parts[2]) {
      database.transaction((bookId) => {
        database.prepare('DELETE FROM quotes WHERE book_id = ?').run(bookId);
        database.prepare('DELETE FROM activities WHERE book_id = ?').run(bookId);
        database.prepare('DELETE FROM books WHERE id = ?').run(bookId);
      })(parts[2]);
      return { ok: true };
    }
  }

  if (url.pathname === '/api/quotes/upsert' && request.method === 'POST') {
    const body = await parseBody(request);
    const existing = body.id ? getById('quotes', body.id) : null;

    if (existing) {
      return updateRow('quotes', body.id, body);
    }

    return insertRow('quotes', body);
  }

  if (parts[1] === 'quotes' && parts[2] && request.method === 'DELETE') {
    return deleteById('quotes', parts[2]);
  }

  if (parts[1] === 'threads') {
    if (request.method === 'GET' && parts.length === 2) {
      return database
        .prepare(`
          SELECT threads.*, COUNT(thread_replies.id) AS replies_count
          FROM threads
          LEFT JOIN thread_replies ON thread_replies.thread_id = threads.id
          GROUP BY threads.id
          ORDER BY threads.created_at DESC
        `)
        .all()
        .map(normalizeRow);
    }

    if (request.method === 'POST' && parts.length === 2) {
      return insertRow('threads', await parseBody(request));
    }

    if (parts[3] === 'replies' && request.method === 'GET') {
      return database
        .prepare('SELECT * FROM thread_replies WHERE thread_id = ? ORDER BY created_at ASC')
        .all(parts[2])
        .map(normalizeRow);
    }

    if (parts[3] === 'replies' && request.method === 'POST') {
      return insertRow('thread_replies', {
        ...(await parseBody(request)),
        thread_id: parts[2],
      });
    }

    if (request.method === 'DELETE' && parts[2]) {
      database.transaction((threadId) => {
        database.prepare('DELETE FROM thread_replies WHERE thread_id = ?').run(threadId);
        database.prepare('DELETE FROM threads WHERE id = ?').run(threadId);
      })(parts[2]);
      return { ok: true };
    }
  }

  if (parts[1] === 'thread-replies' && parts[2] && request.method === 'DELETE') {
    return deleteById('thread_replies', parts[2]);
  }

  if (parts[1] === 'users' && parts[3] === 'chats' && request.method === 'GET') {
    const chatIds = database
      .prepare('SELECT chat_id FROM chat_participants WHERE user_id = ? ORDER BY joined_at DESC')
      .all(parts[2])
      .map((row) => row.chat_id);

    return chatIds.map(getChat).filter(Boolean);
  }

  if (parts[1] === 'chats') {
    if (request.method === 'POST' && parts.length === 2) {
      const { userIds } = await parseBody(request);
      if (!Array.isArray(userIds) || userIds.length < 2) {
        throw httpError(400, 'At least two user ids are required');
      }

      const chatId = randomUUID();
      database.transaction(() => {
        database.prepare('INSERT INTO chats (id) VALUES (?)').run(chatId);
        const insertParticipant = database.prepare(
          'INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)',
        );
        for (const userId of new Set(userIds)) {
          insertParticipant.run(chatId, userId);
        }
      })();

      return getChat(chatId);
    }

    if (parts[3] === 'messages' && request.method === 'GET') {
      return database
        .prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC')
        .all(parts[2])
        .map(normalizeRow);
    }

    if (parts[3] === 'messages' && request.method === 'POST') {
      const message = insertRow('messages', {
        ...(await parseBody(request)),
        chat_id: parts[2],
      });
      database.prepare('UPDATE chats SET updated_at = ? WHERE id = ?').run(nowIso(), parts[2]);
      return message;
    }

    if (parts[3] === 'participants' && parts[4] && request.method === 'DELETE') {
      database.prepare('DELETE FROM chat_participants WHERE chat_id = ? AND user_id = ?').run(parts[2], parts[4]);

      const remainingParticipants = database
        .prepare('SELECT COUNT(*) AS count FROM chat_participants WHERE chat_id = ?')
        .get(parts[2]).count;

      if (remainingParticipants === 0) {
        database.transaction((chatId) => {
          database.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
          database.prepare('DELETE FROM chats WHERE id = ?').run(chatId);
        })(parts[2]);
      }

      return { ok: true };
    }
  }

  if (parts[1] === 'crud') {
    return handleCrudRoute(request, url, parts);
  }

  throw httpError(404, 'Not found');
};

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  try {
    const payload = await route(request);
    sendJson(response, 200, payload ?? null);
  } catch (error) {
    const status = error.status || 500;
    sendJson(response, status, {
      error: error.message || 'Internal server error',
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`B.Nook local API is running at http://127.0.0.1:${PORT}/api`);
  console.log(`SQLite database: ${DB_PATH}`);
});
