-- =====================================================================
-- B.Nook — схема для Supabase (Postgres)
-- Выполни этот файл целиком в Supabase: Dashboard > SQL Editor > New query.
-- Безопасно запускать повторно (idempotent).
-- =====================================================================

-- ---------- PROFILES (привязаны к auth.users) ----------
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
  role        text    not null default 'user',
  xp          integer not null default 0 check (xp >= 0),
  level       integer not null default 1 check (level >= 1)
);

-- ---------- BOOKS ----------
create table if not exists public.books (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  author       text,
  cover_url    text,
  progress     integer not null default 0 check (progress between 0 and 100),
  status       text    not null default 'want_to_read' check (status in ('reading','completed','want_to_read')),
  my_rating    integer not null default 0 check (my_rating between 0 and 5),
  is_lendable  boolean not null default false,
  content      text,
  current_page integer not null default 1 check (current_page >= 1),
  total_pages  integer not null default 1 check (total_pages >= 1),
  created_at   timestamptz not null default now()
);

-- ---------- QUOTES / ANNOTATIONS ----------
create table if not exists public.quotes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  book_id    uuid references public.books(id) on delete cascade,
  book_title text,
  text       text not null,
  color      text,
  "timestamp" bigint,
  comment    text,
  created_at timestamptz not null default now()
);

-- ---------- ACTIVITIES (лента) ----------
create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  book_id     uuid references public.books(id) on delete set null,
  type        text check (type is null or type in ('progress','review','note','finished')),
  content     text,
  "timestamp" text,
  liked_by    jsonb not null default '[]'::jsonb,
  comments    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- THREADS (The Grid) ----------
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

-- ---------- INDEXES ----------
create index if not exists idx_books_user_id        on public.books(user_id);
create index if not exists idx_books_status         on public.books(status);
create index if not exists idx_quotes_user_id       on public.quotes(user_id);
create index if not exists idx_quotes_book_id       on public.quotes(book_id);
create index if not exists idx_activities_user_id   on public.activities(user_id);
create index if not exists idx_activities_created   on public.activities(created_at desc);
create index if not exists idx_threads_created      on public.threads(created_at desc);
create index if not exists idx_replies_thread       on public.thread_replies(thread_id, created_at);

-- =====================================================================
-- Авто-создание профиля при регистрации пользователя
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, handle, avatar, joined_date)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    split_part(new.email, '@', 1),
    'https://ui-avatars.com/api/?name=' || split_part(new.email, '@', 1) || '&background=random',
    to_char(now(), 'YYYY-MM-DD')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- RLS (Row Level Security)
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.books          enable row level security;
alter table public.quotes         enable row level security;
alter table public.activities     enable row level security;
alter table public.threads        enable row level security;
alter table public.thread_replies enable row level security;

-- PROFILES: видят все (для ленты/лидерборда/тредов), меняет только владелец
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (auth.uid() = id);

-- BOOKS: читают все (нужно для карточек в ленте), пишет только владелец
drop policy if exists books_select on public.books;
create policy books_select on public.books for select using (true);
drop policy if exists books_insert on public.books;
create policy books_insert on public.books for insert with check (auth.uid() = user_id);
drop policy if exists books_update on public.books;
create policy books_update on public.books for update using (auth.uid() = user_id);
drop policy if exists books_delete on public.books;
create policy books_delete on public.books for delete using (auth.uid() = user_id);

-- QUOTES: только владелец
drop policy if exists quotes_all on public.quotes;
create policy quotes_all on public.quotes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ACTIVITIES: читают все; создаёт владелец; обновлять (лайки/комменты) может любой
-- авторизованный; удаляет только автор
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities for select using (true);
drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities for insert with check (auth.uid() = user_id);
drop policy if exists activities_update on public.activities;
create policy activities_update on public.activities for update using (auth.role() = 'authenticated');
drop policy if exists activities_delete on public.activities;
create policy activities_delete on public.activities for delete using (auth.uid() = user_id);

-- THREADS: читают все; создаёт авторизованный (как автор); удаляет автор
drop policy if exists threads_select on public.threads;
create policy threads_select on public.threads for select using (true);
drop policy if exists threads_insert on public.threads;
create policy threads_insert on public.threads for insert with check (auth.uid() = author_id);
drop policy if exists threads_delete on public.threads;
create policy threads_delete on public.threads for delete using (auth.uid() = author_id);

-- THREAD_REPLIES: читают все; создаёт авторизованный; удаляет автор
drop policy if exists replies_select on public.thread_replies;
create policy replies_select on public.thread_replies for select using (true);
drop policy if exists replies_insert on public.thread_replies;
create policy replies_insert on public.thread_replies for insert with check (auth.uid() = author_id);
drop policy if exists replies_delete on public.thread_replies;
create policy replies_delete on public.thread_replies for delete using (auth.uid() = author_id);

-- =====================================================================
-- XP helper (атомарное начисление опыта + уровень)
-- =====================================================================
create or replace function public.add_xp(amount integer)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  cur_xp    integer;
  cur_level integer;
  new_xp    integer;
  new_level integer;
begin
  select xp, level into cur_xp, cur_level from public.profiles where id = auth.uid();
  if cur_xp is null then return; end if;

  new_xp := cur_xp + amount;
  new_level := cur_level;
  if new_xp >= 1000 then
    new_level := new_level + (new_xp / 1000);
    new_xp := new_xp % 1000;
  end if;

  update public.profiles set xp = new_xp, level = new_level where id = auth.uid();
end;
$$;
