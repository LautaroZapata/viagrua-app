-- =============================================================
-- audit_log: crear la tabla que el codigo cree que existe
-- =============================================================
-- lib/audit.ts viene llamando a auditLog() desde siempre, pero la tabla nunca
-- se creo en produccion: 00002_audit_log.sql figura como aplicada y nunca
-- corrio. Como la funcion se traga el error (para no bloquear la operacion
-- principal), el fallo era invisible. Hoy no hay ningun rastro de auditoria.
-- Lo confirmo la generacion de tipos: 'audit_log' no existe en el esquema.
--
-- Diferencias con 00002: aquella daba INSERT con WITH CHECK (true), o sea que
-- cualquier cliente podia fabricar entradas y atribuirlas a otro user_id. Un
-- log de auditoria falsificable no sirve para nada.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  empresa_id uuid references public.empresas(id) on delete set null,
  action text not null,
  details jsonb not null default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_empresa_created
  on public.audit_log(empresa_id, created_at desc);
create index if not exists idx_audit_log_user
  on public.audit_log(user_id);

alter table public.audit_log enable row level security;

-- Lectura: solo el admin de la empresa, y solo de su empresa.
drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin" on public.audit_log
  for select to authenticated
  using (
    empresa_id = public.get_empresa_id()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol = 'admin'
    )
  );

-- Escritura: exclusivamente service_role, o sea desde el servidor.
-- Sin policy de INSERT para 'authenticated' ni 'anon', esos roles no pueden
-- escribir aunque tengan el GRANT de tabla.
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- Nadie edita ni borra el log, tampoco el admin.
