import useSWR, { type SWRConfiguration } from 'swr'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/db'

/**
 * Tipos derivados del esquema real. Antes estaban escritos a mano y declaraban
 * como no-nulas varias columnas que en la base si lo son, con lo cual el
 * compilador no avisaba de ningun acceso a null.
 */
export type Gasto = Pick<
  Tables<'gastos'>,
  'id' | 'tipo' | 'importe' | 'descripcion' | 'fecha' | 'created_at' | 'usuario_id'
> & {
  perfiles?: { nombre_completo: string | null } | { nombre_completo: string | null }[] | null
}

export type Traslado = Pick<
  Tables<'traslados'>,
  | 'id' | 'marca_modelo' | 'matricula' | 'es_0km' | 'estado' | 'estado_pago'
  | 'importe_total' | 'observaciones' | 'created_at'
> & {
  perfiles?: { nombre_completo: string | null } | null
}

/** Lo que muestran las listas de equipo: dashboard y /dashboard/choferes. */
export type Chofer = Pick<Tables<'perfiles'>, 'id' | 'nombre_completo' | 'email'>

/** Lo que necesita el select de asignacion en /dashboard/nuevo-traslado. */
export type MiembroEmpresa = Pick<Tables<'perfiles'>, 'id' | 'nombre_completo' | 'rol'>

/** El listado del chofer trae mas columnas que el del admin: destino y empresa. */
export type TrasladoDeChofer = Pick<
  Tables<'traslados'>,
  | 'id' | 'marca_modelo' | 'matricula' | 'es_0km' | 'estado' | 'estado_pago'
  | 'importe_total' | 'observaciones' | 'created_at' | 'departamento' | 'direccion'
  | 'desde' | 'hasta'
> & {
  empresas?: { nombre: string } | null
}

/** El detalle trae la fila entera: la vista muestra casi todas las columnas. */
export type TrasladoDetalleAdmin = Tables<'traslados'> & {
  perfiles?: { nombre_completo: string | null } | null
}

export type TrasladoDetalleChofer = Tables<'traslados'> & {
  empresas?: { nombre: string } | null
}

interface TrasladosCounts {
  total: number
  pendiente: number
  en_curso: number
  completado: number
}

type SupabaseQueryFn<T> = () => PromiseLike<{ data: T | null; error: unknown }>

export function useSupabaseQuery<T>(
  key: string | null,
  queryFn: SupabaseQueryFn<T>,
  options?: SWRConfiguration<T>
) {
  const fetcher = async (): Promise<T> => {
    const { data, error } = await queryFn()
    if (error) throw error
    return data as T
  }

  return useSWR<T>(key, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
    ...options,
  })
}

export function useGastos(empresaId: string | null, userId: string | null, isAdmin: boolean) {
  return useSupabaseQuery<Gasto[]>(
    empresaId ? `gastos:${empresaId}:${isAdmin ? 'all' : userId}` : null,
    () => {
      const query = supabase
        .from('gastos')
        .select('id, tipo, importe, descripcion, fecha, created_at, usuario_id, perfiles(nombre_completo)')
        .order('fecha', { ascending: false })
        .limit(500)

      return (isAdmin
        ? query.eq('empresa_id', empresaId!)
        : query.eq('usuario_id', userId!)) as unknown as PromiseLike<{ data: Gasto[] | null; error: unknown }>
    },
    // Sin refreshInterval: hacia polling contra la base cada 30 segundos de
    // forma indefinida, encima de revalidateOnFocus, que ya cubre el caso real
    // (volver a la pestaña). Los gastos los carga el propio usuario y ya se
    // revalidan al mutar.
  )
}

export interface MesResumen {
  mes: string
  ingresos: number
  gastos: number
}

/**
 * Serie mensual de ingresos y gastos, agregada en Postgres.
 *
 * Antes el dashboard traia hasta 2000 filas para dibujar seis barras, y el
 * limit(1000) truncaba en silencio a las empresas con mas movimiento.
 */
export function useResumenMensual(empresaId: string | null, meses = 6) {
  return useSupabaseQuery<MesResumen[]>(
    empresaId ? `resumen-mensual:${empresaId}:${meses}` : null,
    () => supabase.rpc('get_resumen_mensual', { p_empresa_id: empresaId!, p_meses: meses }) as unknown as
      PromiseLike<{ data: MesResumen[] | null; error: unknown }>,
  )
}

/** Total cobrado de la empresa. Antes eran 1000 filas para un reduce(). */
export function useTotalIngresos(empresaId: string | null) {
  return useSupabaseQuery<number>(
    empresaId ? `total-ingresos:${empresaId}` : null,
    () => supabase.rpc('get_total_ingresos', { p_empresa_id: empresaId! }) as unknown as
      PromiseLike<{ data: number | null; error: unknown }>,
  )
}

export function useTrasladosCounts(empresaId: string | null) {
  return useSupabaseQuery<TrasladosCounts>(
    empresaId ? `traslados-counts:${empresaId}` : null,
    () => supabase.rpc('get_traslados_counts', { p_empresa_id: empresaId! }) as unknown as
      PromiseLike<{ data: TrasladosCounts | null; error: unknown }>,
  )
}

