-- A text position survives changes to screen pages on rotation/font changes.
alter table public.books add column if not exists reading_offset integer check (reading_offset >= 0);
comment on column public.books.reading_offset is 'Text anchor for screen pagination; independent of font and viewport. NULL uses legacy current_page.';
