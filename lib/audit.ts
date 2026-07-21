import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
  details?: Record<string, unknown>
  ip?: string | null
}

/**
 * Logs an auditable event. Failures are silently swallowed —
 * audit logging should never block the main operation.
 */
export async function auditLog(params: AuditLogParams): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('audit_log')
      .insert({
        user_id: params.userId,
        empresa_id: params.empresaId,
        action: params.action,
        details: params.details || {},
        ip_address: params.ip,
      })

    if (error) {
      // Silently fail — don't block the main operation
      console.warn('Audit log failed:', error.message)
    }
  } catch {
    // Silently fail
  }
}
