-- =============================================================
-- Fotos: guardar la ruta en vez de la URL publica
-- =============================================================
-- Las columnas foto_* guardaban la URL publica completa. Con el bucket privado
-- esa URL deja de servir, asi que se pasa a guardar solo la ruta dentro del
-- bucket y la URL se firma al momento de mostrar la foto.
--
-- ORDEN OBLIGATORIO: esta migracion va DESPUES de desplegar el codigo que sabe
-- leer rutas. Al reves, el codigo viejo pondria la ruta en el src de un <img>
-- y las fotos quedarian rotas.
--
-- Son fotos de traslados reales de un usuario en produccion: nada se borra y
-- todo queda recuperable.

-- Respaldo completo antes de tocar nada. Se conserva: pesa poco y es la unica
-- forma de volver atras si algo sale mal.
create table if not exists public.fotos_urls_respaldo (
  traslado_id uuid primary key references public.traslados(id) on delete cascade,
  foto_frontal text,
  foto_lateral text,
  foto_trasera text,
  foto_interior text,
  respaldado_en timestamptz not null default now()
);

alter table public.fotos_urls_respaldo enable row level security;
revoke all on public.fotos_urls_respaldo from anon, authenticated;

insert into public.fotos_urls_respaldo (traslado_id, foto_frontal, foto_lateral, foto_trasera, foto_interior)
select id, foto_frontal, foto_lateral, foto_trasera, foto_interior
  from public.traslados
 where foto_frontal is not null
    or foto_lateral is not null
    or foto_trasera is not null
    or foto_interior is not null
on conflict (traslado_id) do nothing;

/**
 * Extrae la ruta dentro del bucket. Espeja rutaDeFoto() de lib/fotos.ts.
 *
 * Idempotente: si el valor ya es una ruta lo deja igual, asi que correr la
 * migracion dos veces no rompe nada.
 */
create or replace function public.ruta_de_foto(valor text)
returns text
language sql
immutable
as $$
  select case
    when valor is null then null
    when position('/fotos-traslados/' in valor) > 0
      then split_part(
             substring(valor from position('/fotos-traslados/' in valor) + length('/fotos-traslados/')),
             '?', 1
           )
    else ltrim(valor, '/')
  end;
$$;

update public.traslados
   set foto_frontal  = public.ruta_de_foto(foto_frontal),
       foto_lateral  = public.ruta_de_foto(foto_lateral),
       foto_trasera  = public.ruta_de_foto(foto_trasera),
       foto_interior = public.ruta_de_foto(foto_interior)
 where foto_frontal  like '%/fotos-traslados/%'
    or foto_lateral  like '%/fotos-traslados/%'
    or foto_trasera  like '%/fotos-traslados/%'
    or foto_interior like '%/fotos-traslados/%';
