-- Fase F1: vincular documentos a sesión y a prueba de sesión (aditivo, NULLABLE).
alter table public.documents
  add column if not exists session_id uuid references public.sessions(id) on delete set null,
  add column if not exists session_test_id uuid references public.session_tests(id) on delete set null;

create index if not exists idx_documents_session_id
  on public.documents(session_id) where session_id is not null;
create index if not exists idx_documents_session_test_id
  on public.documents(session_test_id) where session_test_id is not null;
