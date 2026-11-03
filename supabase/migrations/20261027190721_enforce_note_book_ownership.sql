-- A quote may reference only a book belonging to its owner.
-- Keep standalone quotes supported, without opening access to another library.
drop policy if exists quotes_all on public.quotes;
create policy quotes_all on public.quotes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      book_id is null
      or exists (
        select 1 from public.books
        where books.id = quotes.book_id
          and books.user_id = (select auth.uid())
      )
    )
  );
