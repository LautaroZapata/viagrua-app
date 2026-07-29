-- =============================================================
-- Agregados en Postgres en vez de en el navegador
-- =============================================================
-- El dashboard traia hasta 2000 filas (1000 gastos + 1000 traslados) para
-- dibujar seis barras mensuales, y la pantalla de gastos traia 1000 traslados
-- para hacer un reduce() y mostrar UN numero. Todo eso viajaba por la red y se
-- procesaba en el telefono del usuario.
--
-- Ademas ese limit(1000) truncaba en silencio: una empresa con mas movimientos
-- veia un grafico incompleto sin ningun aviso.
--
-- Las dos funciones son SECURITY DEFINER y validan que el llamador pertenezca a
-- la empresa pedida, igual que get_traslados_counts.

-- -------------------------------------------------------------
-- Serie mensual de ingresos y gastos
-- -------------------------------------------------------------
create or replace function public.get_resumen_mensual(
  p_empresa_id uuid,
  p_meses integer default 6
)
returns table (mes text, ingresos numeric, gastos numeric)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with limites as (
    select date_trunc('month', now()) - make_interval(months => greatest(p_meses, 1) - 1) as desde
  ),
  meses as (
    select to_char(generate_series(
      (select desde from limites),
      date_trunc('month', now()),
      interval '1 month'
    ), 'YYYY-MM') as mes
  ),
  ing as (
    select to_char(date_trunc('month', created_at), 'YYYY-MM') as mes,
           sum(coalesce(importe_total, 0)) as total
      from public.traslados
     where empresa_id = p_empresa_id
       and estado = 'completado'
       and estado_pago <> 'pendiente'
       and created_at >= (select desde from limites)
     group by 1
  ),
  gas as (
    select to_char(date_trunc('month', fecha), 'YYYY-MM') as mes,
           sum(coalesce(importe, 0)) as total
      from public.gastos
     where empresa_id = p_empresa_id
       and fecha >= (select desde from limites)::date
     group by 1
  )
  select m.mes,
         coalesce(ing.total, 0)::numeric as ingresos,
         coalesce(gas.total, 0)::numeric as gastos
    from meses m
    left join ing on ing.mes = m.mes
    left join gas on gas.mes = m.mes
   where p_empresa_id = public.get_empresa_id()
   order by m.mes;
$$;

revoke execute on function public.get_resumen_mensual(uuid, integer) from public, anon;
grant execute on function public.get_resumen_mensual(uuid, integer) to authenticated;

-- -------------------------------------------------------------
-- Total de ingresos cobrados de la empresa
-- -------------------------------------------------------------
create or replace function public.get_total_ingresos(p_empresa_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(coalesce(importe_total, 0)), 0)::numeric
    from public.traslados
   where empresa_id = p_empresa_id
     and estado = 'completado'
     and estado_pago <> 'pendiente'
     and p_empresa_id = public.get_empresa_id();
$$;

revoke execute on function public.get_total_ingresos(uuid) from public, anon;
grant execute on function public.get_total_ingresos(uuid) to authenticated;
