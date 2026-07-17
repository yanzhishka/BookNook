grant select (terms_accepted_at) on public.profiles to anon, authenticated;

notify pgrst, 'reload schema';
