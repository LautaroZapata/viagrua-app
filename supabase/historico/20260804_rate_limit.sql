-- =============================================================
-- Rate limiting compartido entre instancias
-- =============================================================
-- lib/rateLimit.ts era un Map en memoria del modulo. En serverless cada
-- instancia tiene el suyo y se reinicia en cada cold start, asi que el limite
-- de 5 intentos por minuto del login era en realidad 5 por instancia, y se
-- reseteaba solo. Como control, no existia.
--
-- Se resuelve en Postgres en vez de sumar Redis: el contador tiene que ser
-- compartido entre instancias, y la base ya esta ahi. Para endpoints de auth,
-- que son de bajo volumen, un round trip mas es intrascendente al lado de la
-- verificacion de contraseña que viene despues.

create table if not exists public.rate_limits (
  clave text primary key,
  contador integer not null default 0,
  ventana_inicio timestamptz not null default now()
);

create index if not exists idx_rate_limits_ventana
  on public.rate_limits(ventana_inicio);

alter table public.rate_limits enable row level security;

-- Sin policies: solo service_role entra, y service_role ignora RLS.
revoke all on public.rate_limits from anon, authenticated;

/**
 * Consume una unidad del cupo de `p_clave` y dice si la request sigue.
 *
 * Ventana fija con INSERT ... ON CONFLICT: una sola sentencia, atomica, sin
 * chance de que dos requests concurrentes lean el mismo contador.
 */
create or replace function public.consumir_rate_limit(
  p_clave text,
  p_max integer,
  p_ventana_segundos integer
)
returns table (permitido boolean, reintentar_en integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ahora timestamptz := now();
  v_corte timestamptz := v_ahora - make_interval(secs => p_ventana_segundos);
  v_contador integer;
  v_inicio timestamptz;
begin
  -- Limpieza oportunista: sin esto la tabla crece con una fila por IP para
  -- siempre. Se hace de vez en cuando para no pagarla en cada request.
  if random() < 0.01 then
    delete from public.rate_limits
     where ventana_inicio < v_ahora - interval '1 day';
  end if;

  insert into public.rate_limits as rl (clave, contador, ventana_inicio)
  values (p_clave, 1, v_ahora)
  on conflict (clave) do update
    set contador = case when rl.ventana_inicio < v_corte then 1 else rl.contador + 1 end,
        ventana_inicio = case when rl.ventana_inicio < v_corte then v_ahora else rl.ventana_inicio end
  returning rl.contador, rl.ventana_inicio into v_contador, v_inicio;

  return query select
    v_contador <= p_max,
    greatest(
      ceil(extract(epoch from (v_inicio + make_interval(secs => p_ventana_segundos) - v_ahora)))::integer,
      0
    );
end;
$$;

revoke execute on function public.consumir_rate_limit(text, integer, integer) from public, anon, authenticated;
