import Swal from 'sweetalert2'

const defaultConfirmButtonColor = '#ea580c' // orange-600
const dangerConfirmButtonColor = '#dc2626' // red-600

/**
 * Confirmación para acciones destructivas (eliminar, expulsar).
 * Botón rojo. Retorna true si el usuario confirma.
 */
export async function confirmDelete(options: {
  title?: string
  text: string
  confirmButtonText?: string
}): Promise<boolean> {
  const result = await Swal.fire({
    title: options.title ?? '¿Estás seguro?',
    text: options.text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: dangerConfirmButtonColor,
    cancelButtonColor: '#6b7280',
    confirmButtonText: options.confirmButtonText ?? 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  })
  return result.isConfirmed === true
}

/**
 * Confirmación genérica para acciones que requieren confirmar (completar, cambiar método de pago, etc.).
 * Botón naranja. Retorna true si el usuario confirma.
 */
export async function confirmAction(options: {
  title: string
  text: string
  icon?: 'question' | 'warning' | 'info'
  confirmButtonText?: string
}): Promise<boolean> {
  const result = await Swal.fire({
    title: options.title,
    text: options.text,
    icon: options.icon ?? 'question',
    showCancelButton: true,
    confirmButtonColor: defaultConfirmButtonColor,
    cancelButtonColor: '#6b7280',
    confirmButtonText: options.confirmButtonText ?? 'Sí, confirmar',
    cancelButtonText: 'Cancelar',
  })
  return result.isConfirmed === true
}

/**
 * Muestra un mensaje de error.
 */
export function showError(message: string): void {
  Swal.fire({
    icon: 'error',
    title: 'Error',
    text: message,
    confirmButtonColor: defaultConfirmButtonColor,
  })
}

/**
 * Muestra un mensaje de éxito (opcional).
 */
export function showSuccess(message: string): void {
  Swal.fire({
    icon: 'success',
    title: 'Listo',
    text: message,
    timer: 2000,
    showConfirmButton: false,
  })
}
