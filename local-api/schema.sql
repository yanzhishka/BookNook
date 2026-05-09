PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT NOT NULL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(id) > 0),
  CHECK (length(email) > 0)
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT NOT NULL,
  email TEXT,
  name TEXT,
  handle TEXT,
  avatar TEXT,
  banner_url TEXT,
  bio TEXT,
  location TEXT,
  joined_date TEXT,
  streak_days INTEGER NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
  role TEXT NOT NULL DEFAULT 'user',
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  cover_url TEXT,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status TEXT NOT NULL DEFAULT 'want_to_read' CHECK (status IN ('reading', 'completed', 'want_to_read')),
  my_rating INTEGER NOT NULL DEFAULT 0 CHECK (my_rating >= 0 AND my_rating <= 5),
  is_lendable INTEGER NOT NULL DEFAULT 0 CHECK (is_lendable IN (0, 1)),
  content TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  current_page INTEGER NOT NULL DEFAULT 1 CHECK (current_page >= 1),
  total_pages INTEGER NOT NULL DEFAULT 1 CHECK (total_pages >= 1),
  CONSTRAINT books_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT,
  type TEXT CHECK (type IS NULL OR type IN ('progress', 'review', 'note', 'finished')),
  content TEXT,
  timestamp TEXT,
  liked_by TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(liked_by)),
  comments TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(comments)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT activities_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id),
  CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT chats_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS chat_participants (
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT chat_participants_pkey PRIMARY KEY (chat_id, user_id),
  CONSTRAINT chat_participants_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES chats(id),
  CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT NOT NULL PRIMARY KEY,
  chat_id TEXT NOT NULL,
  sender_id TEXT,
  content TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_by TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(deleted_by)),
  CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES chats(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_id TEXT,
  book_title TEXT,
  text TEXT NOT NULL,
  color TEXT,
  timestamp INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  comment TEXT,
  CONSTRAINT quotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id),
  CONSTRAINT quotes_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE IF NOT EXISTS threads (
  id TEXT NOT NULL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  author_id TEXT,
  author_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT threads_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS thread_replies (
  id TEXT NOT NULL,
  thread_id TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  author_id TEXT,
  author_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT thread_replies_pkey PRIMARY KEY (id),
  CONSTRAINT thread_replies_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES threads(id),
  CONSTRAINT thread_replies_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_book_id ON activities(book_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created_at ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_book_id ON quotes(book_id);
CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_author_id ON threads(author_id);
CREATE INDEX IF NOT EXISTS idx_thread_replies_thread_id_created_at ON thread_replies(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_thread_replies_author_id ON thread_replies(author_id);
