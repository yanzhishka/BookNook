# Local B.Nook API

This folder replaces Supabase with a local SQLite database and a small Node API.

## Run

```bash
npm run dev:local
```

The API starts at `http://127.0.0.1:8787/api`.
The React app uses `VITE_LOCAL_API_URL` when it is provided, otherwise it falls back to that URL.

## Database

`schema.sql` is an executable SQLite version of the original Supabase schema.
The Supabase `auth.users` relation is represented locally by `auth_users`, and JSON/array columns are stored as checked JSON text.

## Generic CRUD From React

The app-specific methods still live in `services/db.ts`, but there is also a generic local CRUD helper:

```ts
await db.crud.list('books');
await db.crud.get('threads', threadId);
await db.crud.create('quotes', {
  user_id: userId,
  book_id: bookId,
  book_title: 'Book title',
  text: 'Quote text',
});
await db.crud.update('profiles', userId, { bio: 'Updated bio' });
await db.crud.remove('thread_replies', replyId);

await db.crud.create('chat_participants', { chat_id: chatId, user_id: userId });
await db.crud.getChatParticipant(chatId, userId);
await db.crud.updateChatParticipant(chatId, userId, { joined_at: new Date().toISOString() });
await db.crud.removeChatParticipant(chatId, userId);
```

Supported tables:

`activities`, `books`, `chat_participants`, `chats`, `messages`, `profiles`, `quotes`, `threads`, `thread_replies`.

## Open Library Integration

The add-book flow uses these local proxy endpoints:

```bash
GET /api/open-library/search?query=pride%20and%20prejudice
GET /api/open-library/text?iaId=bwb_KS-179-237
```

The server searches Open Library, maps book metadata into app-friendly fields, then tries to download a readable `.txt` file from Internet Archive when a public scan is available.
