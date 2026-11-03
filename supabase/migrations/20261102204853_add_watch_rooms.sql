create table public.watch_rooms (
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

create function public.get_watch_room(p_room_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object('room', to_jsonb(r), 'server_now', clock_timestamp(), 'members', coalesce((
    select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', left(p.name, 80), 'avatar', case when octet_length(p.avatar) <= 16384 then p.avatar else null end, 'joined_at', m.joined_at) order by m.joined_at, m.user_id)
    from public.watch_room_members m join public.profiles p on p.id = m.user_id where m.room_id = r.id
  ), '[]'::jsonb)) from public.watch_rooms r where r.id = p_room_id;
$$;

create function public.create_watch_room(p_title text, p_provider text, p_video_id text, p_media_url text) returns jsonb
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

create function public.join_watch_room(p_room_id uuid) returns jsonb
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

create function public.control_watch_room(p_room_id uuid, p_version bigint, p_action text,
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
      position_seconds = 0, playing = false, playback_at = clock_timestamp(), version = version + 1, updated_at = now(), last_client_id = p_client_id where id = p_room_id;
  elsif p_action = 'close' then
    update public.watch_rooms set position_seconds = least(172800, position_seconds + case when playing then greatest(0, extract(epoch from clock_timestamp() - playback_at)) else 0 end),
      playing = false, closed_at = now(), version = version + 1, updated_at = now(), last_client_id = p_client_id where id = p_room_id;
  else raise exception 'Неизвестное действие.';
  end if;
  return public.get_watch_room(p_room_id) || '{"applied":true}'::jsonb;
end;
$$;

revoke all on function public.get_watch_room(uuid), public.create_watch_room(text,text,text,text),
  public.join_watch_room(uuid), public.control_watch_room(uuid,bigint,text,double precision,boolean,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.get_watch_room(uuid), public.create_watch_room(text,text,text,text),
  public.join_watch_room(uuid), public.control_watch_room(uuid,bigint,text,double precision,boolean,text,text,text,uuid) to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
    and not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'watch_rooms') then
    alter publication supabase_realtime add table public.watch_rooms;
  end if;
end; $$;
