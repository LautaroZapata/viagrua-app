-- =============================================================
-- El trigger que crea el perfil al registrarse
-- =============================================================
-- handle_new_user() existia en el repo desde 20260729, pero el trigger que la
-- dispara NO: se creo a mano en el dashboard y nunca quedo en una migracion.
--
-- Sin el, un alta crea la fila en auth.users y la empresa, y no crea el perfil.
-- La app no muestra ningun error: el usuario queda logueado y sin rol, y el
-- dashboard le aparece vacio. Se descubrio armando los E2E, donde el alta
-- terminaba con 1 usuario, 1 empresa y 0 perfiles.
--
-- Importa mas de lo que parece: `supabase db dump` vuelca el schema public y
-- los triggers sobre auth.users no son parte de public, asi que esto TAMPOCO
-- estaba en los backups diarios. Restaurar un backup sobre un proyecto vacio
-- dejaba la aplicacion sin poder dar de alta a nadie mas.
--
-- Idempotente para poder correrla sobre produccion, donde el trigger ya existe.

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
