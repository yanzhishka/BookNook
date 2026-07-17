delete from public.thread_replies where thread_id is null;
alter table public.thread_replies alter column thread_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('user', 'admin'));
  end if;
end;
$$;

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
    'https://ui-avatars.com/api/?name=' || split_part(new.email, '@', 1) || '&background=random',
    to_char(now(), 'YYYY-MM-DD')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

notify pgrst, 'reload schema';
