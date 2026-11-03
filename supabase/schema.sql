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
  document     jsonb check (document is null or (jsonb_typeof(document) = 'object'
                 and document->>'format' = 'epub' and document->>'version' = '1'
                 and jsonb_typeof(document->'blocks') = 'array')),
  current_page integer not null default 1 check (current_page >= 1),
  reading_offset integer check (reading_offset >= 0),
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
    if tg_op = 'UPDATE' then new.book_snapshot := old.book_snapshot;
    else new.book_snapshot := null;
    end if;
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
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      book_id is null
      or exists (
        select 1 from public.books
        where books.id = quotes.book_id
          and books.user_id = (select auth.uid())
      )
    )
  );

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
grant select on public.content_reports to authenticated;
grant insert (reporter_id, reported_user_id, content_type, content_id, reason, details)
  on public.content_reports to authenticated;
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

-- Unified The Grid community
-- The Grid reads existing forum topics and publications through one RLS-aware
-- view. Legacy clients and reader sharing keep working; no posts are deleted.
alter table public.threads
  add column kind text not null default 'discussion' check (kind in ('discussion','quote','review')),
  add column book_id uuid references public.books(id) on delete set null,
  add column book_snapshot jsonb;
create index idx_threads_kind_created on public.threads(kind, created_at desc);
create index idx_threads_book_id on public.threads(book_id) where book_id is not null;

create or replace function private.prepare_grid_topic()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.title := btrim(new.title);
  new.content := btrim(new.content);
  if char_length(new.title) not between 1 and 160 or char_length(new.content) not between 1 and 20000 then
    raise exception 'Название — до 160 символов, текст — до 20000 символов' using errcode = '23514';
  end if;
  if new.image_url is not null and (octet_length(new.image_url) > 3000000 or new.image_url !~ '^(https?://|data:image/(png|jpeg|webp|gif);base64,)') then
    raise exception 'Используйте изображение PNG, JPEG, WebP или GIF до 2 МБ' using errcode = '23514';
  end if;
  if new.book_id is null then
    -- Preserve a published title/author after its owner removes the private file.
    if tg_op = 'UPDATE' then new.book_snapshot := old.book_snapshot;
    else new.book_snapshot := null;
    end if;
  else
    select jsonb_build_object('title',b.title,'author',b.author,'coverUrl',b.cover_url)
    into new.book_snapshot from public.books b
    where b.id = new.book_id and b.user_id = new.author_id;
    if new.book_snapshot is null then
      raise exception 'Книга должна находиться в вашей библиотеке' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.prepare_grid_topic() from public, anon, authenticated;
create trigger threads_prepare_grid_topic before insert or update of book_id,book_snapshot,title,content,image_url
  on public.threads for each row execute function private.prepare_grid_topic();

create table public.thread_likes (
  thread_id uuid not null references public.threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(thread_id,user_id)
);
create index idx_thread_likes_user_id on public.thread_likes(user_id);
alter table public.thread_likes enable row level security;
create policy thread_likes_select on public.thread_likes for select to anon, authenticated
  using (exists(select 1 from public.threads t where t.id = thread_id));
create policy thread_likes_insert on public.thread_likes for insert to authenticated
  with check ((select auth.uid()) = user_id
    and exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.terms_accepted_at is not null)
    and exists(select 1 from public.threads t where t.id = thread_id));
create policy thread_likes_delete on public.thread_likes for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.thread_likes from anon, authenticated;
grant select on public.thread_likes to anon, authenticated;
grant insert,delete on public.thread_likes to authenticated;

create view public.community_topics with (security_invoker = true) as
select 'thread'::text as source, t.id,t.title,t.kind,t.content,t.image_url,
  t.author_id,coalesce(p.name,t.author_name) as author_name,p.avatar as author_avatar,
  t.book_snapshot,t.created_at,
  greatest(t.created_at,coalesce(r.latest,t.created_at)) as last_activity_at,
  r.total as replies_count,l.total as likes_count,
  exists(select 1 from public.thread_likes mine where mine.thread_id=t.id and mine.user_id=(select auth.uid())) as liked_by_me
