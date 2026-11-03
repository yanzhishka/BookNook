alter function public.create_watch_room(text,text,text,text) set schema private;
alter function public.join_watch_room(uuid) set schema private;
alter function public.control_watch_room(uuid,bigint,text,double precision,boolean,text,text,text,uuid) set schema private;

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
