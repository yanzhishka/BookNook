-- Harden the existing BookNook schema and normalize social interactions.
-- This migration is safe for existing installations: legacy JSON likes and
-- comments are copied into relational tables before the old columns are removed.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.profiles
  add column if not exists completed_count integer not null default 0
  check (completed_count >= 0);

alter table public.activities
  add column if not exists book_snapshot jsonb;

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

-- Preserve data created by the original JSONB implementation.
insert into public.activity_likes (activity_id, user_id)
select activity_id, user_id
from (
  select
    activity.id as activity_id,
    case
      when legacy.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then legacy.user_id::uuid
      else null
    end as user_id
  from public.activities as activity
  cross join lateral jsonb_array_elements_text(coalesce(activity.liked_by, '[]'::jsonb))
    as legacy(user_id)
) as migrated
join public.profiles as profile on profile.id = migrated.user_id
where migrated.user_id is not null
on conflict do nothing;

insert into public.activity_comments (activity_id, user_id, content)
select migrated.activity_id, migrated.user_id, migrated.content
from (
  select
    activity.id as activity_id,
    case
      when legacy.comment ->> 'userId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (legacy.comment ->> 'userId')::uuid
      else null
    end as user_id,
    left(nullif(btrim(legacy.comment ->> 'text'), ''), 2000) as content
  from public.activities as activity
  cross join lateral jsonb_array_elements(coalesce(activity.comments, '[]'::jsonb))
    as legacy(comment)
) as migrated
join public.profiles as profile on profile.id = migrated.user_id
where migrated.user_id is not null and migrated.content is not null;

update public.activities as activity
set book_snapshot = jsonb_build_object(
  'id', book.id,
  'title', book.title,
  'author', book.author,
  'coverUrl', book.cover_url,
  'status', book.status
)
from public.books as book
where activity.book_id = book.id;

update public.profiles as profile
set completed_count = (
  select count(*)::integer
  from public.books as book
  where book.user_id = profile.id and book.status = 'completed'
);

alter table public.activities
  drop column if exists liked_by,
  drop column if exists comments,
  alter column type set default 'review';

update public.activities set type = 'review' where type is null;
alter table public.activities alter column type set not null;

create index if not exists idx_activities_book_id on public.activities(book_id);
create index if not exists idx_threads_author_id on public.threads(author_id);
create index if not exists idx_replies_author_id on public.thread_replies(author_id);
create index if not exists idx_activity_likes_user_id on public.activity_likes(user_id);
create index if not exists idx_activity_comments_activity_created
  on public.activity_comments(activity_id, created_at);
create index if not exists idx_activity_comments_user_id on public.activity_comments(user_id);

-- Internal trigger functions live outside the exposed Data API schema.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.add_xp(integer);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, handle, avatar, joined_date)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    split_part(new.email, '@', 1),
    'https://ui-avatars.com/api/?name=' ||
      pg_catalog.encode(pg_catalog.convert_to(split_part(new.email, '@', 1), 'UTF8'), 'escape') ||
      '&background=random',
    to_char(now(), 'YYYY-MM-DD')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

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
    select count(*)::integer
    from public.books as book
    where book.user_id = affected_user_id and book.status = 'completed'
  )
  where profile.id = affected_user_id;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    update public.profiles as profile
    set completed_count = (
      select count(*)::integer
      from public.books as book
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
  set
    level = level + ((xp + amount) / 1000),
    xp = (xp + amount) % 1000
  where id = target_user_id and amount > 0;
$$;

create or replace function private.award_book_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
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
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.apply_xp(new.user_id, 20);
  return new;
end;
$$;

create or replace function private.award_comment_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.apply_xp(new.user_id, 5);
  return new;
end;
$$;

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

-- RLS policies are role-scoped and use init-plan-safe auth lookups.
alter table public.activity_likes enable row level security;
alter table public.activity_comments enable row level security;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles
  for select to anon, authenticated using (true);
create policy profiles_update on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists books_select on public.books;
drop policy if exists books_insert on public.books;
drop policy if exists books_update on public.books;
drop policy if exists books_delete on public.books;
create policy books_select on public.books
  for select to authenticated using ((select auth.uid()) = user_id);
create policy books_insert on public.books
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy books_update on public.books
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy books_delete on public.books
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists quotes_all on public.quotes;
create policy quotes_all on public.quotes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists activities_select on public.activities;
drop policy if exists activities_insert on public.activities;
drop policy if exists activities_update on public.activities;
drop policy if exists activities_delete on public.activities;
create policy activities_select on public.activities
  for select to anon, authenticated using (true);
create policy activities_insert on public.activities
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy activities_delete on public.activities
  for delete to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.role = 'admin'
    )
  );

drop policy if exists activity_likes_select on public.activity_likes;
drop policy if exists activity_likes_insert on public.activity_likes;
drop policy if exists activity_likes_delete on public.activity_likes;
create policy activity_likes_select on public.activity_likes
  for select to anon, authenticated using (true);
create policy activity_likes_insert on public.activity_likes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy activity_likes_delete on public.activity_likes
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists activity_comments_select on public.activity_comments;
drop policy if exists activity_comments_insert on public.activity_comments;
drop policy if exists activity_comments_delete on public.activity_comments;
create policy activity_comments_select on public.activity_comments
  for select to anon, authenticated using (true);
create policy activity_comments_insert on public.activity_comments
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy activity_comments_delete on public.activity_comments
  for delete to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.role = 'admin'
    )
  );

drop policy if exists threads_select on public.threads;
drop policy if exists threads_insert on public.threads;
drop policy if exists threads_delete on public.threads;
create policy threads_select on public.threads
  for select to anon, authenticated using (true);
create policy threads_insert on public.threads
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy threads_delete on public.threads
  for delete to authenticated
  using (
    (select auth.uid()) = author_id
    or exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.role = 'admin'
    )
  );

drop policy if exists replies_select on public.thread_replies;
drop policy if exists replies_insert on public.thread_replies;
drop policy if exists replies_delete on public.thread_replies;
create policy replies_select on public.thread_replies
  for select to anon, authenticated using (true);
create policy replies_insert on public.thread_replies
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy replies_delete on public.thread_replies
  for delete to authenticated
  using (
    (select auth.uid()) = author_id
    or exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.role = 'admin'
    )
  );

-- Replace Supabase's broad legacy defaults with least-privilege grants.
revoke all privileges on table
  public.profiles,
  public.books,
  public.quotes,
  public.activities,
  public.activity_likes,
  public.activity_comments,
  public.threads,
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

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

notify pgrst, 'reload schema';