from public.threads t
left join public.profiles p on p.id=t.author_id
cross join lateral (select count(*) as total,max(created_at) as latest from public.thread_replies where thread_id=t.id) r
cross join lateral (select count(*) as total from public.thread_likes where thread_id=t.id) l
union all
select 'post'::text,a.id,
  case when a.type='note' then 'Цитата' when a.type='review' then 'Отзыв'
       when a.type='finished' then 'Книга прочитана' else 'О чтении' end
    || case when nullif(a.book_snapshot->>'title','') is not null then ': '||(a.book_snapshot->>'title') else '' end,
  case when a.type='note' then 'quote' when a.type='review' then 'review' else 'discussion' end,
  coalesce(a.content,''),null::text,a.user_id,p.name,p.avatar,a.book_snapshot,a.created_at,
  greatest(a.created_at,coalesce(r.latest,a.created_at)),r.total,l.total,
  exists(select 1 from public.activity_likes mine where mine.activity_id=a.id and mine.user_id=(select auth.uid()))
from public.activities a
left join public.profiles p on p.id=a.user_id
cross join lateral (select count(*) as total,max(created_at) as latest from public.activity_comments where activity_id=a.id) r
cross join lateral (select count(*) as total from public.activity_likes where activity_id=a.id) l;
revoke all on public.community_topics from anon, authenticated;
grant select on public.community_topics to anon, authenticated;

create function public.search_community_topics(
  p_query text default '',p_kind text default 'all',p_scope text default 'all',
  p_sort text default 'new',p_limit integer default 21,p_offset integer default 0
) returns setof public.community_topics
language sql stable security invoker set search_path = '' as $$
  select c.* from public.community_topics c
  where (coalesce(p_kind,'all')='all' or c.kind=p_kind)
    and (coalesce(p_scope,'all')='all' or (p_scope='mine' and c.author_id=(select auth.uid())) or (p_scope='unanswered' and c.replies_count=0))
    and not exists (
      select 1 from regexp_split_to_table(lower(btrim(left(coalesce(p_query,''),200))),E'\\s+') as term
      where term<>'' and position(term in lower(concat_ws(' ',c.title,c.content,c.author_name,c.book_snapshot->>'title',c.book_snapshot->>'author')))=0
    )
  order by case when p_sort='popular' then c.replies_count end desc nulls last,
           case when p_sort='popular' then c.likes_count end desc nulls last,
           case when p_sort='active' then c.last_activity_at end desc nulls last,
           c.created_at desc,c.source,c.id
  limit least(51,greatest(1,coalesce(p_limit,21)))
  offset least(10000,greatest(0,coalesce(p_offset,0)));
$$;
revoke all on function public.search_community_topics(text,text,text,text,integer,integer) from public;
grant execute on function public.search_community_topics(text,text,text,text,integer,integer) to anon,authenticated;

-- Return only shelf metadata. security_invoker retains books/quotes RLS;
-- the explicit owner predicate also prevents a future public-books policy from
-- exposing another reader's shelf or note counts through this endpoint.
create view public.book_shelf with (security_invoker = true) as
select b.id, b.user_id, b.title, b.author, b.cover_url, b.progress, b.status,
  b.my_rating, b.is_lendable, b.current_page, b.reading_offset, b.total_pages,
  b.created_at, (coalesce(octet_length(b.content), 0) > 0) as has_content,
  (select count(*)::integer from public.quotes q
    where q.book_id = b.id and q.user_id = b.user_id) as annotation_count
from public.books b
where b.user_id = (select auth.uid());

revoke all on public.book_shelf from public, anon, authenticated;
grant select on public.book_shelf to authenticated;

