alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

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

create index if not exists idx_user_blocks_blocked_id
  on public.user_blocks(blocked_id);
create index if not exists idx_content_reports_status_created
  on public.content_reports(status, created_at);
create index if not exists idx_content_reports_reported_user
  on public.content_reports(reported_user_id);

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

alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;

create policy user_blocks_select on public.user_blocks
  for select to authenticated
  using ((select auth.uid()) = blocker_id);
create policy user_blocks_insert on public.user_blocks
  for insert to authenticated
  with check ((select auth.uid()) = blocker_id and blocker_id <> blocked_id);
create policy user_blocks_delete on public.user_blocks
  for delete to authenticated
  using ((select auth.uid()) = blocker_id);

create policy content_reports_select on public.content_reports
  for select to authenticated
  using (
    (select auth.uid()) = reporter_id
    or exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.role = 'admin'
    )
  );
create policy content_reports_insert on public.content_reports
  for insert to authenticated
  with check (
    (select auth.uid()) = reporter_id
    and reporter_id is distinct from reported_user_id
  );

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to anon, authenticated
  using (
    (select auth.uid()) is null
    or not exists (
      select 1 from public.user_blocks as block
      where block.blocker_id = (select auth.uid())
        and block.blocked_id = profiles.id
    )
  );

drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities
  for select to anon, authenticated
  using (
    (select auth.uid()) is null
    or not exists (
      select 1 from public.user_blocks as block
      where block.blocker_id = (select auth.uid())
        and block.blocked_id = activities.user_id
    )
  );

drop policy if exists activity_comments_select on public.activity_comments;
create policy activity_comments_select on public.activity_comments
  for select to anon, authenticated
  using (
    (select auth.uid()) is null
    or not exists (
      select 1 from public.user_blocks as block
      where block.blocker_id = (select auth.uid())
        and block.blocked_id = activity_comments.user_id
    )
  );

drop policy if exists threads_select on public.threads;
create policy threads_select on public.threads
  for select to anon, authenticated
  using (
    (select auth.uid()) is null
    or not exists (
      select 1 from public.user_blocks as block
      where block.blocker_id = (select auth.uid())
        and block.blocked_id = threads.author_id
    )
  );

drop policy if exists replies_select on public.thread_replies;
create policy replies_select on public.thread_replies
  for select to anon, authenticated
  using (
    (select auth.uid()) is null
    or not exists (
      select 1 from public.user_blocks as block
      where block.blocker_id = (select auth.uid())
        and block.blocked_id = thread_replies.author_id
    )
  );

drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.terms_accepted_at is not null
    )
  );

drop policy if exists activity_comments_insert on public.activity_comments;
create policy activity_comments_insert on public.activity_comments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.terms_accepted_at is not null
    )
  );

drop policy if exists threads_insert on public.threads;
create policy threads_insert on public.threads
  for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.terms_accepted_at is not null
    )
  );

drop policy if exists replies_insert on public.thread_replies;
create policy replies_insert on public.thread_replies
  for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (
      select 1 from public.profiles as profile
      where profile.id = (select auth.uid()) and profile.terms_accepted_at is not null
    )
  );

revoke all privileges on table public.user_blocks, public.content_reports
  from anon, authenticated;
grant select on public.user_blocks to anon, authenticated;
grant insert, delete on public.user_blocks to authenticated;
grant select, insert on public.content_reports to authenticated;
grant update (terms_accepted_at) on public.profiles to authenticated;

notify pgrst, 'reload schema';
