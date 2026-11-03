-- Run after the migrations as the database owner. All fixtures are rolled back.
begin;

do $test$
declare
  test_author uuid := gen_random_uuid();
  test_target uuid := gen_random_uuid();
  test_book uuid;
  test_activity uuid;
  original_snapshot jsonb;
  retained_snapshot jsonb;
  retained_book uuid;
  report_id uuid;
  report_status text;
  report_created_at timestamptz;
begin
  insert into auth.users(id, email, raw_user_meta_data)
  values
    (test_author, 'rollback-author-' || test_author || '@example.invalid',
      jsonb_build_object('name', 'Rollback author', 'terms_accepted_at', now()::text)),
    (test_target, 'rollback-target-' || test_target || '@example.invalid',
      jsonb_build_object('name', 'Rollback target'));

  perform set_config('request.jwt.claim.sub', test_author::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', test_author, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.books(user_id, title, author, content)
    values (test_author, 'Published attribution', 'Book author', 'PRIVATE FILE CONTENT')
    returning id into test_book;
  insert into public.activities(user_id, book_id, type, content, book_snapshot)
    values (test_author, test_book, 'note', 'Public selected excerpt',
      '{"title":"Forged title","content":"PRIVATE FILE CONTENT"}'::jsonb)
    returning id, book_snapshot into test_activity, original_snapshot;

  if original_snapshot->>'title' is distinct from 'Published attribution'
    or original_snapshot ? 'content' then
    raise exception 'Activity INSERT trusted a client-supplied snapshot';
  end if;

  delete from public.books where id = test_book;
  select book_id, book_snapshot into retained_book, retained_snapshot
    from public.activities where id = test_activity;
  if not found or retained_book is not null
    or retained_snapshot is distinct from original_snapshot then
    raise exception 'Deleting a private book erased its public attribution';
  end if;

  insert into public.content_reports(reporter_id, reported_user_id, content_type, content_id, reason, details)
    values (test_author, test_target, 'user', test_target, 'other', 'Rollback regression')
    returning id, status, created_at into report_id, report_status, report_created_at;
  if report_id is null or report_status is distinct from 'pending'
    or report_created_at is distinct from now() then
    raise exception 'Report server defaults were not applied';
  end if;

  begin
    insert into public.content_reports(reporter_id, reported_user_id, content_type, content_id, reason, status)
      values (test_author, test_target, 'user', gen_random_uuid(), 'other', 'resolved');
    raise exception 'Authenticated clients can assign a moderation status';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.content_reports(reporter_id, reported_user_id, content_type, content_id, reason, created_at)
      values (test_author, test_target, 'user', gen_random_uuid(), 'other', now() - interval '1 year');
    raise exception 'Authenticated clients can assign a report creation time';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.content_reports(id, reporter_id, reported_user_id, content_type, content_id, reason)
      values (gen_random_uuid(), test_author, test_target, 'user', gen_random_uuid(), 'other');
    raise exception 'Authenticated clients can assign a report ID';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
end;
$test$;

rollback;
select 'Activity attribution and report defaults passed; all fixtures rolled back' as result;