-- W.Nook: private watch rooms and synchronized playback.
create table public.watch_rooms (
  playback_rate double precision not null default 1 check (playback_rate in (0.25,0.5,0.75,1,1.25,1.5,1.75,2)),
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  provider text not null check (provider in ('youtube', 'direct')),
  media_url text not null check (char_length(media_url) <= 2000),
  video_id text,
  position_seconds double precision not null default 0 check (position_seconds >= 0 and position_seconds <= 172800),
  playing boolean not null default false,
  playback_at timestamptz not null default now(),
  version bigint not null default 0,
  members_version bigint not null default 1,
  last_client_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((provider = 'youtube' and video_id is not null and video_id ~ '^[A-Za-z0-9_-]{11}$') or (provider = 'direct' and video_id is null))
);
create index watch_rooms_owner_id_idx on public.watch_rooms(owner_id);
create table public.watch_room_members (
  room_id uuid not null references public.watch_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index watch_room_members_user_id_idx on public.watch_room_members(user_id);
alter table public.watch_rooms enable row level security;
alter table public.watch_room_members enable row level security;

-- A private definer avoids recursive membership RLS. It returns only a boolean
-- for the current auth.uid(), never an arbitrary caller-supplied user ID.
create function private.is_watch_member(p_room_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.watch_room_members where room_id = p_room_id and user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_watch_member(uuid) from public, anon, authenticated;
grant execute on function private.is_watch_member(uuid) to authenticated;
create policy watch_rooms_member_read on public.watch_rooms for select to authenticated using (private.is_watch_member(id));
create policy watch_members_member_read on public.watch_room_members for select to authenticated using (private.is_watch_member(room_id));
revoke all on public.watch_rooms, public.watch_room_members from public, anon, authenticated;
grant select on public.watch_rooms, public.watch_room_members to authenticated;

create function private.watch_source(p_provider text, p_video_id text, p_media_url text) returns jsonb
language plpgsql set search_path = '' as $$
begin
  if p_provider = 'youtube' and p_video_id ~ '^[A-Za-z0-9_-]{11}$' then
    return jsonb_build_object('provider', 'youtube', 'video_id', p_video_id, 'media_url', 'https://www.youtube.com/watch?v=' || p_video_id);
  elsif p_provider = 'direct' and char_length(p_media_url) <= 2000
    and p_media_url ~* '^https://[a-z0-9][a-z0-9.-]*(:[0-9]+)?/[^[:space:]#@]*[.](mp4|webm)([?][^[:space:]#]*)?$' then
    return jsonb_build_object('provider', 'direct', 'video_id', null, 'media_url', p_media_url);
  end if;
  raise exception 'Пока поддерживаются YouTube и прямые HTTPS-ссылки на MP4 / WebM.';
end;
$$;
revoke all on function private.watch_source(text, text, text) from public, anon, authenticated;

create table public.watch_queue_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.watch_rooms(id) on delete cascade,
  sort_order bigint not null,
  title text not null check (char_length(title) between 1 and 120),
  provider text not null check (provider in ('youtube','direct')),
  media_url text not null check (char_length(media_url) <= 2000),
  video_id text,
  check ((provider='youtube' and video_id is not null and video_id ~ '^[A-Za-z0-9_-]{11}$') or (provider='direct' and video_id is null))
);
create index watch_queue_room_order_idx on public.watch_queue_items(room_id,sort_order,id);
alter table public.watch_queue_items enable row level security;
create policy watch_queue_member_read on public.watch_queue_items for select to authenticated using (private.is_watch_member(room_id));
revoke all on public.watch_queue_items from public,anon,authenticated;
grant select on public.watch_queue_items to authenticated;

create function public.get_watch_room(p_room_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object('room', to_jsonb(r), 'server_now', clock_timestamp(), 'members', coalesce((
    select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', left(p.name,80),
      'avatar', case when octet_length(p.avatar)<=16384 then p.avatar else null end, 'joined_at',m.joined_at) order by m.joined_at,m.user_id)
    from public.watch_room_members m join public.profiles p on p.id=m.user_id where m.room_id=r.id
  ),'[]'::jsonb), 'queue',coalesce((
    select jsonb_agg(to_jsonb(q) order by q.sort_order,q.id) from public.watch_queue_items q where q.room_id=r.id
  ),'[]'::jsonb)) from public.watch_rooms r where r.id=p_room_id;
$$;

