import useSWR, { type SWRConfiguration } from 'swr'
import { supabase } from '@/lib/supabase'

interface Gasto {
  id: string
  tipo: string
  importe: number
  descripcion: string | null
  fecha: string
  created_at: string
  usuario_id: string
  perfiles?: { nombre_completo: string } | { nombre_completo: string }[]
}

interface Traslado {
  id: string
  marca_modelo: string
  matricula: string | null
  es_0km: boolean
  estado: string
  estado_pago: string
  importe_total: number | null
  observaciones: string | null
  created_at: string
  perfiles?: { nombre_completo: string }
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

export function usePerfil(userId: string | null) {
  return useSupabaseQuery(
    userId ? `perfil:${userId}` : null,
    () => supabase.from('perfiles').select('id, email, nombre_completo, telefono, rol, empresa_id, avatar_url').eq('id', userId!).single(),
  )
}

export function useGastos(empresaId: string | null, userId: string | null, isAdmin: boolean) {
  return useSupabaseQuery<Gasto[]>(
    empresaId ? `gastos:${empresaId}:${isAdmin ? 'all' : userId}` : null,
    () => {
      let query = supabase
        .from('gastos')
        .select('id, tipo, importe, descripcion, fecha, created_at, usuario_id, perfiles(nombre_completo)')
        .order('fecha', { ascending: false })
        .limit(500)

      if (isAdmin) {
        query = query.eq('empresa_id', empresaId!)
      } else {
        query = query.eq('usuario_id', userId!)
      }

      return query
    },
    { refreshInterval: 30000 }
  )
}

export function useTrasladosCounts(empresaId: string | null) {
  return useSupabaseQuery<TrasladosCounts>(
    empresaId ? `traslados-counts:${empresaId}` : null,
    () => supabase.rpc('get_traslados_counts', { p_empresa_id: empresaId! }),
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
        .select('*, perfiles(nombre_completo)', { count: 'exact' })
        .eq('empresa_id', empresaId!)
      if (filtroTrasladosPendientes) query = query.eq('estado', 'pendiente')
      if (filtroPagosPendientes) query = query.eq('estado_pago', 'pendiente')
      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: data || [], count: count || 0 }
    },
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  )
}

