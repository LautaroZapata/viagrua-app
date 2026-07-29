import 'server-only'
import { waitUntil } from '@vercel/functions'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Json } from '@/lib/database.types'

export type AuditAction =
  | 'login'
  | 'logout'
  | 'signup'
  | 'create_traslado'
  | 'delete_traslado'
  | 'update_traslado_estado'
  | 'create_gasto'
  | 'delete_gasto'
  | 'invite_user'
  | 'join_company'

interface AuditLogParams {
  userId: string | null
  empresaId: string | null
  action: AuditAction
  /** Se guarda en una columna jsonb, asi que tiene que ser serializable. */
  details?: Json
  ip?: string | null
}

async function insertar(params: AuditLogParams): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('audit_log').insert({
      user_id: params.userId,
      empresa_id: params.empresaId,
      action: params.action,
      details: params.details ?? {},
      ip_address: params.ip,
    })

    // No se propaga: auditar no puede voltear la operacion principal. Pero se
    // loguea, porque durante meses esto fallo por una tabla inexistente y el
    // silencio hizo que nadie se enterara.
    if (error) console.warn('audit_log fallo:', error.message)
  } catch (e) {
    console.warn('audit_log fallo:', e)
  }
}

/**
 * Registra un evento auditable sin bloquear la respuesta.
 *
 * Los llamadores no hacen await a proposito, para no sumarle latencia a la
 * operacion. El problema es que en serverless la funcion se congela apenas
 * devuelve la respuesta, asi que un insert sin await se podia perder a mitad de
 * camino. waitUntil le dice al runtime que mantenga vivo el proceso hasta que
 * la promesa termine.
 *
 * Fuera de Vercel (tests, dev local) waitUntil tira error, y ahi se cae al
 * await comun.
 */
export function auditLog(params: AuditLogParams): void {
  const promesa = insertar(params)
  try {
    waitUntil(promesa)
  } catch {
    void promesa
  }
}
