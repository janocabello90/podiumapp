-- Rondas de seguimiento por (estudio, equipo): estado abierta/cerrada.
-- Hasta ahora la "ronda" (sessions.campaign_round) era solo un contador por jugador.
-- Esta tabla la convierte en una FASE del estudio, por equipo, que se puede cerrar/abrir.
create table if not exists public.campaign_team_rounds (
  id           uuid primary key default uuid_generate_v4(),
  clinic_id    uuid not null references public.clinics(id)   on delete cascade,
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  team_id      uuid not null references public.teams(id)     on delete cascade,
  round_number integer not null,
  status       text not null default 'open' check (status in ('open','closed')),
  opened_at    timestamptz not null default now(),
  closed_at    timestamptz,
  opened_by    uuid references auth.users(id),
  closed_by    uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  unique (campaign_id, team_id, round_number)
);

create index if not exists idx_ctr_campaign_team
  on public.campaign_team_rounds (campaign_id, team_id);

-- RLS: el event-trigger ensure_rls activa RLS pero NO crea policies (quedaría deny-all).
-- Política única FOR ALL, clínica-scoped, como el resto de tablas de campaña (campaign_teams).
alter table public.campaign_team_rounds enable row level security;

drop policy if exists "Clinic scoped campaign_team_rounds" on public.campaign_team_rounds;
create policy "Clinic scoped campaign_team_rounds"
  on public.campaign_team_rounds for all
  using (clinic_id = get_user_clinic_id())
  with check (clinic_id = get_user_clinic_id());

-- Backfill: una fila por cada (campaign, team, round) ya presente en sessions.
-- status = 'closed' si ese (equipo, ronda) YA tiene informe de equipo generado; si no, 'open'.
-- Así la operativa actual (Racing r1, que ya tiene informes de equipo) no se ve afectada.
insert into public.campaign_team_rounds (clinic_id, campaign_id, team_id, round_number, status, closed_at)
select distinct
  s.clinic_id,
  s.campaign_id,
  p.team_id,
  s.campaign_round,
  case when exists (
    select 1 from public.reports r
    where r.scope = 'campaign' and r.campaign_id = s.campaign_id
      and r.team_id = p.team_id and r.campaign_round = s.campaign_round
  ) then 'closed' else 'open' end,
  case when exists (
    select 1 from public.reports r
    where r.scope = 'campaign' and r.campaign_id = s.campaign_id
      and r.team_id = p.team_id and r.campaign_round = s.campaign_round
  ) then now() else null end
from public.sessions s
join public.patients p on p.id = s.patient_id
where s.campaign_id is not null
  and s.campaign_round is not null
  and p.team_id is not null
on conflict (campaign_id, team_id, round_number) do nothing;
