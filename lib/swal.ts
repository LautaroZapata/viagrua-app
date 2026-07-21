import { toast } from 'sonner'

/**
 * Confirmacion para acciones destructivas (eliminar, expulsar).
 * Retorna true si el usuario confirma.
 */
export async function confirmDelete(options: {
  title?: string
  text: string
  confirmButtonText?: string
}): Promise<boolean> {
  return new Promise((resolve) => {
    toast(options.title ?? '¿Estas seguro?', {
      description: options.text,
      action: {
        label: options.confirmButtonText ?? 'Si, eliminar',
        onClick: () => resolve(true),
      },
      cancel: {
        label: 'Cancelar',
        onClick: () => resolve(false),
      },
      duration: Infinity,
    })
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
  return new Promise((resolve) => {
    toast(options.title, {
      description: options.text,
      action: {
        label: options.confirmButtonText ?? 'Si, confirmar',
        onClick: () => resolve(true),
      },
      cancel: {
        label: 'Cancelar',
        onClick: () => resolve(false),
      },
      duration: Infinity,
    })
  })
}

/**
 * Muestra un mensaje de error.
 */
export function showError(message: string): void {
  toast.error('Error', { description: message })
}

/**
 * Muestra un mensaje de exito.
 */
export function showSuccess(message: string): void {
  toast.success('Listo', { description: message })
}
