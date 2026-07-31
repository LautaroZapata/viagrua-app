-- =============================================================
-- invitaciones: cerrar la lectura abierta y arreglar la expiracion
-- =============================================================
-- Requiere el cambio de cliente que mueve la lectura de invitaciones a
-- /api/validar-invitacion y /api/unirse-empresa (ambas con service_role).

-- -------------------------------------------------------------
-- 1. SELECT abierto sobre todos los codigos
-- -------------------------------------------------------------
-- Dos policies duplicadas con USING(true) dejaban a cualquiera leer TODOS los
-- codigos de invitacion de TODAS las empresas. Con un codigo sin usar de otra
-- empresa alcanzaba para entrar como chofer y leer sus traslados y gastos.
drop policy if exists "Invitaciones visibles" on public.invitaciones;
drop policy if exists "Leer invitaciones" on public.invitaciones;

-- El admin sigue viendo las invitaciones de su propia empresa. La validacion
-- de un codigo por parte de un invitado va por API con service_role, que no
-- pasa por RLS.
-- El drop del nombre nuevo es por 00001, que ya crea una policy asi: sin esto
-- la migracion no corre sobre una base armada desde cero.
drop policy if exists "invitaciones_select_empresa" on public.invitaciones;

create policy "invitaciones_select_empresa" on public.invitaciones
  for select to authenticated
  using (empresa_id = public.get_empresa_id());

-- -------------------------------------------------------------
-- 2. Expiracion real
-- -------------------------------------------------------------
-- InviteModal.tsx mandaba expires_at, pero el InviteStep de onboarding no:
-- esos codigos quedaban sin vencimiento. Poner el default en la DB en vez de
-- confiar en que cada cliente se acuerde.
alter table public.invitaciones
  alter column expires_at set default (now() + interval '7 days');

update public.invitaciones
   set expires_at = created_at + interval '7 days'
 where expires_at is null;

alter table public.invitaciones
  alter column expires_at set not null;
