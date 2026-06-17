drop policy if exists "Characters are viewable by room participants" on public.characters;

notify pgrst, 'reload schema';
