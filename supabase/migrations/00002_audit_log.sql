-- Audit log table for tracking important actions

create table public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  empresa_id uuid references public.empresas(id) on delete set null,
  action text not null,
  details jsonb default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create index idx_audit_log_empresa_id on public.audit_log(empresa_id);
create index idx_audit_log_user_id on public.audit_log(user_id);
create index idx_audit_log_action on public.audit_log(action);
create index idx_audit_log_created_at on public.audit_log(created_at desc);

-- Only admins in the same empresa can read audit logs
create policy "audit_log_select_empresa"
  on public.audit_log for select
  using (
    empresa_id = public.get_user_empresa_id()
    and public.get_user_rol() = 'admin'
  );

-- System can insert (via service role)
create policy "audit_log_insert_service"
  on public.audit_log for insert
  with check (true);
