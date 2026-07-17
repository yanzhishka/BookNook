-- Baseline matching the original manually-provisioned BookNook database.
-- Later migrations normalize and harden this schema.

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  handle      text,
  avatar      text,
  banner_url  text,
  bio         text,
  location    text,
  joined_date text,
  streak_days integer not null default 0 check (streak_days >= 0),
  role        text not null default 'user',
  xp          integer not null default 0 check (xp >= 0),
  level       integer not null default 1 check (level >= 1)
);

create table if not exists public.books (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  author       text,
  cover_url    text,
  progress     integer not null default 0 check (progress between 0 and 100),
  status       text not null default 'want_to_read'
                 check (status in ('reading', 'completed', 'want_to_read')),
  my_rating    integer not null default 0 check (my_rating between 0 and 5),
  is_lendable  boolean not null default false,
  content      text,
  current_page integer not null default 1 check (current_page >= 1),
  total_pages  integer not null default 1 check (total_pages >= 1),
  created_at   timestamptz not null default now()
);

create table if not exists public.quotes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  book_id     uuid references public.books(id) on delete cascade,
  book_title  text,
  text        text not null,
  color       text,
  "timestamp" bigint,
  comment     text,
  created_at  timestamptz not null default now()
);

create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  book_id     uuid references public.books(id) on delete set null,
  type        text check (type is null or type in ('progress', 'review', 'note', 'finished')),
  content     text,
  "timestamp" text,
  liked_by    jsonb not null default '[]'::jsonb,
  comments    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.threads (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  content     text not null,
  image_url   text,
  author_id   uuid references public.profiles(id) on delete set null,
  author_name text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.thread_replies (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid references public.threads(id) on delete cascade,
  content     text not null,
  image_url   text,
  author_id   uuid references public.profiles(id) on delete set null,
  author_name text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_books_user_id on public.books(user_id);
create index if not exists idx_books_status on public.books(status);
create index if not exists idx_quotes_user_id on public.quotes(user_id);
create index if not exists idx_quotes_book_id on public.quotes(book_id);
create index if not exists idx_activities_user_id on public.activities(user_id);
create index if not exists idx_activities_created on public.activities(created_at desc);
create index if not exists idx_threads_created on public.threads(created_at desc);
create index if not exists idx_replies_thread
  on public.thread_replies(thread_id, created_at);

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.quotes enable row level security;
alter table public.activities enable row level security;
alter table public.threads enable row level security;
alter table public.thread_replies enable row level security;
