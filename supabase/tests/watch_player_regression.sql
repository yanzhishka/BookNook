begin;
do $test$
declare
  owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); outsider_id uuid:=gen_random_uuid();
  room_id uuid; a uuid; b uuid; data jsonb; v bigint; before_position double precision;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,'player-owner-'||owner_id||'@example.invalid','{"name":"Owner"}'),
    (member_id,'player-member-'||member_id||'@example.invalid','{"name":"Member"}'),
    (outsider_id,'player-outsider-'||outsider_id||'@example.invalid','{"name":"Outsider"}');
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  execute 'set local role authenticated';
  data:=public.create_watch_room('Player test','direct',null,'https://example.com/first.mp4');
  room_id:=(data->'room'->>'id')::uuid;
  if (data->'room'->>'playback_rate')::float8<>1 or jsonb_array_length(data->'queue')<>0 then raise exception 'Initial player state failed'; end if;
  data:=public.watch_player_command(room_id,0,'enqueue',p_provider=>'direct',p_media_url=>'https://example.com/second.mp4',p_title=>'Second');
  a:=(data->'queue'->0->>'id')::uuid;
  data:=public.watch_player_command(room_id,1,'enqueue',p_provider=>'youtube',p_video_id=>'M7lc1UVf-VE',p_title=>'Third');
  b:=(data->'queue'->1->>'id')::uuid;
  data:=public.watch_player_command(room_id,2,'move',p_item_id=>b,p_direction=>-1);
  if data->'queue'->0->>'id'<>b::text then raise exception 'Queue reordering failed'; end if;
  begin
    insert into public.watch_queue_items(room_id,sort_order,title,provider,media_url) values(room_id,99,'Forged','direct','https://example.com/a.mp4');
    raise exception 'Queue allows direct client writes';
  exception when insufficient_privilege then null; end;
  begin
    perform public.watch_player_command(room_id,3,'enqueue',p_provider=>'direct',p_media_url=>'javascript:alert(1)');
    raise exception using errcode='XX000',message='Unsafe queue source accepted';
  exception when sqlstate 'P0001' then null; end;

  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  if public.get_watch_room(room_id) is not null or exists(select 1 from public.watch_queue_items) then raise exception 'Queue leaked to outsider'; end if;
  begin
    perform public.watch_player_command(room_id,3,'next');
    raise exception using errcode='XX000',message='Outsider can advance queue';
  exception when sqlstate 'P0001' then null; end;

  perform set_config('request.jwt.claim.sub',member_id::text,true);
  data:=public.join_watch_room(room_id);
  begin
    perform public.watch_player_command(room_id,3,'remove',p_item_id=>a);
    raise exception using errcode='XX000',message='Member can edit owner queue';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.watch_player_command(room_id,3,'rate',p_rate=>'NaN'::float8);
    raise exception using errcode='XX000',message='NaN rate accepted';
  exception when sqlstate 'P0001' then null; end;
  data:=public.watch_player_command(room_id,3,'rate',p_rate=>2);
  if (data->'room'->>'playback_rate')::float8<>2 then raise exception 'Shared rate failed'; end if;
  data:=public.watch_player_command(room_id,3,'rate',p_rate=>0.5);
  if data->>'applied'<>'false' or (data->'room'->>'playback_rate')::float8<>2 then raise exception 'Stale rate overwrote state'; end if;
  data:=public.control_watch_room(room_id,4,'state',10,true);
  execute 'reset role';
  update public.watch_rooms set playback_at=clock_timestamp()-interval '5 seconds' where id=room_id;
  execute 'set local role authenticated';
  data:=public.watch_player_command(room_id,5,'rate',p_rate=>0.5);
  before_position:=(data->'room'->>'position_seconds')::float8;
  if before_position<20 or before_position>23 then raise exception 'Changing rate did not preserve elapsed position: %',before_position; end if;
  data:=public.control_watch_room(room_id,6,'state',40,false);
  data:=public.watch_player_command(room_id,7,'next',p_playing=>true);
  if data->'room'->>'video_id'<>'M7lc1UVf-VE' or jsonb_array_length(data->'queue')<>1 or (data->'room'->>'playback_rate')::float8<>1 then raise exception 'Queue advance/reset failed'; end if;
  data:=public.watch_player_command(room_id,7,'next',p_playing=>true);
  if data->>'applied'<>'false' or jsonb_array_length(data->'queue')<>1 then raise exception 'Duplicate end skipped another item'; end if;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  data:=public.watch_player_command(room_id,8,'remove',p_item_id=>a);
  data:=public.watch_player_command(room_id,9,'next',p_position=>100,p_playing=>true);
  if data->'room'->>'playing'<>'false' or (data->'room'->>'position_seconds')::float8<>100 then raise exception 'End of queue did not pause'; end if;
  data:=public.watch_player_command(room_id,10,'rate',p_rate=>2);
  data:=public.control_watch_room(room_id,11,'state',20,true);
  execute 'reset role';
  update public.watch_rooms set playback_at=clock_timestamp()-interval '5 seconds' where id=room_id;
  execute 'set local role authenticated';
  data:=public.control_watch_room(room_id,12,'close');
  if (data->'room'->>'position_seconds')::float8<30 then raise exception 'Close ignored playback rate'; end if;
  v:=(data->'room'->>'version')::bigint;
  begin
    perform public.watch_player_command(room_id,v,'enqueue',p_provider=>'direct',p_media_url=>'https://example.com/a.mp4');
    raise exception using errcode='XX000',message='Closed room accepts queue edits';
  exception when sqlstate 'P0001' then null; end;
  execute 'set local role anon';
  begin
    perform public.watch_player_command(room_id,v,'next');
    raise exception 'Anonymous player commands allowed';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end;
$test$;
rollback;
select 'PASS: shared rate, preserved clock, queue privacy/order, owner edits, member playback, duplicate ends, safe input and closure; fixtures rolled back' as result;
