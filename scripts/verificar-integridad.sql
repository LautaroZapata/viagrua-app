-- Comprueba que ninguna clave foranea de `public` quedo apuntando al vacio.
--
-- Hace falta porque data.sql empieza con `SET session_replication_role =
-- replica`, que apaga los triggers y con ellos la comprobacion de claves
-- foraneas. Es lo correcto para cargar un dump (si no, habria que insertar las
-- tablas en el orden exacto de sus dependencias), pero significa que un restore
-- puede terminar sin un solo error y dejar filas huerfanas.
--
-- Es justo el caso de perfiles: apunta a auth.users, que no viene en schema.sql
-- porque lo gestiona Supabase. Si el destino tiene otra version del schema auth
-- y ese COPY falla, los perfiles entran igual y quedan colgando.
--
--   psql "$URL" -v ON_ERROR_STOP=1 -f scripts/verificar-integridad.sql
--
-- Se recorre pg_constraint en vez de listar las tablas a mano para que una FK
-- nueva quede cubierta sin tocar este archivo.

do $verificacion$
declare
  c record;
  condicion text;
  no_nulos text;
  huerfanos bigint;
  fallas int := 0;
  revisadas int := 0;
begin
  for c in
    select conname,
           conrelid,
           confrelid,
           conrelid::regclass::text as tabla,
           confrelid::regclass::text as referencia,
           conkey,
           confkey
    from pg_constraint
    where contype = 'f'
      and connamespace = 'public'::regnamespace
    order by conrelid::regclass::text, conname
  loop
    -- La condicion del join se arma desde la definicion de la restriccion, asi
    -- que sirve igual para claves de una columna y para las compuestas.
    select string_agg(format('t.%I = r.%I', a.attname, b.attname), ' and ')
      into condicion
    from unnest(c.conkey, c.confkey) as k(col_t, col_r)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.col_t
    join pg_attribute b on b.attrelid = c.confrelid and b.attnum = k.col_r;

    -- Una FK con NULL no viola nada: es una fila sin relacion, no una huerfana.
    select string_agg(format('t.%I is not null', a.attname), ' and ')
      into no_nulos
    from unnest(c.conkey) as k(col_t)
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.col_t;

    execute format(
      'select count(*) from %s t where %s and not exists (select 1 from %s r where %s)',
      c.tabla, no_nulos, c.referencia, condicion
    ) into huerfanos;

    revisadas := revisadas + 1;

    if huerfanos > 0 then
      raise warning 'INTEGRIDAD: % fila(s) de % violan % (apunta a %)',
        huerfanos, c.tabla, c.conname, c.referencia;
      fallas := fallas + 1;
    end if;
  end loop;

  if fallas > 0 then
    raise exception 'REVENTO: % de % clave(s) foranea(s) con filas huerfanas',
      fallas, revisadas;
  end if;

  raise notice 'OK: % clave(s) foranea(s) sin huerfanos.', revisadas;
end
$verificacion$;
