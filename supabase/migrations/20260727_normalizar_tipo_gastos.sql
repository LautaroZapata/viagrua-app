-- =============================================
-- Normaliza public.gastos.tipo a minuscula
-- =============================================
-- Hasta el commit 1808daf la app guardaba el tipo capitalizado ("Combustible",
-- "Mantenimiento", "Seguro", "Otro"). Desde entonces se guarda en minuscula,
-- validado contra el whitelist de lib/validation.ts (TIPOS_GASTO_VALIDOS).
--
-- El filtro por tipo del dashboard compara exacto
-- (app/(authenticated)/dashboard/gastos/page.tsx), asi que las filas viejas
-- quedaban invisibles al filtrar. Esto las alinea.
--
-- Idempotente: si ya esta normalizado, afecta 0 filas.

update public.gastos
set tipo = lower(tipo)
where tipo <> lower(tipo);
