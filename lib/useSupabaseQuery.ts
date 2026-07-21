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

type SupabaseQueryFn<T> = () => PromiseLike<{ data: T | null; error: unknown }>

/**
 * Generic SWR hook for Supabase queries.
 * Automatically caches and deduplicates requests.
 */
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
    dedupingInterval: 5000, // 5s dedup
    ...options,
  })
}

/**
 * Hook for fetching the current user's profile.
 */
export function usePerfil(userId: string | null) {
  return useSupabaseQuery(
    userId ? `perfil:${userId}` : null,
    () => supabase.from('perfiles').select('id, email, nombre_completo, telefono, rol, empresa_id, avatar_url').eq('id', userId!).single(),
  )
}

/**
 * Hook for fetching gastos.
 */
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
    { refreshInterval: 30000 } // Refresh every 30s
  )
}

