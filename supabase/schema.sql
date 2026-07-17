-- =====================================================================
-- B.Nook — canonical Supabase schema for a new project.
-- Existing projects should apply files from supabase/migrations instead.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  name            text,
  handle          text,
  avatar          text,
  banner_url      text,
  bio             text,
  location        text,
  joined_date     text,
  streak_days     integer not null default 0 check (streak_days >= 0),
  role            text not null default 'user' check (role in ('user', 'admin')),
  xp              integer not null default 0 check (xp >= 0),
  level           integer not null default 1 check (level >= 1),
  completed_count integer not null default 0 check (completed_count >= 0),
  terms_accepted_at timestamptz
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
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  book_id       uuid references public.books(id) on delete set null,
  type          text not null default 'review'
                  check (type in ('progress', 'review', 'note', 'finished')),
  content       text,
  "timestamp"   text,
  book_snapshot jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists public.activity_likes (
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create table if not exists public.activity_comments (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 2000),
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
  thread_id   uuid not null references public.threads(id) on delete cascade,
  content     text not null,
  image_url   text,
  author_id   uuid references public.profiles(id) on delete set null,
  author_name text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  content_type text not null
    check (content_type in ('post', 'comment', 'thread', 'reply', 'user')),
  content_id uuid,
  reason text not null
    check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'child_safety', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, content_type, content_id)
);

create index if not exists idx_books_user_id on public.books(user_id);
create index if not exists idx_books_status on public.books(status);
create index if not exists idx_quotes_user_id on public.quotes(user_id);
create index if not exists idx_quotes_book_id on public.quotes(book_id);
create index if not exists idx_activities_user_id on public.activities(user_id);
create index if not exists idx_activities_book_id on public.activities(book_id);
create index if not exists idx_activities_created on public.activities(created_at desc);
create index if not exists idx_activity_likes_user_id on public.activity_likes(user_id);
create index if not exists idx_activity_comments_activity_created
  on public.activity_comments(activity_id, created_at);
create index if not exists idx_activity_comments_user_id on public.activity_comments(user_id);
create index if not exists idx_threads_created on public.threads(created_at desc);
create index if not exists idx_threads_author_id on public.threads(author_id);
create index if not exists idx_replies_thread on public.thread_replies(thread_id, created_at);
create index if not exists idx_replies_author_id on public.thread_replies(author_id);
create index if not exists idx_user_blocks_blocked_id on public.user_blocks(blocked_id);
create index if not exists idx_content_reports_status_created
  on public.content_reports(status, created_at);
create index if not exists idx_content_reports_reported_user
  on public.content_reports(reported_user_id);

