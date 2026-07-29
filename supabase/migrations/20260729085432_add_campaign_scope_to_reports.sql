-- Fase G1: informe agregado de campaña sobre reports (aditivo).
alter table public.reports
  add column if not exists scope text not null default 'individual',
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

-- scope acotado a los dos valores válidos.
alter table public.reports
  drop constraint if exists reports_scope_check;
alter table public.reports
  add constraint reports_scope_check check (scope in ('individual','campaign'));

-- Un informe de campaña no cuelga de un paciente: relajar patient_id a NULLABLE.
alter table public.reports
  alter column patient_id drop not null;

-- Coherencia: individual exige patient_id; campaign exige campaign_id.
alter table public.reports
  drop constraint if exists reports_scope_coherence_check;
alter table public.reports
  add constraint reports_scope_coherence_check check (
    (scope = 'individual' and patient_id is not null)
    or (scope = 'campaign' and campaign_id is not null)
  );

create index if not exists idx_reports_campaign_id
  on public.reports(campaign_id) where campaign_id is not null;
