-- Phase 7: publish append-only activity records. Keep existing grants and RLS.
-- This is safe to rerun; it does not modify any household's records.
do $$
begin
  if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='activity_logs') then
    alter publication supabase_realtime add table public.activity_logs;
  end if;
end; $$;
