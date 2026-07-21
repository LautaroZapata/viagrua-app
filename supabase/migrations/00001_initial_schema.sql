-- ViaGrua initial schema migration
-- Run with: supabase db push (or supabase migration up for local dev)

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- =============================================
-- TABLE: empresas
-- =============================================
create table public.empresas (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  plan text not null default 'gratis',
  estado text not null default 'activa',
  codigo_invitacion text unique,
  mercadopago_preapproval_id text,
  mercadopago_preapproval_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.empresas enable row level security;

-- =============================================
-- TABLE: perfiles
-- =============================================
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nombre_completo text,
  telefono text,
  rol text not null default 'chofer',
  empresa_id uuid references public.empresas(id) on delete set null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;

create index idx_perfiles_empresa_id on public.perfiles(empresa_id);
create index idx_perfiles_rol on public.perfiles(rol);

-- =============================================
-- TABLE: traslados
-- =============================================
create table public.traslados (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  chofer_id uuid references public.perfiles(id) on delete set null,
  desde text,
  hasta text,
  marca_modelo text,
  matricula text,
  fecha_entrega date,
  importe_total numeric(12, 2),
  estado text not null default 'pendiente',
  estado_pago text not null default 'pendiente',
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fotos_urls jsonb,
  kilometros_previstos integer,
  fecha_carga date
);

alter table public.traslados enable row level security;

create index idx_traslados_empresa_id on public.traslados(empresa_id);
create index idx_traslados_chofer_id on public.traslados(chofer_id);
create index idx_traslados_estado on public.traslados(estado);
create index idx_traslados_created_at on public.traslados(created_at desc);

-- =============================================
-- TABLE: gastos
-- =============================================
create table public.gastos (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid references public.perfiles(id) on delete set null,
  tipo text not null,
  importe numeric(12, 2) not null,
  descripcion text,
  fecha date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gastos enable row level security;

create index idx_gastos_empresa_id on public.gastos(empresa_id);
create index idx_gastos_user_id on public.gastos(user_id);
create index idx_gastos_fecha on public.gastos(fecha desc);

-- =============================================
-- TABLE: invitaciones
-- =============================================
create table public.invitaciones (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text not null unique,
  email text,
  rol text not null default 'chofer',
  estado text not null default 'pendiente',
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.invitaciones enable row level security;

create index idx_invitaciones_codigo on public.invitaciones(codigo);
create index idx_invitaciones_empresa_id on public.invitaciones(empresa_id);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Helper: get current user's empresa_id
create or replace function public.get_user_empresa_id()
returns uuid
language sql
security definer
stable
as $$
  select empresa_id from public.perfiles where id = auth.uid()
$$;

-- Helper: get current user's rol
create or replace function public.get_user_rol()
returns text
language sql
security definer
stable
as $$
  select rol from public.perfiles where id = auth.uid()
$$;

-- =============================================
-- perfiles: users can read/update their own profile;
--           admins can read all profiles in their empresa
-- =============================================
create policy "perfiles_select_own"
  on public.perfiles for select
  using (id = auth.uid());

create policy "perfiles_select_empresa"
  on public.perfiles for select
  using (empresa_id = public.get_user_empresa_id());

create policy "perfiles_update_own"
  on public.perfiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "perfiles_insert_own"
  on public.perfiles for insert
  with check (id = auth.uid());

-- =============================================
-- empresas: members can read their own company;
--           admins can update
-- =============================================
create policy "empresas_select_member"
  on public.empresas for select
  using (id = public.get_user_empresa_id());

create policy "empresas_update_admin"
  on public.empresas for update
  using (
    id = public.get_user_empresa_id()
    and public.get_user_rol() = 'admin'
  );

create policy "empresas_insert_authenticated"
  on public.empresas for insert
  with check (auth.uid() is not null);

-- =============================================
-- traslados: scoped to empresa
-- =============================================
create policy "traslados_select_empresa"
  on public.traslados for select
  using (empresa_id = public.get_user_empresa_id());

create policy "traslados_insert_empresa"
  on public.traslados for insert
  with check (empresa_id = public.get_user_empresa_id());

create policy "traslados_update_empresa"
  on public.traslados for update
  using (empresa_id = public.get_user_empresa_id())
  with check (empresa_id = public.get_user_empresa_id());

create policy "traslados_delete_empresa"
  on public.traslados for delete
  using (
    empresa_id = public.get_user_empresa_id()
    and public.get_user_rol() = 'admin'
  );

-- =============================================
-- gastos: scoped to empresa
-- =============================================
create policy "gastos_select_empresa"
  on public.gastos for select
  using (empresa_id = public.get_user_empresa_id());

create policy "gastos_insert_empresa"
  on public.gastos for insert
  with check (
    empresa_id = public.get_user_empresa_id()
    and user_id = auth.uid()
  );

create policy "gastos_update_empresa"
  on public.gastos for update
  using (empresa_id = public.get_user_empresa_id())
  with check (empresa_id = public.get_user_empresa_id());

create policy "gastos_delete_empresa"
  on public.gastos for delete
  using (
    empresa_id = public.get_user_empresa_id()
    and (
      user_id = auth.uid()
      or public.get_user_rol() = 'admin'
    )
  );

-- =============================================
-- invitaciones: scoped to empresa, admin-only write
-- =============================================
create policy "invitaciones_select_empresa"
  on public.invitaciones for select
  using (empresa_id = public.get_user_empresa_id());

create policy "invitaciones_insert_admin"
  on public.invitaciones for insert
  with check (
    empresa_id = public.get_user_empresa_id()
    and public.get_user_rol() = 'admin'
  );

create policy "invitaciones_update_admin"
  on public.invitaciones for update
  using (
    empresa_id = public.get_user_empresa_id()
    and public.get_user_rol() = 'admin'
  );

create policy "invitaciones_delete_admin"
  on public.invitaciones for delete
  using (
    empresa_id = public.get_user_empresa_id()
    and public.get_user_rol() = 'admin'
  );

-- =============================================
-- TRIGGER: auto-update updated_at
-- =============================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.empresas
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.perfiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.traslados
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.gastos
  for each row execute function public.handle_updated_at();
