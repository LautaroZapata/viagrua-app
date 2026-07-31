-- =============================================================
-- PARCHE DE SEGURIDAD CRITICA
-- =============================================================
-- Cierra una toma de control remota sin autenticacion: cualquiera podia
-- registrarse mandando el UUID de otra empresa en el metadata del signUp y
-- quedar como admin de esa empresa (handle_new_user hardcodeaba rol='admin'
-- y confiaba en raw_user_meta_data, que controla el cliente).
--
-- Tambien elimina policies permisivas USING(true) que, al combinarse con OR,
-- anulaban a las restrictivas de la misma tabla.
--
-- NO incluido a proposito (requiere mover el alta a una ruta server-side
-- antes, si no se rompe el registro de empresas):
--   - empresas: SELECT/INSERT para anon con USING(true)/WITH CHECK(true)
--   - invitaciones: SELECT con USING(true)
-- Ver Fase 1 del plan.

-- -------------------------------------------------------------
-- 0. get_empresa_id(): va primero porque las policies de abajo la usan
-- -------------------------------------------------------------
-- Estaba definida al final del archivo. En produccion no molestaba porque la
-- funcion ya existia (se creo a mano desde el dashboard antes que esta
-- migracion), pero aplicando el repo desde cero —un proyecto nuevo, o el
-- Supabase local de los E2E— la policy "traslados_update_empresa" reventaba con
-- 'function public.get_empresa_id() does not exist'. Postgres resuelve las
-- funciones de una policy al crearla, no al usarla.
--
-- Sin 'SET search_path' una funcion SECURITY DEFINER puede resolver 'perfiles'
-- contra un schema plantado por el atacante (function_search_path_mutable).
create or replace function public.get_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select empresa_id from public.perfiles where id = auth.uid();
$$;

-- -------------------------------------------------------------
-- 1. handle_new_user: el agujero principal
-- -------------------------------------------------------------
-- Solo se puede quedar como admin de una empresa que todavia no tiene ningun
-- perfil, o sea la que se acaba de crear en ese mismo registro. Si la empresa
-- ya tiene miembros, el alta falla. Preserva el flujo actual de app/page.tsx.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_empresa uuid := nullif(new.raw_user_meta_data->>'empresa_id', '')::uuid;
  v_ocupada boolean;
begin
  if v_empresa is not null then
    select exists(select 1 from public.perfiles where empresa_id = v_empresa)
      into v_ocupada;

    if v_ocupada then
      raise exception 'empresa_id no disponible para alta directa'
        using errcode = '42501';
    end if;
  end if;

  insert into public.perfiles (id, nombre_completo, rol, empresa_id)
  values (
    new.id,
    new.raw_user_meta_data->>'nombre_completo',
    case when v_empresa is null then 'chofer' else 'admin' end,
    v_empresa
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- -------------------------------------------------------------
-- 2. perfiles: cerrar la escalada de privilegios
-- -------------------------------------------------------------
-- Insertar perfiles arbitrarios desde el cliente no tiene ningun uso legitimo:
-- el alta la hace handle_new_user (SECURITY DEFINER) y /api/unirse usa
-- service_role. Ambos caminos ignoran RLS.
drop policy if exists "Insertar perfil nuevo" on public.perfiles;

-- rol y empresa_id son la clave de tenancy: si el usuario las puede escribir,
-- todo el aislamiento entre empresas es decorativo. Se bloquean con trigger
-- porque RLS no permite restringir por columna.
-- Solo aplica a llamadas del cliente (rol 'authenticated'); las funciones
-- SECURITY DEFINER y service_role siguen pudiendo, que es lo que necesita
-- expulsar_chofer.
-- SECURITY INVOKER a proposito (o sea, sin SECURITY DEFINER): necesitamos que
-- current_user sea el rol que origina el UPDATE. Con SECURITY DEFINER seria
-- siempre 'postgres' y el chequeo de abajo no bloquearia nunca nada.
create or replace function public.perfiles_lock_privilegios()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- 'authenticated' = llamada desde el cliente via PostgREST.
  -- expulsar_chofer corre como 'postgres' y service_role como 'service_role';
  -- esos caminos tienen que poder seguir escribiendo rol/empresa_id.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.rol is distinct from old.rol
     or new.empresa_id is distinct from old.empresa_id then
    raise exception 'no se puede modificar id, rol ni empresa_id'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists perfiles_lock_privilegios_trg on public.perfiles;
create trigger perfiles_lock_privilegios_trg
  before update on public.perfiles
  for each row execute function public.perfiles_lock_privilegios();

-- -------------------------------------------------------------
-- 3. traslados: sacar las permisivas y scopear por empresa
-- -------------------------------------------------------------
-- "Realtime select" daba SELECT sobre los traslados de TODAS las empresas.
-- "Ver traslados" ya cubre el acceso legitimo (empresa propia o traslado propio).
drop policy if exists "Realtime select" on public.traslados;

-- Comparaba contra 'COMPLETADO' en mayuscula, pero la app guarda 'completado'.
-- La condicion daba siempre true, asi que en la practica era un UPDATE abierto
-- a cualquiera sobre cualquier traslado de cualquier empresa.
drop policy if exists "No permitir editar traslados completados" on public.traslados;

-- Las de chofer no tienen WITH CHECK: permitirian mover un traslado a otra
-- empresa o reasignarlo. Se reemplazan por una sola, scopeada en ambos lados.
drop policy if exists "Chofer actualiza sus traslados" on public.traslados;
drop policy if exists "Chofer actualiza sus traslados activos" on public.traslados;
-- El nombre nuevo tambien se dropea: en produccion no existia, pero 00001 si lo
-- crea, y sin esto la migracion no corre desde cero.
drop policy if exists "traslados_update_empresa" on public.traslados;

create policy "traslados_update_empresa" on public.traslados
  for update to authenticated
  using (empresa_id = public.get_empresa_id())
  with check (empresa_id = public.get_empresa_id());

-- Ambas verificaban rol='admin' pero ninguna la empresa: un admin podia borrar
-- traslados de otra empresa.
drop policy if exists "Solo admin puede borrar traslados" on public.traslados;
drop policy if exists "Permitir borrar solo al dueño o admin" on public.traslados;
drop policy if exists "traslados_delete_admin_empresa" on public.traslados;

create policy "traslados_delete_admin_empresa" on public.traslados
  for delete to authenticated
  using (
    empresa_id = public.get_empresa_id()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol = 'admin'
    )
  );

