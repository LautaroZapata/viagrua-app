-- =============================================================
-- Fotos: bucket privado y policies por empresa
-- =============================================================
-- Estado anterior, en produccion:
--
--   "Ver fotos"   SELECT USING (bucket_id = 'fotos-traslados')
--   "Subir fotos" INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-traslados')
--
-- Ninguna miraba de que empresa era el archivo. Y como el bucket era publico,
-- las lecturas ni siquiera pasaban por RLS: alcanzaba con tener el link para
-- ver la foto de un vehiculo ajeno, con su matricula, sin iniciar sesion.
--
-- La de INSERT era peor todavia y no era solo privacidad: cualquier usuario
-- autenticado podia escribir dentro de la carpeta de un traslado de otra
-- empresa.
--
-- Esta migracion NO cierra el bucket: solo arregla las policies y pone limites.
-- Se puede aplicar sin esperar ningun deploy, porque mientras el bucket sea
-- publico las lecturas no pasan por RLS y nadie ve un cambio. Lo que si cierra
-- de inmediato es el agujero de escritura.
--
-- El bucket pasa a privado en 20260807, que si depende del deploy del codigo
-- que firma las URLs.

-- Tope de 10 MB y solo imagenes: antes no tenia ninguno de los dos limites, asi
-- que se podia subir un archivo de cualquier peso y de cualquier tipo.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'fotos-traslados';

drop policy if exists "Ver fotos" on storage.objects;
drop policy if exists "Subir fotos" on storage.objects;
drop policy if exists "Subir Fotos hwe97p_0" on storage.objects;

/**
 * La carpeta de cada archivo es el id del traslado: <trasladoId>/<tipo>_<ts>.jpg
 * De ahi se deduce a que empresa pertenece.
 */
create or replace function public.foto_es_de_mi_empresa(nombre_objeto text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.traslados t
     where t.id::text = (storage.foldername(nombre_objeto))[1]
       and t.empresa_id = public.get_empresa_id()
  );
$$;

revoke execute on function public.foto_es_de_mi_empresa(text) from public, anon;
grant execute on function public.foto_es_de_mi_empresa(text) to authenticated;

create policy "fotos_select_empresa" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos-traslados'
    and public.foto_es_de_mi_empresa(name)
  );

create policy "fotos_insert_empresa" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos-traslados'
    and public.foto_es_de_mi_empresa(name)
  );

-- Borrar las fotos acompaña a borrar el traslado, que ya es solo del admin de
-- la empresa. La condicion de empresa alcanza: el boton no aparece para otros.
create policy "fotos_delete_empresa" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos-traslados'
    and public.foto_es_de_mi_empresa(name)
  );

-- Sin policy de UPDATE: una foto de inspeccion no se edita, se reemplaza
-- borrando y subiendo de nuevo.
