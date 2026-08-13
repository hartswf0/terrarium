-- TERRARIUM III provisional artifact hardening

revoke all on table public.iii_artifacts from anon;
revoke all on table public.iii_artifacts from authenticated;
grant select, insert on table public.iii_artifacts to authenticated;

drop policy if exists iii_artifacts_select_own on public.iii_artifacts;
create policy iii_artifacts_select_own
  on public.iii_artifacts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists iii_artifacts_insert_own on public.iii_artifacts;
create policy iii_artifacts_insert_own
  on public.iii_artifacts for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- Automatic-RLS event trigger hardening used by the current demo project.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
