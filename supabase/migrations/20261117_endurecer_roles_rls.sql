-- Endurecimiento de roles y RLS (auditoría de seguridad 2026-11-17).
--
-- Hasta ahora el rol (admin / chofer) se controlaba en la interfaz y en
-- algunas rutas, pero no en la base: un chofer podía leer gastos y códigos de
-- invitación de toda la empresa, reescribir o reasignar cualquier traslado,
-- editar perfiles ajenos y borrar fotos. Esta migración lleva el rol a RLS.
--
-- Flujos que tienen que seguir andando:
--   admin  -> todo dentro de su empresa.
--   chofer -> lee SUS traslados (chofer_id = él, en su empresa), cambia sólo
--             estado / estado_pago de esos traslados, lee y crea SUS gastos,
--             ve las fotos de sus traslados.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.soy_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin' and empresa_id is not null
  );
$$;
revoke all on function public.soy_admin() from public, anon;
grant execute on function public.soy_admin() to authenticated;

create or replace function public.chofer_de_empresa(p_chofer uuid, p_empresa uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select p_chofer is null
      or exists (select 1 from public.perfiles where id = p_chofer and empresa_id = p_empresa);
$$;
revoke all on function public.chofer_de_empresa(uuid, uuid) from public, anon;
grant execute on function public.chofer_de_empresa(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- traslados
-- ---------------------------------------------------------------------------
-- Lectura: el admin ve los de su empresa; el chofer sólo los suyos y sólo
-- mientras pertenece a esa empresa (un chofer expulsado deja de verlos).
drop policy if exists "Ver traslados" on public.traslados;
alter policy "Admin puede leer traslados" on public.traslados
  using (empresa_id = public.get_empresa_id() and public.soy_admin());
alter policy "Chofer puede leer sus traslados" on public.traslados
  using (chofer_id = auth.uid() and empresa_id = public.get_empresa_id());

-- Alta: sólo admin, y el chofer asignado tiene que ser de la misma empresa.
-- Las dos policies de INSERT eran permissive y una no exigía rol: queda una.
drop policy if exists "Admin puede crear traslados" on public.traslados;
drop policy if exists "Admin crea traslados de su empresa" on public.traslados;
create policy "Admin crea traslados de su empresa" on public.traslados
  for insert to authenticated
  with check (
    empresa_id = public.get_empresa_id()
    and public.soy_admin()
    and public.chofer_de_empresa(chofer_id, empresa_id)
  );

-- Edición: el admin cualquiera de su empresa; el chofer sólo los suyos, y un
-- trigger le limita las columnas a estado / estado_pago.
alter policy traslados_update_empresa on public.traslados
  using (empresa_id = public.get_empresa_id() and (public.soy_admin() or chofer_id = auth.uid()))
  with check (
    empresa_id = public.get_empresa_id()
    and (public.soy_admin() or chofer_id = auth.uid())
    and public.chofer_de_empresa(chofer_id, empresa_id)
  );

create or replace function public.traslados_lock_chofer() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  -- service_role (rutas del servidor, backups) y admins no se limitan.
  if current_user <> 'authenticated' or public.soy_admin() then
    return new;
  end if;
  if (to_jsonb(new) - 'estado' - 'estado_pago') is distinct from (to_jsonb(old) - 'estado' - 'estado_pago') then
    raise exception 'un chofer solo puede cambiar estado y estado_pago' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists traslados_lock_chofer_trg on public.traslados;
create trigger traslados_lock_chofer_trg before update on public.traslados
  for each row execute function public.traslados_lock_chofer();

-- ---------------------------------------------------------------------------
-- gastos
-- ---------------------------------------------------------------------------
-- Cada uno ve los suyos; el admin, todos los de su empresa.
alter policy "Ver gastos" on public.gastos
  using (usuario_id = auth.uid() or (empresa_id = public.get_empresa_id() and public.soy_admin()));

-- Borrado: el propio o, si es admin, los de SU empresa (antes el admin podía
-- borrar gastos de cualquier empresa).
drop policy if exists "Eliminar gastos" on public.gastos;
create policy "Eliminar gastos" on public.gastos
  for delete to authenticated
  using (usuario_id = auth.uid() or (empresa_id = public.get_empresa_id() and public.soy_admin()));

-- ---------------------------------------------------------------------------
-- invitaciones: los códigos vivos sólo los ve el admin.
-- ---------------------------------------------------------------------------
alter policy invitaciones_select_empresa on public.invitaciones
  using (empresa_id = public.get_empresa_id() and public.soy_admin());

-- ---------------------------------------------------------------------------
-- perfiles: cada uno edita el suyo ("Usuarios editan su perfil"); el admin,
-- los de su empresa. Se van las dos policies que dejaban a cualquier miembro
-- (y a cualquiera, sobre perfiles sin empresa) reescribir perfiles ajenos.
-- ---------------------------------------------------------------------------
drop policy if exists "Actualizar perfiles de la empresa" on public.perfiles;
drop policy if exists "Admin puede actualizar perfiles de su empresa" on public.perfiles;
drop policy if exists perfiles_update_admin_empresa on public.perfiles;
create policy perfiles_update_admin_empresa on public.perfiles
  for update to authenticated
  using (empresa_id is not null and empresa_id = public.get_empresa_id() and public.soy_admin())
  with check (empresa_id = public.get_empresa_id());

-- ---------------------------------------------------------------------------
-- Expulsar deja al perfil como chofer sin empresa: un admin desvinculado ya no
-- arrastra su rol a otra empresa al canjear una invitación.
-- ---------------------------------------------------------------------------
create or replace function public.expulsar_chofer(chofer_id uuid) returns boolean
  language plpgsql security definer
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
    raise exception 'solo un admin puede expulsar choferes' using errcode = '42501';
  end if;

  -- Sólo se expulsa a choferes: ni a uno mismo ni a otro admin. Expulsar al
  -- último admin dejaba la empresa sin perfiles, y el trigger de alta le daba
  -- esa empresa como admin a cualquiera que la nombrara en su metadata.
  if chofer_id = auth.uid() then
    raise exception 'no podes expulsarte a vos mismo' using errcode = '42501';
  end if;

  select empresa_id into v_chofer_empresa
    from public.perfiles where id = chofer_id and rol = 'chofer';

  if v_admin_empresa is null or v_chofer_empresa is distinct from v_admin_empresa then
    raise exception 'no tenes permiso para expulsar este chofer' using errcode = '42501';
  end if;

  update public.perfiles set empresa_id = null, rol = 'chofer' where id = chofer_id;
  return true;
end;
$$;

-- Perfiles que ya quedaron como admin sin empresa no administran nada.
update public.perfiles set rol = 'chofer' where empresa_id is null and rol = 'admin';

-- ---------------------------------------------------------------------------
-- inspecciones / planes: tenían GRANT ALL a anon y RLS apagado.
-- ---------------------------------------------------------------------------
alter table public.inspecciones enable row level security;
alter table public.planes enable row level security;
revoke all on table public.inspecciones from anon, authenticated;   -- la app no la usa
revoke insert, update, delete, truncate, references, trigger on table public.planes from anon, authenticated;
drop policy if exists planes_select_catalogo on public.planes;
create policy planes_select_catalogo on public.planes for select to anon, authenticated using (true);

-- Lo que se cree de acá en adelante no queda expuesto a anon por defecto.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- ---------------------------------------------------------------------------
-- Fotos: subir y borrar es del admin (ver sigue siendo por empresa).
-- ---------------------------------------------------------------------------
drop policy if exists "fotos_insert_empresa" on storage.objects;
drop policy if exists "fotos_delete_empresa" on storage.objects;
drop policy if exists "fotos_insert_admin_empresa" on storage.objects;
drop policy if exists "fotos_delete_admin_empresa" on storage.objects;
create policy "fotos_insert_admin_empresa" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos-traslados' and public.foto_es_de_mi_empresa(name) and public.soy_admin());
create policy "fotos_delete_admin_empresa" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos-traslados' and public.foto_es_de_mi_empresa(name) and public.soy_admin());
