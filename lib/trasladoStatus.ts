/**
 * Estados de traslado y de pago, en un solo lugar.
 *
 * Estaba duplicado en cuatro archivos y ya habia divergido: en_curso figuraba
 * como "En Curso" en la lista de admin y "En curso" en la del chofer.
 *
 * estado y estado_pago son nullable en la base, asi que el acceso va por
 * funcion en vez de indexar el objeto directo: `config[t.estado]` con estado
 * null revienta, y ademas no cubre un valor inesperado.
 */

export interface EstiloEstado {
  bg: string
  text: string
  label: string
}

const ESTADOS: Record<string, EstiloEstado> = {
  pendiente: {
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    text: 'text-yellow-700 dark:text-yellow-400',
    label: 'Pendiente',
  },
  en_curso: {
    bg: 'bg-blue-500/10 border-blue-500/20',
    text: 'text-blue-700 dark:text-blue-400',
    label: 'En curso',
  },
  completado: {
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Completado',
  },
}

const PAGOS: Record<string, EstiloEstado> = {
  pendiente: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-700 dark:text-yellow-400',
    label: 'Pendiente',
  },
  efectivo: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Efectivo',
  },
  transferencia: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-400',
    label: 'Transfer.',
  },
}

const DESCONOCIDO: EstiloEstado = {
  bg: 'bg-muted',
  text: 'text-muted-foreground',
  label: 'Sin estado',
}

export function estiloEstado(estado: string | null | undefined): EstiloEstado {
  if (!estado) return DESCONOCIDO
  return ESTADOS[estado] ?? DESCONOCIDO
}

export function estiloPago(estadoPago: string | null | undefined): EstiloEstado {
  if (!estadoPago) return DESCONOCIDO
  return PAGOS[estadoPago] ?? DESCONOCIDO
}
