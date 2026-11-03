-- Return only shelf metadata. security_invoker retains books/quotes RLS;
-- the explicit owner predicate also prevents a future public-books policy from
-- exposing another reader's shelf or note counts through this endpoint.
create view public.book_shelf with (security_invoker = true) as
select b.id, b.user_id, b.title, b.author, b.cover_url, b.progress, b.status,
  b.my_rating, b.is_lendable, b.current_page, b.reading_offset, b.total_pages,
  b.created_at, (coalesce(octet_length(b.content), 0) > 0) as has_content,
  (select count(*)::integer from public.quotes q
    where q.book_id = b.id and q.user_id = b.user_id) as annotation_count
from public.books b
where b.user_id = (select auth.uid());

revoke all on public.book_shelf from public, anon, authenticated;
grant select on public.book_shelf to authenticated;
