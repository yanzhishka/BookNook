-- No fixture survives this test, including authentication accounts.
begin;
do $test$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  book_id uuid;
  shelf jsonb;
begin
  insert into auth.users(id, email, raw_user_meta_data) values
    (owner_id, 'shelf-owner-' || owner_id || '@example.invalid', '{"name":"Shelf owner"}'),
    (other_id, 'shelf-other-' || other_id || '@example.invalid', '{"name":"Other reader"}');
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.books(user_id, title, content)
    values (owner_id, 'Private shelf test', 'PRIVATE BOOK TEXT') returning id into book_id;
  insert into public.quotes(user_id, book_id, text)
    values (owner_id, book_id, 'PRIVATE NOTE TEXT');
  select to_jsonb(b) into shelf from public.book_shelf b where id = book_id;
  if shelf is null or shelf->>'has_content' <> 'true' or shelf->>'annotation_count' <> '1'
    or shelf ? 'content' or shelf ? 'document' or shelf ? 'annotations'
    or shelf::text like '%PRIVATE%' then
    raise exception 'Shelf metadata is wrong or contains private payloads';
  end if;
  perform set_config('request.jwt.claim.sub', other_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', other_id, 'role', 'authenticated')::text, true);
  if exists(select 1 from public.book_shelf where id = book_id)
    or exists(select 1 from public.books where id = book_id)
    or exists(select 1 from public.quotes where user_id = owner_id) then
    raise exception 'Another reader can access private shelf, content or notes';
  end if;
  execute 'set local role anon';
  begin
    perform 1 from public.book_shelf;
    raise exception 'Guests can read the private shelf view';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end;
$test$;
rollback;
select 'PASS: shelf contains metadata only; content and notes remain private; all fixtures rolled back' as result;
