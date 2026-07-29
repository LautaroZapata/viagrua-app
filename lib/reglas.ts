/**
 * Reglas de negocio en JavaScript plano, sin dependencias.
 *
 * Las usan los esquemas de zod (servidor) y los validadores por campo de los
 * formularios (cliente). Viven acá y no en schemas.ts para que el cliente no
 * tenga que importar zod: validation.ts importaba de schemas.ts, y con eso zod
 * entero terminaba en el bundle de cualquier página que validara un campo.
 *
 * Que la regla esté escrita una sola vez es el punto; que la fuente sea zod no
 * lo era.
 */

/**
 * Tipos de gasto aceptados. Espeja el CHECK gastos_tipo_check de la base: si se
 * agrega uno hay que tocar los dos lados, y el test de contrato lo verifica.
 */
export const TIPOS_GASTO = [
  'combustible', 'seguro', 'mantenimiento', 'peaje', 'patente', 'multa', 'otro',
] as const

export type TipoGasto = (typeof TIPOS_GASTO)[number]

export function esTipoGastoValido(valor: unknown): valor is TipoGasto {
  return typeof valor === 'string' && (TIPOS_GASTO as readonly string[]).includes(valor)
}

/**
 * Fecha YYYY-MM-DD que además existe en el calendario.
 *
 * La forma no alcanza: 2024-02-30 la cumple y no existe. Se reconstruye con
 * Date en UTC y se compara, porque el constructor desborda en silencio
 * (2024-02-30 se vuelve 2024-03-01).
 */
export function esFechaCalendarioValida(valor: unknown): boolean {
  if (typeof valor !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (!match) return false

  const anio = Number(match[1])
  const mes = Number(match[2])
  const dia = Number(match[3])

  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  )
}

/** Un traslado no puede haber ocurrido en el futuro. Se compara contra el fin del día. */
export function esFechaNoFutura(valor: string): boolean {
  const finDeHoy = new Date()
  finDeHoy.setHours(23, 59, 59, 999)
  return new Date(valor) <= finDeHoy
}
