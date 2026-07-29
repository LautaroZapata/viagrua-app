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
    { refreshInterval: 30000 }
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
    }
  )
}
