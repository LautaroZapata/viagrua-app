-- perfiles.telefono nunca existio en produccion, pero el paso de perfil del
-- onboarding (app/(authenticated)/onboarding/page.tsx) hace
-- update({ telefono }) desde que se escribio. PostgREST devuelve
-- "Could not find the 'telefono' column" y el codigo ignora el error, asi que
-- el usuario carga su telefono y se descarta sin aviso.
--
-- Se agrega la columna porque la intencion del producto es clara: el onboarding
-- lo pide explicitamente ("para que tu equipo pueda contactarte").
--
-- lib/useSupabaseQuery.ts:usePerfil tambien selecciona avatar_url, que tampoco
-- existe. Ese hook no lo importa nadie, asi que no explota; se resuelve al
-- generar los tipos con `supabase gen types` (Fase 3 del plan).

alter table public.perfiles
  add column if not exists telefono text;

alter table public.perfiles
  drop constraint if exists perfiles_telefono_largo;

alter table public.perfiles
  add constraint perfiles_telefono_largo
  check (telefono is null or char_length(telefono) <= 30);
