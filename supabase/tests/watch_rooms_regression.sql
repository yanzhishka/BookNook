begin;
do $test$
declare
  owner_id uuid := gen_random_uuid(); member_id uuid := gen_random_uuid(); outsider_id uuid := gen_random_uuid();
  room_id uuid; data jsonb;
begin
  insert into auth.users(id, email, raw_user_meta_data) values
    (owner_id, 'watch-owner-' || owner_id || '@example.invalid', '{"name":"Watch owner"}'),
    (member_id, 'watch-member-' || member_id || '@example.invalid', '{"name":"Watch member"}'),
    (outsider_id, 'watch-outsider-' || outsider_id || '@example.invalid', '{"name":"Watch outsider"}');
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',owner_id,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  data := public.create_watch_room('Private screening', 'direct', null, 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4');
  room_id := (data->'room'->>'id')::uuid;
  if room_id is null or data->'room'->>'owner_id' <> owner_id::text or jsonb_array_length(data->'members') <> 1 then
    raise exception 'Room creation or owner membership failed';
  end if;
  begin
    insert into public.watch_rooms(owner_id,title,provider,media_url) values(member_id,'Forged','direct','https://example.com/test.mp4');
    raise exception 'Client can bypass room RPC';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_watch_room('Bad source','direct',null,'javascript:alert(1)');
    raise exception using errcode='XX000', message='Unsafe media source accepted';
  exception when sqlstate 'P0001' then null; end;

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',outsider_id,'role','authenticated')::text, true);
  if public.get_watch_room(room_id) is not null or exists(select 1 from public.watch_rooms where id=room_id) then
    raise exception 'Uninvited reader can read private room';
  end if;
  begin
    perform public.control_watch_room(room_id,0,'state',10,true);
    raise exception using errcode='XX000', message='Outsider can control room';
  exception when sqlstate 'P0001' then null; end;

  perform set_config('request.jwt.claim.sub', member_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',member_id,'role','authenticated')::text, true);
  data := public.join_watch_room(room_id);
  if jsonb_array_length(data->'members') <> 2 then raise exception 'Invitation join failed'; end if;
  data := public.join_watch_room(room_id);
  if jsonb_array_length(data->'members') <> 2 or data->'room'->>'members_version' <> '2' then raise exception 'Duplicate join is not idempotent'; end if;
  data := public.control_watch_room(room_id,0,'state',42,true);
  if data->>'applied' <> 'true' or data->'room'->>'version' <> '1' or data->'room'->>'playing' <> 'true' then raise exception 'Playback update failed'; end if;
  data := public.control_watch_room(room_id,0,'state',99,false);
  if data->>'applied' <> 'false' or (data->'room'->>'position_seconds')::float8 <> 42 then raise exception 'Stale client overwrote current state'; end if;
  begin
    perform public.control_watch_room(room_id,1,'source',null,null,'youtube','M7lc1UVf-VE',null);
    raise exception using errcode='XX000', message='Member can change owner source';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.control_watch_room(room_id,1,'close');
    raise exception using errcode='XX000', message='Member can close owner room';
  exception when sqlstate 'P0001' then null; end;
  data := public.control_watch_room(room_id,1,'state',43,false);
  if data->'room'->>'version' <> '2' or data->'room'->>'playing' <> 'false' then raise exception 'Shared pause failed'; end if;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',owner_id,'role','authenticated')::text, true);
  data := public.control_watch_room(room_id,2,'source',null,null,'youtube','M7lc1UVf-VE','https://example.invalid/untrusted');
  if data->'room'->>'media_url' <> 'https://www.youtube.com/watch?v=M7lc1UVf-VE' or (data->'room'->>'position_seconds')::float8 <> 0 then raise exception 'Source did not normalize/reset'; end if;
  data := public.control_watch_room(room_id,3,'close');
  if data->'room'->>'closed_at' is null or data->'room'->>'playing' <> 'false' then raise exception 'Closing did not stop room'; end if;
  begin
    perform public.join_watch_room(room_id);
    raise exception using errcode='XX000', message='Closed room accepts joins';
  exception when sqlstate 'P0001' then null; end;
  execute 'set local role anon';
  begin
    perform public.get_watch_room(room_id);
    raise exception 'Guest can read private room RPC';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end;
$test$;
rollback;
select 'PASS: private rooms, invitations, shared controls, stale versions, owner permissions, safe sources and closure; all fixtures rolled back' as result;
