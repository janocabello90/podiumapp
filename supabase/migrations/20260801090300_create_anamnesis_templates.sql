-- Plantillas de anamnesis editables por clínica y por audiencia (individual/equipo).
-- Si no hay fila para una (clínica, audiencia), la app usa la plantilla por defecto del código.
create table if not exists public.anamnesis_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  audience text not null check (audience in ('individual','team')),
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, audience)
);

alter table public.anamnesis_templates enable row level security;

-- Lectura: cualquier usuario de la clínica. Escritura: solo admin.
create policy "anamnesis_templates_select_clinic" on public.anamnesis_templates
  for select using (clinic_id = get_user_clinic_id());
create policy "anamnesis_templates_insert_admin" on public.anamnesis_templates
  for insert with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "anamnesis_templates_update_admin" on public.anamnesis_templates
  for update using (clinic_id = get_user_clinic_id() and is_clinic_admin())
  with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "anamnesis_templates_delete_admin" on public.anamnesis_templates
  for delete using (clinic_id = get_user_clinic_id() and is_clinic_admin());
