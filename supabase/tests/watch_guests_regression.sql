-- All guest fixtures, including Auth identities, are rolled back.
begin;
do $test$
declare
  owner_id uuid := gen_random_uuid(); member_id uuid := gen_random_uuid(); outsider_id uuid := gen_random_uuid();
  room_id uuid; data jsonb; changed integer;
begin
  insert into auth.users(id, is_anonymous, raw_user_meta_data) values
    (owner_id, true, '{"name":"Forged name","role":"admin","terms_accepted_at":"2026-01-01"}'),
    (member_id, true, '{}'), (outsider_id, true, '{}');
  if not exists(select 1 from public.profiles where id=owner_id and email is null
    and name like 'Гость %' and role='user' and terms_accepted_at is null) then
    raise exception 'Anonymous profile trusts user metadata or requires email';
  end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','is_anonymous',true)::text,true);
  execute 'set local role authenticated';
  data := public.create_watch_room('Guest screening','direct',null,'https://example.com/video.mp4');
  room_id := (data->'room'->>'id')::uuid;
  if room_id is null or data->'room'->>'owner_id' <> owner_id::text then raise exception 'Guest cannot own a room'; end if;
  if not exists(select 1 from public.watch_rooms where id=room_id) then raise exception 'Guest cannot restore room list'; end if;
  data := public.watch_player_command(room_id,0,'enqueue',p_provider=>'direct',p_media_url=>'https://example.com/next.mp4');
  if jsonb_array_length(data->'queue')<>1 then raise exception 'Guest owner cannot edit queue'; end if;
  begin
    insert into public.books(user_id,title) values(owner_id,'Forbidden');
    raise exception 'Guest can write to B.Nook library';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.threads(author_id,title,content) values(owner_id,'Forbidden','Forbidden');
    raise exception 'Guest can post in community';
  exception when insufficient_privilege then null; end;
  update public.profiles set terms_accepted_at=now() where id=owner_id;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Guest can unlock community through profile update'; end if;

  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider_id,'role','authenticated','is_anonymous',true)::text,true);
  if public.get_watch_room(room_id) is not null or exists(select 1 from public.watch_rooms where id=room_id) then
    raise exception 'Guest can see rooms without joining';
  end if;
  begin
    perform public.control_watch_room(room_id,1,'state',10,true);
    raise exception using errcode='XX000',message='Guest outsider controls room';
  exception when sqlstate 'P0001' then null; end;

  perform set_config('request.jwt.claim.sub',member_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated','is_anonymous',true)::text,true);
  data := public.join_watch_room(room_id);
  if jsonb_array_length(data->'members')<>2 then raise exception 'Guest invitation failed'; end if;
  data := public.control_watch_room(room_id,1,'state',12,true);
  if data->>'applied'<>'true' or data->'room'->>'playing'<>'true' then raise exception 'Guest cannot control playback'; end if;
  data := public.watch_player_command(room_id,2,'rate',p_rate=>1.5);
  if (data->'room'->>'playback_rate')::float8<>1.5 then raise exception 'Guest cannot change speed'; end if;
  begin
    perform public.control_watch_room(room_id,3,'close');
    raise exception using errcode='XX000',message='Guest member can close owner room';
  exception when sqlstate 'P0001' then null; end;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','is_anonymous',true)::text,true);
  data := public.control_watch_room(room_id,3,'close');
  if data->'room'->>'closed_at' is null then raise exception 'Guest owner cannot finish screening'; end if;
end;
$test$;
rollback;
select 'PASS: guest creation, invitations, playback, ownership and B.Nook write isolation; all fixtures rolled back' as result;
