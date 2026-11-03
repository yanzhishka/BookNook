alter table public.watch_rooms add column playback_rate double precision not null default 1
  check (playback_rate in (0.25,0.5,0.75,1,1.25,1.5,1.75,2));

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

create or replace function public.get_watch_room(p_room_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select jsonb_build_object('room', to_jsonb(r), 'server_now', clock_timestamp(), 'members', coalesce((
    select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', left(p.name,80),
      'avatar', case when octet_length(p.avatar)<=16384 then p.avatar else null end, 'joined_at',m.joined_at) order by m.joined_at,m.user_id)
    from public.watch_room_members m join public.profiles p on p.id=m.user_id where m.room_id=r.id
  ),'[]'::jsonb), 'queue',coalesce((
    select jsonb_agg(to_jsonb(q) order by q.sort_order,q.id) from public.watch_queue_items q where q.room_id=r.id
  ),'[]'::jsonb)) from public.watch_rooms r where r.id=p_room_id;
$$;

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

-- Keep the original endpoint compatible with older clients.
create or replace function private.control_watch_room(p_room_id uuid, p_version bigint, p_action text,
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