export function useTraslados(
  empresaId: string | null,
  page: number,
  filtroTrasladosPendientes: boolean,
  filtroPagosPendientes: boolean
) {
  const ITEMS_PER_PAGE = 10
  const from = (page - 1) * ITEMS_PER_PAGE
  const to = page * ITEMS_PER_PAGE - 1
  const key = empresaId
    ? `traslados:${empresaId}:${page}:${filtroTrasladosPendientes}:${filtroPagosPendientes}`
    : null

  return useSWR<{ data: Traslado[]; count: number }>(
    key,
    async () => {
      let query = supabase
        .from('traslados')
        .select('id, marca_modelo, matricula, es_0km, estado, estado_pago, importe_total, observaciones, created_at, perfiles(nombre_completo)', { count: 'exact' })
        .eq('empresa_id', empresaId!)
      if (filtroTrasladosPendientes) query = query.eq('estado', 'pendiente')
      if (filtroPagosPendientes) query = query.eq('estado_pago', 'pendiente')
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as unknown as Traslado[], count: count || 0 }
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      // Cambiar de pagina no vuelve al esqueleto: se sigue viendo la pagina
      // anterior, en gris, mientras llega la nueva. Sin esto la lista
      // desaparece entera en cada click de paginado.
      keepPreviousData: true,
    }
  )
}

/**
 * El equipo de choferes de la empresa.
 *
 * La comparten el dashboard y /dashboard/choferes, que hacian exactamente la
 * misma query cada uno por su cuenta. Con la misma clave de SWR, ir de una a
 * otra ya no dispara nada: la segunda pantalla se dibuja con lo que trajo la
 * primera y revalida atras.
 */
export function useChoferes(empresaId: string | null) {
  return useSupabaseQuery<Chofer[]>(
    empresaId ? `choferes:${empresaId}` : null,
    () => supabase
      .from('perfiles')
      .select('id, nombre_completo, email')
      .eq('empresa_id', empresaId!)
      .eq('rol', 'chofer') as unknown as PromiseLike<{ data: Chofer[] | null; error: unknown }>,
  )
}

/**
 * Choferes **y** admins: el alta de traslado permite asignarselo a cualquiera
 * de los dos. Clave aparte de useChoferes justamente porque el conjunto de
 * filas es otro; compartirla dejaria al admin fuera del select.
 */
export function useMiembrosEmpresa(empresaId: string | null) {
  return useSupabaseQuery<MiembroEmpresa[]>(
    empresaId ? `miembros:${empresaId}` : null,
    () => supabase
      .from('perfiles')
      .select('id, nombre_completo, rol')
      .eq('empresa_id', empresaId!)
      .in('rol', ['chofer', 'admin']) as unknown as PromiseLike<{ data: MiembroEmpresa[] | null; error: unknown }>,
  )
}

/** Los traslados asignados a un chofer. Es la pantalla principal del chofer. */
export function useTrasladosChofer(
  choferId: string | null,
  page: number,
  filtroTrasladosPendientes: boolean,
  filtroPagosPendientes: boolean
) {
  const ITEMS_PER_PAGE = 10
  const from = (page - 1) * ITEMS_PER_PAGE
  const to = page * ITEMS_PER_PAGE - 1
  const key = choferId
    ? `traslados-chofer:${choferId}:${page}:${filtroTrasladosPendientes}:${filtroPagosPendientes}`
    : null

  return useSWR<{ data: TrasladoDeChofer[]; count: number }>(
    key,
    async () => {
      let query = supabase
        .from('traslados')
        .select('id, marca_modelo, matricula, es_0km, estado, estado_pago, importe_total, observaciones, created_at, departamento, direccion, empresas(nombre), desde, hasta', { count: 'exact' })
        .eq('chofer_id', choferId!)
      if (filtroTrasladosPendientes) query = query.eq('estado', 'pendiente')
      if (filtroPagosPendientes) query = query.eq('estado_pago', 'pendiente')
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      // El embed de empresas llega como array cuando PostgREST no puede probar
      // que la relacion es a-uno. Se normaliza aca y no en la vista.
      const filas = (data ?? []).map((t: Record<string, unknown>) => ({
        ...t,
        empresas: Array.isArray(t.empresas) ? t.empresas[0] : t.empresas,
      })) as unknown as TrasladoDeChofer[]
      return { data: filas, count: count || 0 }
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  )
}

/**
 * Opciones del detalle de un traslado.
 *
 * `shouldRetryOnError: false`: un traslado que no existe, o que no es de esta
 * empresa, devuelve error y la vista redirige. Reintentar con backoff seria
 * martillar la base por una fila que no va a aparecer.
 */
const OPCIONES_DETALLE: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
  shouldRetryOnError: false,
}

/** Detalle para el admin. Acotado por empresa: la RLS no es la unica barrera. */
export function useTrasladoAdmin(id: string | null, empresaId: string | null) {
  return useSupabaseQuery<TrasladoDetalleAdmin>(
    id && empresaId ? `traslado-admin:${id}:${empresaId}` : null,
    () => supabase
      .from('traslados')
      .select('*, perfiles(nombre_completo)')
      .eq('id', id!)
      .eq('empresa_id', empresaId!)
      .single() as unknown as PromiseLike<{ data: TrasladoDetalleAdmin | null; error: unknown }>,
    OPCIONES_DETALLE,
  )
}

/** Detalle para el chofer. Acotado a los traslados que tiene asignados. */
export function useTrasladoChofer(id: string | null, choferId: string | null) {
  return useSupabaseQuery<TrasladoDetalleChofer>(
    id && choferId ? `traslado-chofer:${id}:${choferId}` : null,
    () => supabase
      .from('traslados')
      .select('*, empresas(nombre)')
      .eq('id', id!)
      .eq('chofer_id', choferId!)
      .single() as unknown as PromiseLike<{ data: TrasladoDetalleChofer | null; error: unknown }>,
    OPCIONES_DETALLE,
  )
}
