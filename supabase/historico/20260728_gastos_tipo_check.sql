-- =============================================
-- CHECK sobre public.gastos.tipo
-- =============================================
-- Fija en la DB el whitelist que ya valida lib/validation.ts (TIPOS_GASTO_VALIDOS)
-- y que el dropdown de app/(authenticated)/dashboard/gastos/page.tsx ofrece.
--
-- Requiere que los datos esten normalizados a minuscula:
-- ver 20260727_normalizar_tipo_gastos.sql.
--
-- IMPORTANTE: agregar un tipo de gasto nuevo a la UI exige una migracion que
-- actualice este constraint, si no el insert falla con 23514.

alter table public.gastos
  drop constraint if exists gastos_tipo_check;

alter table public.gastos
  add constraint gastos_tipo_check
  check (tipo in ('combustible', 'seguro', 'mantenimiento', 'peaje', 'patente', 'multa', 'otro'));
