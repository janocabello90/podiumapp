-- Ampliar la validez del enlace de anamnesis de 7 a 14 días (solo afecta a nuevas anamnesis).
alter table public.anamnesis_forms
  alter column expires_at set default (now() + interval '14 days');
