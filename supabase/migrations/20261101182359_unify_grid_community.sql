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
