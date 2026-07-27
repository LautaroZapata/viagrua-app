import { toast } from 'sonner'
import { requestConfirm } from './confirmStore'

/**
 * Confirmacion para acciones destructivas (eliminar, expulsar).
 * Retorna true si el usuario confirma.
 *
 * Abre el modal centrado de app/components/ConfirmDialog.tsx.
 */
export async function confirmDelete(options: {
  title?: string
  text: string
  confirmButtonText?: string
}): Promise<boolean> {
  return requestConfirm({
    title: options.title ?? '¿Estas seguro?',
    text: options.text,
    confirmButtonText: options.confirmButtonText ?? 'Si, eliminar',
    cancelButtonText: 'Cancelar',
    tone: 'destructive',
  })
}

/**
 * Confirmacion generica para acciones que requieren confirmar.
 * Retorna true si el usuario confirma.
 */
export async function confirmAction(options: {
  title: string
  text: string
  icon?: 'question' | 'warning' | 'info'
  confirmButtonText?: string
}): Promise<boolean> {
  return requestConfirm({
    title: options.title,
    text: options.text,
    confirmButtonText: options.confirmButtonText ?? 'Si, confirmar',
    cancelButtonText: 'Cancelar',
    tone: options.icon === 'warning' ? 'destructive' : 'default',
  })
}

/**
 * Muestra un mensaje de error.
 */
export function showError(message: string): void {
  toast.error(message, { duration: 6000 })
}

/**
 * Muestra un mensaje de exito.
 */
export function showSuccess(message: string): void {
  toast.success(message)
}
