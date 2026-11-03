-- Keep EPUB structure alongside searchable text; existing books remain readable.
alter table public.books add column if not exists document jsonb;
alter table public.books add constraint books_document_format_check check (
  document is null or (
    jsonb_typeof(document) = 'object'
    and document->>'format' = 'epub'
    and document->>'version' = '1'
    and jsonb_typeof(document->'blocks') = 'array'
  )
);
comment on column public.books.document is 'Sanitized reflowable EPUB document, version 1. Owner RLS applies.';