create function private.create_watch_room(p_title text, p_provider text, p_video_id text, p_media_url text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  source jsonb;
  room_id uuid;
  room_title text := coalesce(nullif(btrim(p_title), ''), 'Комната для своих');
begin
  if actor is null then raise exception 'Войдите, чтобы создать комнату.'; end if;
  if char_length(room_title) > 80 then raise exception 'Название комнаты должно быть короче 80 символов.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  if (select count(*) from public.watch_rooms where owner_id = actor and closed_at is null) >= 6 then
    raise exception 'Сначала завершите одну из открытых комнат.';
  end if;
  source := private.watch_source(p_provider, p_video_id, p_media_url);
  insert into public.watch_rooms(owner_id, title, provider, video_id, media_url)
    values (actor, room_title, source->>'provider', source->>'video_id', source->>'media_url') returning id into room_id;
  insert into public.watch_room_members(room_id, user_id) values (room_id, actor);
  return public.get_watch_room(room_id);
end;
$$;

create function private.join_watch_room(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.watch_rooms; changed integer;
begin
  if actor is null then raise exception 'Войдите, чтобы присоединиться.'; end if;
  select * into target from public.watch_rooms where id = p_room_id for update;
  if not found then raise exception 'Комната не найдена. Проверьте приглашение.'; end if;
  if target.closed_at is not null then raise exception 'Этот просмотр уже завершён.'; end if;
  if not exists(select 1 from public.watch_room_members where room_id = p_room_id and user_id = actor)
    and (select count(*) from public.watch_room_members where room_id = p_room_id) >= 20 then
    raise exception 'В комнате уже 20 участников.';
  end if;
  insert into public.watch_room_members(room_id, user_id) values (p_room_id, actor) on conflict do nothing;
  get diagnostics changed = row_count;
  if changed > 0 then update public.watch_rooms set members_version = members_version + 1, updated_at = now() where id = p_room_id; end if;
  return public.get_watch_room(p_room_id);
end;
$$;

create function private.control_watch_room(p_room_id uuid, p_version bigint, p_action text,
  p_position double precision default null, p_playing boolean default null,
  p_provider text default null, p_video_id text default null, p_media_url text default null, p_client_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); target public.watch_rooms; source jsonb;
begin
  if actor is null or not private.is_watch_member(p_room_id) then raise exception 'Нет доступа к этой комнате.'; end if;
  select * into target from public.watch_rooms where id = p_room_id for update;
  if not found then raise exception 'Комната недоступна.'; end if;
  if p_action in ('source', 'close') and target.owner_id <> actor then raise exception 'Это действие доступно создателю комнаты.'; end if;
  if target.closed_at is not null then
    if p_action = 'close' then return public.get_watch_room(p_room_id) || '{"applied":true}'::jsonb; end if;
    raise exception 'Этот просмотр уже завершён.';
  end if;
  if p_action = 'state' then
    if p_position is null or p_position < 0 or p_position > 172800 or p_playing is null then raise exception 'Некорректная позиция видео.'; end if;
    if p_version is distinct from target.version then return public.get_watch_room(p_room_id) || '{"applied":false}'::jsonb; end if;
    update public.watch_rooms set position_seconds = p_position, playing = p_playing, playback_at = clock_timestamp(),
      version = version + 1, updated_at = now(), last_client_id = p_client_id where id = p_room_id;
  elsif p_action = 'source' then
    source := private.watch_source(p_provider, p_video_id, p_media_url);
    update public.watch_rooms set provider = source->>'provider', video_id = source->>'video_id', media_url = source->>'media_url',
      position_seconds = 0, playback_rate = 1, playing = false, playback_at = clock_timestamp(), version = version + 1, updated_at = now(), last_client_id = p_client_id where id = p_room_id;
  elsif p_action = 'close' then
    update public.watch_rooms set position_seconds = least(172800, position_seconds + case when playing then greatest(0, extract(epoch from clock_timestamp() - playback_at)) * playback_rate else 0 end),
      playing = false, closed_at = now(), version = version + 1, updated_at = now(), last_client_id = p_client_id where id = p_room_id;
  else raise exception 'Неизвестное действие.';
  end if;
  return public.get_watch_room(p_room_id) || '{"applied":true}'::jsonb;
end;
$$;

revoke all on function public.get_watch_room(uuid), private.create_watch_room(text,text,text,text),
  private.join_watch_room(uuid), private.control_watch_room(uuid,bigint,text,double precision,boolean,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.get_watch_room(uuid), private.create_watch_room(text,text,text,text),
  private.join_watch_room(uuid), private.control_watch_room(uuid,bigint,text,double precision,boolean,text,text,text,uuid) to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
    and not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'watch_rooms') then
    alter publication supabase_realtime add table public.watch_rooms;
  end if;
end; $$;


-- SQL-standard bodies bind the private function OIDs at definition time.
-- Clients receive EXECUTE on these narrow invoker endpoints, not schema USAGE.
create function public.create_watch_room(p_title text, p_provider text, p_video_id text, p_media_url text)
returns jsonb language sql security invoker set search_path = ''
return private.create_watch_room(p_title, p_provider, p_video_id, p_media_url);

create function public.join_watch_room(p_room_id uuid)
returns jsonb language sql security invoker set search_path = ''
return private.join_watch_room(p_room_id);

create function public.control_watch_room(p_room_id uuid, p_version bigint, p_action text,
  p_position double precision default null, p_playing boolean default null,
  p_provider text default null, p_video_id text default null, p_media_url text default null, p_client_id uuid default null)
returns jsonb language sql security invoker set search_path = ''
return private.control_watch_room(p_room_id,p_version,p_action,p_position,p_playing,p_provider,p_video_id,p_media_url,p_client_id);

revoke all on function public.create_watch_room(text,text,text,text), public.join_watch_room(uuid),
  public.control_watch_room(uuid,bigint,text,double precision,boolean,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.create_watch_room(text,text,text,text), public.join_watch_room(uuid),
  public.control_watch_room(uuid,bigint,text,double precision,boolean,text,text,text,uuid) to authenticated;

create function private.watch_player_command(p_room_id uuid,p_version bigint,p_action text,
  p_rate double precision default null,p_item_id uuid default null,p_direction integer default null,
  p_title text default null,p_provider text default null,p_video_id text default null,p_media_url text default null,
  p_position double precision default null,p_playing boolean default null,p_client_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); target public.watch_rooms; item public.watch_queue_items;
  neighbor public.watch_queue_items; source jsonb; stamp timestamptz := clock_timestamp();
begin
  if actor is null or not private.is_watch_member(p_room_id) then raise exception 'Нет доступа к этой комнате.'; end if;
  select * into target from public.watch_rooms where id=p_room_id for update;
  if not found or target.closed_at is not null then raise exception 'Просмотр недоступен или завершён.'; end if;
  if p_action is null or p_action not in ('rate','enqueue','remove','move','next') then raise exception 'Неизвестное действие.'; end if;
  if p_action in ('enqueue','remove','move') and target.owner_id<>actor then raise exception 'Очередью управляет создатель комнаты.'; end if;
  if p_version is distinct from target.version then return public.get_watch_room(p_room_id)||'{"applied":false}'::jsonb; end if;
  stamp := clock_timestamp();
  if p_action='rate' then
    if p_rate is null or p_rate not in (0.25,0.5,0.75,1,1.25,1.5,1.75,2) then raise exception 'Некорректная скорость видео.'; end if;
    update public.watch_rooms set position_seconds=least(172800,position_seconds+case when playing then greatest(0,extract(epoch from stamp-playback_at))*playback_rate else 0 end),
      playback_at=stamp,playback_rate=p_rate where id=p_room_id;
  elsif p_action='enqueue' then
    if (select count(*) from public.watch_queue_items where room_id=p_room_id)>=50 then raise exception 'В очереди уже 50 видео.'; end if;
    if char_length(coalesce(p_title,''))>120 then raise exception 'Название видео должно быть короче 120 символов.'; end if;
    source := private.watch_source(p_provider,p_video_id,p_media_url);
    insert into public.watch_queue_items(room_id,sort_order,title,provider,video_id,media_url)
      values(p_room_id,(select coalesce(max(sort_order),0)+1 from public.watch_queue_items where room_id=p_room_id),
        coalesce(nullif(btrim(p_title),''),'Видео'),source->>'provider',source->>'video_id',source->>'media_url');
  elsif p_action in ('remove','move') then
    select * into item from public.watch_queue_items where id=p_item_id and room_id=p_room_id;
    if not found then raise exception 'Видео уже удалено из очереди.'; end if;
    if p_action='remove' then delete from public.watch_queue_items where id=item.id;
    else
      if p_direction is null or p_direction not in (-1,1) then raise exception 'Некорректный порядок очереди.'; end if;
      select * into neighbor from public.watch_queue_items where room_id=p_room_id
        and (case when p_direction=-1 then sort_order<item.sort_order else sort_order>item.sort_order end)
        order by case when p_direction=-1 then -sort_order else sort_order end,id limit 1;
      if found then update public.watch_queue_items set sort_order=case when id=item.id then neighbor.sort_order else item.sort_order end where id in (item.id,neighbor.id); end if;
    end if;
  elsif p_action='next' then
    if p_position is not null and not (p_position between 0 and 172800) then raise exception 'Некорректная позиция видео.'; end if;
    select * into item from public.watch_queue_items where room_id=p_room_id and (p_item_id is null or id=p_item_id) order by sort_order,id limit 1;
    if found then
      update public.watch_rooms set provider=item.provider,media_url=item.media_url,video_id=item.video_id,
        position_seconds=0,playback_at=stamp,playback_rate=1,playing=coalesce(p_playing,target.playing) where id=p_room_id;
      delete from public.watch_queue_items where id=item.id;
    elsif p_item_id is not null then raise exception 'Видео уже удалено из очереди.';
    else
      update public.watch_rooms set position_seconds=coalesce(p_position,least(172800,position_seconds+case when playing then greatest(0,extract(epoch from stamp-playback_at))*playback_rate else 0 end)),
        playing=false,playback_at=stamp where id=p_room_id;
    end if;
  end if;
  update public.watch_rooms set version=version+1,updated_at=now(),last_client_id=p_client_id where id=p_room_id;
  return public.get_watch_room(p_room_id)||'{"applied":true}'::jsonb;
end;
$$;
create function public.watch_player_command(p_room_id uuid,p_version bigint,p_action text,
  p_rate double precision default null,p_item_id uuid default null,p_direction integer default null,
  p_title text default null,p_provider text default null,p_video_id text default null,p_media_url text default null,
  p_position double precision default null,p_playing boolean default null,p_client_id uuid default null)
returns jsonb language sql security invoker set search_path = ''
return private.watch_player_command(p_room_id,p_version,p_action,p_rate,p_item_id,p_direction,p_title,p_provider,p_video_id,p_media_url,p_position,p_playing,p_client_id);
revoke all on function private.watch_player_command(uuid,bigint,text,double precision,uuid,integer,text,text,text,text,double precision,boolean,uuid),
  public.watch_player_command(uuid,bigint,text,double precision,uuid,integer,text,text,text,text,double precision,boolean,uuid) from public,anon,authenticated;
grant execute on function private.watch_player_command(uuid,bigint,text,double precision,uuid,integer,text,text,text,text,double precision,boolean,uuid),
  public.watch_player_command(uuid,bigint,text,double precision,uuid,integer,text,text,text,text,double precision,boolean,uuid) to authenticated;

-- Guest W.Nook sessions.
-- Anonymous W.Nook identities have no email and do not accept community terms.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_anonymous is true then
    insert into public.profiles(id, email, name, handle, avatar, joined_date, terms_accepted_at)
    values(new.id, null, 'Гость ' || upper(left(new.id::text, 4)),
      'guest_' || replace(new.id::text, '-', ''), '', to_char(now(), 'YYYY-MM-DD'), null)
    on conflict(id) do nothing;
  else
    insert into public.profiles(id, email, name, handle, avatar, joined_date, terms_accepted_at)
    values(new.id, lower(new.email),
      coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
      split_part(new.email, '@', 1),
      'https://ui-avatars.com/api/?name=' || split_part(new.email, '@', 1) || '&background=random',
      to_char(now(), 'YYYY-MM-DD'),
      case when new.raw_user_meta_data->>'terms_accepted_at' is not null
        then (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz else null end)
    on conflict(id) do nothing;
  end if;
  return new;
end;
$$;

-- Anonymous JWTs use the authenticated role. Keep their writes within W.Nook,
-- even if a caller bypasses the interface and sends requests directly.
do $$
declare target text; operation text;
begin
  foreach target in array array['books','quotes','activities','activity_comments',
    'activity_likes','threads','thread_replies','thread_likes','user_blocks','content_reports'] loop
    foreach operation in array array['insert','update','delete'] loop
      execute format('create policy %I on public.%I as restrictive for %s to authenticated %s',
        'permanent_accounts_' || operation, target, operation,
        case operation
          when 'insert' then 'with check (not coalesce(((select auth.jwt())->>''is_anonymous'')::boolean, false))'
          when 'delete' then 'using (not coalesce(((select auth.jwt())->>''is_anonymous'')::boolean, false))'
          else 'using (not coalesce(((select auth.jwt())->>''is_anonymous'')::boolean, false)) with check (not coalesce(((select auth.jwt())->>''is_anonymous'')::boolean, false))'
        end);
    end loop;
  end loop;
end;
$$;

create policy permanent_accounts_update on public.profiles as restrictive
for update to authenticated
using (not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false))
with check (not coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false));
