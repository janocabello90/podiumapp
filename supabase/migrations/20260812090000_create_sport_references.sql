-- Referencias / baremos normativos por deporte. Documentos "tratados" (Markdown) que el fisio
-- puede adjuntar opcionalmente al generar un informe, para que la IA compare los valores del
-- jugador contra normas de su deporte. Dimensiones de encaje: deporte + sexo + rango de edad
-- (nivel/fase/temporada son metadatos opcionales que NO bloquean la vinculación).
create table if not exists public.sport_references (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  sport_id uuid not null references public.sports(id) on delete cascade,
  name text not null,
  sex text check (sex in ('male','female','any')),
  age_min int,
  age_max int,
  level text,
  phase text,
  season text,
  body_md text not null default '',
  prompt text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sport_references enable row level security;

-- Lectura: cualquier usuario de la clínica. Escritura: solo admin.
create policy "sport_references_select_clinic" on public.sport_references
  for select using (clinic_id = get_user_clinic_id());
create policy "sport_references_insert_admin" on public.sport_references
  for insert with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "sport_references_update_admin" on public.sport_references
  for update using (clinic_id = get_user_clinic_id() and is_clinic_admin())
  with check (clinic_id = get_user_clinic_id() and is_clinic_admin());
create policy "sport_references_delete_admin" on public.sport_references
  for delete using (clinic_id = get_user_clinic_id() and is_clinic_admin());

create index if not exists sport_references_sport_idx on public.sport_references(sport_id);
create index if not exists sport_references_clinic_idx on public.sport_references(clinic_id);
