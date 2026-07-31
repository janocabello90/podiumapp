-- Restringir a admin: escritura de catálogos de config (tests/sports/sport_tests/consent_versions)
-- y visibilidad de otros usuarios. Los fisios solo se ven a sí mismos y no pueden gestionar config.
-- La LECTURA de catálogos se mantiene para toda la clínica (las sesiones la necesitan).

-- Helper: ¿el usuario actual es admin de su clínica? (SECURITY DEFINER evita recursión de RLS)
create or replace function public.is_clinic_admin()
returns boolean
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_clinic_admin() from public;
grant execute on function public.is_clinic_admin() to authenticated;

-- ===== Catálogos de config: LECTURA = cualquier usuario de la clínica; ESCRITURA = solo admin =====

-- tests
drop policy if exists "Users can manage clinic tests" on public.tests;
create policy "tests_select_clinic" on public.tests
  for select using (clinic_id = get_user_clinic_id());
create policy "tests_insert_admin" on public.tests
  for insert with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "tests_update_admin" on public.tests
  for update using (clinic_id = get_user_clinic_id() and is_clinic_admin())
  with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "tests_delete_admin" on public.tests
  for delete using (clinic_id = get_user_clinic_id() and is_clinic_admin());

-- sports
drop policy if exists "Users can manage clinic sports" on public.sports;
create policy "sports_select_clinic" on public.sports
  for select using (clinic_id = get_user_clinic_id());
create policy "sports_insert_admin" on public.sports
  for insert with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "sports_update_admin" on public.sports
  for update using (clinic_id = get_user_clinic_id() and is_clinic_admin())
  with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "sports_delete_admin" on public.sports
  for delete using (clinic_id = get_user_clinic_id() and is_clinic_admin());

-- sport_tests
drop policy if exists "Users can manage clinic sport_tests" on public.sport_tests;
create policy "sport_tests_select_clinic" on public.sport_tests
  for select using (clinic_id = get_user_clinic_id());
create policy "sport_tests_insert_admin" on public.sport_tests
  for insert with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "sport_tests_update_admin" on public.sport_tests
  for update using (clinic_id = get_user_clinic_id() and is_clinic_admin())
  with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "sport_tests_delete_admin" on public.sport_tests
  for delete using (clinic_id = get_user_clinic_id() and is_clinic_admin());

-- consent_versions
drop policy if exists "Users can manage clinic consent_versions" on public.consent_versions;
create policy "consent_versions_select_clinic" on public.consent_versions
  for select using (clinic_id = get_user_clinic_id());
create policy "consent_versions_insert_admin" on public.consent_versions
  for insert with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "consent_versions_update_admin" on public.consent_versions
  for update using (clinic_id = get_user_clinic_id() and is_clinic_admin())
  with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "consent_versions_delete_admin" on public.consent_versions
  for delete using (clinic_id = get_user_clinic_id() and is_clinic_admin());

-- ===== users: un fisio solo se ve a sí mismo; el admin ve a toda la clínica =====
drop policy if exists "Users can view clinic colleagues" on public.users;
create policy "users_select_self_or_admin" on public.users
  for select using (
    id = auth.uid()
    or (is_clinic_admin() and clinic_id = get_user_clinic_id())
  );