-- Internal trigger functions are intentionally outside the Data API schema.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, email, name, handle, avatar, joined_date, terms_accepted_at
  )
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    split_part(new.email, '@', 1),
    'https://ui-avatars.com/api/?name=' || split_part(new.email, '@', 1) || '&background=random',
    to_char(now(), 'YYYY-MM-DD'),
    case
      when new.raw_user_meta_data ->> 'terms_accepted_at' is not null
        then (new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.set_activity_book_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.book_id is null then
    new.book_snapshot := null;
    return new;
  end if;

  select jsonb_build_object(
    'id', book.id,
    'title', book.title,
    'author', book.author,
    'coverUrl', book.cover_url,
    'status', book.status
  )
  into new.book_snapshot
  from public.books as book
  where book.id = new.book_id and book.user_id = new.user_id;

  if new.book_snapshot is null then
    raise exception 'Book does not exist or does not belong to the activity author';
  end if;
  return new;
end;
$$;

drop trigger if exists activities_set_book_snapshot on public.activities;
create trigger activities_set_book_snapshot
  before insert or update of book_id on public.activities
  for each row execute function private.set_activity_book_snapshot();

create or replace function private.set_board_author_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select coalesce(nullif(profile.name, ''), 'User')
  into new.author_name
  from public.profiles as profile
  where profile.id = new.author_id;

  if new.author_name is null then
    raise exception 'Author profile does not exist';
  end if;
  return new;
end;
$$;

drop trigger if exists threads_set_author_name on public.threads;
create trigger threads_set_author_name
  before insert or update of author_id on public.threads
  for each row execute function private.set_board_author_name();

drop trigger if exists replies_set_author_name on public.thread_replies;
create trigger replies_set_author_name
  before insert or update of author_id on public.thread_replies
  for each row execute function private.set_board_author_name();

create or replace function private.refresh_completed_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_user_id uuid;
begin
  affected_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  update public.profiles as profile
  set completed_count = (
    select count(*)::integer from public.books as book
    where book.user_id = affected_user_id and book.status = 'completed'
  )
  where profile.id = affected_user_id;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    update public.profiles as profile
    set completed_count = (
      select count(*)::integer from public.books as book
      where book.user_id = old.user_id and book.status = 'completed'
    )
    where profile.id = old.user_id;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists books_refresh_completed_count on public.books;
create trigger books_refresh_completed_count
  after insert or update of status, user_id or delete on public.books
  for each row execute function private.refresh_completed_count();

create or replace function private.apply_xp(target_user_id uuid, amount integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set level = level + ((xp + amount) / 1000), xp = (xp + amount) % 1000
  where id = target_user_id and amount > 0;
$$;

create or replace function private.award_book_xp()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.apply_xp(new.user_id, 10);
  elsif old.status is distinct from new.status and new.status = 'completed' then
    perform private.apply_xp(new.user_id, 100);
  end if;
  return new;
end;
$$;

create or replace function private.award_activity_xp()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin perform private.apply_xp(new.user_id, 20); return new; end; $$;

create or replace function private.award_comment_xp()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin perform private.apply_xp(new.user_id, 5); return new; end; $$;

drop trigger if exists books_award_xp on public.books;
create trigger books_award_xp
  after insert or update of status on public.books
  for each row execute function private.award_book_xp();
drop trigger if exists activities_award_xp on public.activities;
create trigger activities_award_xp
  after insert on public.activities
  for each row execute function private.award_activity_xp();
drop trigger if exists comments_award_xp on public.activity_comments;
create trigger comments_award_xp
  after insert on public.activity_comments
  for each row execute function private.award_comment_xp();

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.quotes enable row level security;
alter table public.activities enable row level security;
alter table public.activity_likes enable row level security;
alter table public.activity_comments enable row level security;
alter table public.threads enable row level security;
alter table public.thread_replies enable row level security;
alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;

create policy profiles_select on public.profiles
  for select to anon, authenticated using (true);
create policy profiles_update on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy books_select on public.books
  for select to authenticated using ((select auth.uid()) = user_id);
create policy books_insert on public.books
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy books_update on public.books
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy books_delete on public.books
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy quotes_all on public.quotes
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy activities_select on public.activities
  for select to anon, authenticated using (true);
create policy activities_insert on public.activities
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy activities_delete on public.activities
  for delete to authenticated using (
    (select auth.uid()) = user_id or exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.role = 'admin'
    )
  );

create policy activity_likes_select on public.activity_likes
  for select to anon, authenticated using (true);
create policy activity_likes_insert on public.activity_likes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy activity_likes_delete on public.activity_likes
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy activity_comments_select on public.activity_comments
  for select to anon, authenticated using (true);
create policy activity_comments_insert on public.activity_comments
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy activity_comments_delete on public.activity_comments
  for delete to authenticated using (
    (select auth.uid()) = user_id or exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.role = 'admin'
    )
  );

create policy threads_select on public.threads
  for select to anon, authenticated using (true);
create policy threads_insert on public.threads
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy threads_delete on public.threads
  for delete to authenticated using (
    (select auth.uid()) = author_id or exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.role = 'admin'
    )
  );

create policy replies_select on public.thread_replies
  for select to anon, authenticated using (true);
create policy replies_insert on public.thread_replies
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy replies_delete on public.thread_replies
  for delete to authenticated using (
    (select auth.uid()) = author_id or exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.role = 'admin'
    )
  );

revoke all privileges on table
  public.profiles, public.books, public.quotes, public.activities,
  public.activity_likes, public.activity_comments, public.threads,
  public.thread_replies
from anon, authenticated;

