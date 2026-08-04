-- Nuevo tipo de consentimiento: derechos de imagen (con canales autorizados en consents.metadata).
alter table public.consent_versions drop constraint consent_versions_type_check;
alter table public.consent_versions add constraint consent_versions_type_check
  check (type = any (array['data_processing','info_treatment','ai_analysis','image_rights']));

alter table public.consents drop constraint consents_type_check;
alter table public.consents add constraint consents_type_check
  check (type = any (array['data_processing','info_treatment','ai_analysis','image_rights']));

-- Metadatos por consentimiento (para imagen: {"channels": [...]}). Nullable, aditivo.
alter table public.consents add column if not exists metadata jsonb;