-- -------------------------------------------------------------
-- 4. invitaciones: quitar los WITH CHECK(true)/USING(true) de escritura
-- -------------------------------------------------------------
-- Pese al nombre no verificaban nada: cualquiera creaba o modificaba
-- invitaciones de cualquier empresa. "Admins crean invitaciones" ya hace
-- la validacion correcta y se mantiene.
drop policy if exists "Admins pueden crear" on public.invitaciones;
drop policy if exists "Admins pueden actualizar" on public.invitaciones;
-- Mismo caso que traslados_update_empresa: 00001 ya la crea.
drop policy if exists "invitaciones_update_admin" on public.invitaciones;

create policy "invitaciones_update_admin" on public.invitaciones
  for update to authenticated
  using (
    empresa_id = public.get_empresa_id()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol = 'admin'
    )
  );

-- -------------------------------------------------------------
-- 5. gastos: atar el insert a la empresa del que lo crea
-- -------------------------------------------------------------
drop policy if exists "Crear gastos" on public.gastos;

create policy "Crear gastos" on public.gastos
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and (empresa_id is null or empresa_id = public.get_empresa_id())
  );

-- -------------------------------------------------------------
-- 6. Funciones SECURITY DEFINER: search_path, scope y permisos
-- -------------------------------------------------------------
-- get_empresa_id() se define arriba de todo, antes de las policies que la usan.

-- Antes aceptaba cualquier p_empresa_id sin validar y, al ser SECURITY DEFINER,
-- devolvia el volumen de traslados de cualquier empresa.
create or replace function public.get_traslados_counts(p_empresa_id uuid)
returns json
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select json_build_object(
    'total', count(*),
    'pendiente', count(*) filter (where estado = 'pendiente'),
    'en_curso', count(*) filter (where estado = 'en_curso'),
    'completado', count(*) filter (where estado = 'completado')
  )
  from public.traslados
  where empresa_id = p_empresa_id
    and empresa_id = public.get_empresa_id();
$$;

-- Verificaba que el llamador fuera de la misma empresa que el chofer, pero no
-- que fuera admin: cualquier chofer podia expulsar a un companero.
create or replace function public.expulsar_chofer(chofer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_empresa uuid;
  v_admin_rol text;
  v_chofer_empresa uuid;
begin
  select empresa_id, rol into v_admin_empresa, v_admin_rol
    from public.perfiles where id = auth.uid();

  if v_admin_rol is distinct from 'admin' then
    raise exception 'solo un admin puede expulsar choferes'
      using errcode = '42501';
  end if;

  select empresa_id into v_chofer_empresa
    from public.perfiles where id = chofer_id;

  if v_admin_empresa is null or v_chofer_empresa is distinct from v_admin_empresa then
    raise exception 'no tenes permiso para expulsar este chofer'
      using errcode = '42501';
  end if;

  update public.perfiles set empresa_id = null where id = chofer_id;
  return true;
end;
$$;

-- anon no tiene por que ejecutar nada de esto.
revoke execute on function public.expulsar_chofer(uuid) from anon;
revoke execute on function public.get_empresa_id() from anon;
revoke execute on function public.get_traslados_counts(uuid) from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;
