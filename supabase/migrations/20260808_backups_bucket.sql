-- =============================================================
-- Backups: bucket privado
-- =============================================================
-- Destino de los dumps que sube .github/workflows/backup.yml todos los dias.
--
-- Sin policies a proposito. storage.objects tiene RLS activo, asi que "ninguna
-- policy" significa que ningun usuario logueado ni anon puede listar, leer ni
-- escribir aca. La unica llave que entra es service_role, que saltea RLS y solo
-- vive en los secrets de GitHub Actions y en Vercel; nunca en el bundle.
--
-- Es importante que siga asi: el dump incluye la tabla auth.users de todas las
-- empresas, con los hashes de contrasena. Una policy de SELECT abierta aca
-- entregaria la base entera de todos los clientes a cualquier usuario logueado.
--
-- El limite de 50 MB no es una eleccion: es el techo por archivo del plan
-- actual de Supabase, y Storage rechaza crear el bucket con cualquier valor mas
-- alto (413 "The object exceeded the maximum allowed size"). Hoy sobra: el dump
-- comprimido pesa un orden de magnitud menos, porque las fotos viven en Storage
-- y no en la base. Si algun dia lo roza, el workflow avisa antes de llegar al
-- techo y ahi hay que subir de plan o partir el dump.
--
-- Idempotente para poder re-correrla sin pisar el bucket si ya existe.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backups', 'backups', false, 52428800, array['application/gzip'])
on conflict (id) do update
   set public             = false,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;
