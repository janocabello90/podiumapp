-- Instrucciones (rol/tono/énfasis) editables por la clínica para cada tipo de informe.
-- La ESTRUCTURA del informe (secciones JSON) sigue fija en el código; esto solo personaliza
-- el rol y las indicaciones. Sin fila para un tipo → se usa el texto por defecto del código.
create table if not exists public.report_prompts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  type text not null check (type in ('individual','team','campaign')),
  instructions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, type)
);

alter table public.report_prompts enable row level security;

create policy "report_prompts_select_clinic" on public.report_prompts
  for select using (clinic_id = get_user_clinic_id());
create policy "report_prompts_insert_admin" on public.report_prompts
  for insert with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "report_prompts_update_admin" on public.report_prompts
  for update using (clinic_id = get_user_clinic_id() and is_clinic_admin())
  with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "report_prompts_delete_admin" on public.report_prompts
  for delete using (clinic_id = get_user_clinic_id() and is_clinic_admin());
