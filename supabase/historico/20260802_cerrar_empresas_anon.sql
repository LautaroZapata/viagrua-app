-- =============================================================
-- empresas: cerrar el acceso de anon
-- =============================================================
-- Requiere el cambio de cliente que mueve el alta a /api/registro. Antes el
-- navegador insertaba la empresa SIN autenticarse y leia el id de vuelta, asi
-- que ambas policies tenian que estar abiertas a anon.
--
-- El SELECT con USING(true) dejaba a cualquiera, sin cuenta, listar TODAS las
-- empresas del sistema con sus UUID usando la anon key, que viaja en el bundle
-- del navegador. Ese listado era el primer paso de la toma de control que
-- cerro 20260729_seguridad_critica.sql: con el UUID de una empresa ajena se
-- podia pedir el alta como admin de ella.
--
-- Cerrado el trigger, el listado dejo de servir para escalar, pero seguia
-- filtrando la cartera de clientes completa: quien usa el producto y como se
-- llama cada empresa.

drop policy if exists "Permitir leer empresa propia" on public.empresas;
drop policy if exists "Permitir insertar empresa en registro" on public.empresas;

-- Lectura: solo la empresa a la que pertenece el usuario.
drop policy if exists "empresas_select_propia" on public.empresas;

create policy "empresas_select_propia" on public.empresas
  for select to authenticated
  using (id = public.get_empresa_id());

-- Sin policy de INSERT: el alta la hace /api/registro con service_role, que no
-- pasa por RLS. Ningun cliente necesita crear empresas.
revoke insert, update, delete on public.empresas from anon, authenticated;
revoke select on public.empresas from anon;

-- Actualizar el nombre de la empresa queda para el admin de esa empresa.
grant update (nombre) on public.empresas to authenticated;

drop policy if exists "empresas_update_admin" on public.empresas;
create policy "empresas_update_admin" on public.empresas
  for update to authenticated
  using (
    id = public.get_empresa_id()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol = 'admin'
    )
  );
