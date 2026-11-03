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
