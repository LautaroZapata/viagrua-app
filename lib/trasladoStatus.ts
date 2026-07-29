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

/**
 * Estilos de los botones que cambian el estado en la pantalla de detalle. Es
 * otra forma que la del badge de las listas: ahi el estado se muestra, aca se
 * elige, y el seleccionado va en color solido.
 */
export interface OpcionToggle {
  valor: string
  label: string
  activo: string
  inactivo: string
}

const INACTIVO = 'bg-muted text-muted-foreground hover:bg-accent'

export const OPCIONES_ESTADO: OpcionToggle[] = [
  { valor: 'pendiente', label: 'Pendiente', activo: 'bg-yellow-500 text-white', inactivo: INACTIVO },
  { valor: 'en_curso', label: 'En curso', activo: 'bg-blue-500 text-white', inactivo: INACTIVO },
  { valor: 'completado', label: 'Completado', activo: 'bg-emerald-500 text-white', inactivo: INACTIVO },
]

export const OPCIONES_PAGO: OpcionToggle[] = [
  { valor: 'pendiente', label: 'Pendiente', activo: 'bg-yellow-500 text-white', inactivo: INACTIVO },
  { valor: 'efectivo', label: 'Efectivo', activo: 'bg-emerald-500 text-white', inactivo: INACTIVO },
  { valor: 'transferencia', label: 'Transferencia', activo: 'bg-blue-500 text-white', inactivo: INACTIVO },
]

export function estiloEstado(estado: string | null | undefined): EstiloEstado {
  if (!estado) return DESCONOCIDO
  return ESTADOS[estado] ?? DESCONOCIDO
}

export function estiloPago(estadoPago: string | null | undefined): EstiloEstado {
  if (!estadoPago) return DESCONOCIDO
  return PAGOS[estadoPago] ?? DESCONOCIDO
}
