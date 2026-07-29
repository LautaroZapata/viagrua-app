import type { Database } from './database.types'

/**
 * Atajos para tipar filas contra el esquema real en vez de a mano.
 *
 *   type Gasto = Tables<'gastos'>
 *   type NuevoGasto = Insert<'gastos'>
 *
 * Regenerar con `pnpm db:types` despues de cada migracion. Escribir estas
 * interfaces a mano fue lo que dejo pasar `user_id` en vez de `usuario_id`, y
 * un update sobre `perfiles.telefono` cuando la columna no existia: los dos
 * fallaron recien en produccion.
 */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Insert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type Update<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

/**
 * Perfil con empresa_id garantizado.
 *
 * En la base empresa_id es nullable: un chofer expulsado queda sin empresa
 * (expulsar_chofer lo pone en NULL). Casi toda la UI asume que hay empresa,
 * asi que conviene estrechar el tipo una sola vez, en el borde, en vez de
 * poner `!` en cada uso.
 */
export type PerfilConEmpresa = Tables<'perfiles'> & { empresa_id: string }

export function tieneEmpresa(
  perfil: Tables<'perfiles'> | null | undefined
): perfil is PerfilConEmpresa {
  return !!perfil?.empresa_id
}
