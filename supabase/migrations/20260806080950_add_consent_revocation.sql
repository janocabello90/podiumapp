-- Revocación de consentimientos con trazabilidad: se conserva que se aceptó (granted_at) y se
-- registra cuándo/quién lo revocó (revoked_at/revoked_by). No se borra el registro original.
alter table public.consents add column if not exists revoked_at timestamptz;
alter table public.consents add column if not exists revoked_by uuid references public.users(id) on delete set null;