grant select (
  id, name, handle, avatar, banner_url, bio, location, joined_date,
  streak_days, role, xp, level, completed_count
) on public.profiles to anon, authenticated;
grant update (name, handle, avatar, banner_url, bio, location)
  on public.profiles to authenticated;
grant select, insert, update, delete on public.books to authenticated;
grant select, insert, update, delete on public.quotes to authenticated;
grant select on public.activities to anon, authenticated;
grant insert, delete on public.activities to authenticated;
grant select on public.activity_likes to anon, authenticated;
grant insert, delete on public.activity_likes to authenticated;
grant select on public.activity_comments to anon, authenticated;
grant insert, delete on public.activity_comments to authenticated;
grant select on public.threads to anon, authenticated;
grant insert, delete on public.threads to authenticated;
grant select on public.thread_replies to anon, authenticated;
grant insert, delete on public.thread_replies to authenticated;

create policy user_blocks_select on public.user_blocks
  for select to authenticated using ((select auth.uid()) = blocker_id);
create policy user_blocks_insert on public.user_blocks
  for insert to authenticated
  with check ((select auth.uid()) = blocker_id and blocker_id <> blocked_id);
create policy user_blocks_delete on public.user_blocks
  for delete to authenticated using ((select auth.uid()) = blocker_id);

create policy content_reports_select on public.content_reports
  for select to authenticated using (
    (select auth.uid()) = reporter_id or exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.role = 'admin'
    )
  );
create policy content_reports_insert on public.content_reports
  for insert to authenticated with check (
    (select auth.uid()) = reporter_id
    and reporter_id is distinct from reported_user_id
  );

drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to anon, authenticated using (
    (select auth.uid()) is null or not exists (
      select 1 from public.user_blocks as block
      where block.blocker_id = (select auth.uid()) and block.blocked_id = profiles.id
    )
  );

drop policy activities_select on public.activities;
create policy activities_select on public.activities
  for select to anon, authenticated using (
    (select auth.uid()) is null or not exists (
      select 1 from public.user_blocks as block
      where block.blocker_id = (select auth.uid()) and block.blocked_id = activities.user_id
    )
  );

drop policy activity_comments_select on public.activity_comments;
create policy activity_comments_select on public.activity_comments
  for select to anon, authenticated using (
    (select auth.uid()) is null or not exists (
      select 1 from public.user_blocks as block
      where block.blocker_id = (select auth.uid()) and block.blocked_id = activity_comments.user_id
    )
  );

drop policy threads_select on public.threads;
create policy threads_select on public.threads
  for select to anon, authenticated using (
    (select auth.uid()) is null or not exists (
      select 1 from public.user_blocks as block
      where block.blocker_id = (select auth.uid()) and block.blocked_id = threads.author_id
    )
  );

drop policy replies_select on public.thread_replies;
create policy replies_select on public.thread_replies
  for select to anon, authenticated using (
    (select auth.uid()) is null or not exists (
      select 1 from public.user_blocks as block
      where block.blocker_id = (select auth.uid()) and block.blocked_id = thread_replies.author_id
    )
  );

drop policy activities_insert on public.activities;
create policy activities_insert on public.activities
  for insert to authenticated with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.terms_accepted_at is not null
    )
  );

drop policy activity_comments_insert on public.activity_comments;
create policy activity_comments_insert on public.activity_comments
  for insert to authenticated with check (
    (select auth.uid()) = user_id and exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.terms_accepted_at is not null
    )
  );

drop policy threads_insert on public.threads;
create policy threads_insert on public.threads
  for insert to authenticated with check (
    (select auth.uid()) = author_id and exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.terms_accepted_at is not null
    )
  );

drop policy replies_insert on public.thread_replies;
create policy replies_insert on public.thread_replies
  for insert to authenticated with check (
    (select auth.uid()) = author_id and exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.terms_accepted_at is not null
    )
  );

revoke all privileges on table public.user_blocks, public.content_reports
  from anon, authenticated;
grant select on public.user_blocks to anon, authenticated;
grant insert, delete on public.user_blocks to authenticated;
grant select, insert on public.content_reports to authenticated;
grant select (terms_accepted_at) on public.profiles to anon, authenticated;
grant update (terms_accepted_at) on public.profiles to authenticated;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

notify pgrst, 'reload schema';
