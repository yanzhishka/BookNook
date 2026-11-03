-- Removing a private book must not erase the public attribution of its quotes.
-- INSERT still derives the snapshot from an owned book, ignoring client data.
create or replace function private.set_activity_book_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.book_id is null then
    if tg_op = 'UPDATE' then new.book_snapshot := old.book_snapshot;
    else new.book_snapshot := null;
    end if;
    return new;
  end if;

  select jsonb_build_object(
    'id', book.id,
    'title', book.title,
    'author', book.author,
    'coverUrl', book.cover_url,
    'status', book.status
  )
  into new.book_snapshot
  from public.books as book
  where book.id = new.book_id and book.user_id = new.user_id;

  if new.book_snapshot is null then
    raise exception 'Book does not exist or does not belong to the activity author';
  end if;
  return new;
end;
$$;

-- Report IDs, moderation status and creation time are assigned by the server.
-- The client only supplies the fields used by db.reportContent().
revoke insert on public.content_reports from authenticated;
grant insert (reporter_id, reported_user_id, content_type, content_id, reason, details)
  on public.content_reports to authenticated;
