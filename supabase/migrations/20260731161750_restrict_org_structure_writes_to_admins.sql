-- Estructura organizativa (grupos, equipos, estudios) = solo admin puede crear/editar/borrar.
-- La LECTURA se mantiene para toda la clínica (los fisios navegan y valoran).
-- Nota: dar de alta un jugador escribe en `patients` (no aquí), así que el fisio conserva
-- "Añadir jugador"; la importación masiva se restringe solo en la UI (también son patients).

-- groups
drop policy if exists "Users can manage clinic groups" on public.groups;
create policy "groups_select_clinic" on public.groups
  for select using (clinic_id = get_user_clinic_id());
create policy "groups_insert_admin" on public.groups
  for insert with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "groups_update_admin" on public.groups
  for update using (clinic_id = get_user_clinic_id() and is_clinic_admin())
  with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "groups_delete_admin" on public.groups
  for delete using (clinic_id = get_user_clinic_id() and is_clinic_admin());

-- teams
drop policy if exists "Users can manage clinic teams" on public.teams;
create policy "teams_select_clinic" on public.teams
  for select using (clinic_id = get_user_clinic_id());
create policy "teams_insert_admin" on public.teams
  for insert with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "teams_update_admin" on public.teams
  for update using (clinic_id = get_user_clinic_id() and is_clinic_admin())
  with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "teams_delete_admin" on public.teams
  for delete using (clinic_id = get_user_clinic_id() and is_clinic_admin());

-- campaigns (estudios)
drop policy if exists "Users can manage clinic campaigns" on public.campaigns;
create policy "campaigns_select_clinic" on public.campaigns
  for select using (clinic_id = get_user_clinic_id());
create policy "campaigns_insert_admin" on public.campaigns
  for insert with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "campaigns_update_admin" on public.campaigns
  for update using (clinic_id = get_user_clinic_id() and is_clinic_admin())
  with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "campaigns_delete_admin" on public.campaigns
  for delete using (clinic_id = get_user_clinic_id() and is_clinic_admin());

-- campaign_teams
drop policy if exists "Users can manage clinic campaign_teams" on public.campaign_teams;
create policy "campaign_teams_select_clinic" on public.campaign_teams
  for select using (clinic_id = get_user_clinic_id());
create policy "campaign_teams_insert_admin" on public.campaign_teams
  for insert with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "campaign_teams_update_admin" on public.campaign_teams
  for update using (clinic_id = get_user_clinic_id() and is_clinic_admin())
  with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "campaign_teams_delete_admin" on public.campaign_teams
  for delete using (clinic_id = get_user_clinic_id() and is_clinic_admin());
