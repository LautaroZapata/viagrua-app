import { toast } from 'sonner'

/**
 * Confirmación para acciones destructivas (eliminar, expulsar).
 * Retorna true si el usuario confirma.
 */
export async function confirmDelete(options: {
  title?: string
  text: string
  confirmButtonText?: string
}): Promise<boolean> {
  return new Promise((resolve) => {
    toast(options.title ?? '¿Estás seguro?', {
      description: options.text,
      action: {
        label: options.confirmButtonText ?? 'Sí, eliminar',
        onClick: () => resolve(true),
      },
      cancel: {
        label: 'Cancelar',
        onClick: () => resolve(false),
      },
      duration: Infinity,
      style: {
        '--normal-bg': 'white',
        '--normal-text': '#111827',
        '--normal-border': '#e5e7eb',
      } as React.CSSProperties,
    })
  })
}

/**
 * Confirmación genérica para acciones que requieren confirmar.
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
        label: options.confirmButtonText ?? 'Sí, confirmar',
        onClick: () => resolve(true),
      },
      cancel: {
        label: 'Cancelar',
        onClick: () => resolve(false),
      },
      duration: Infinity,
      style: {
        '--normal-bg': 'white',
        '--normal-text': '#111827',
        '--normal-border': '#e5e7eb',
      } as React.CSSProperties,
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
 * Muestra un mensaje de éxito.
 */
export function showSuccess(message: string): void {
  toast.success('Listo', { description: message })
}
