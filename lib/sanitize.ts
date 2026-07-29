/**
 * Primitivas de limpieza de texto y limites de longitud.
 *
 * Modulo aparte y sin dependencias a proposito: lo usan tanto lib/schemas.ts
 * como lib/validation.ts, y tenerlo en cualquiera de los dos creaba un ciclo de
 * imports que dejaba LIMITS en undefined al evaluar los esquemas.
 */

/** Elimina caracteres de control (salvo newline y tab) y recorta espacios. */
export function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return ''
  // El rango \x00-\x1F es intencional: son caracteres de control, no texto.
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
}

/** Sanitiza y recorta a `maxLength`. */
export function sanitizeAndLimit(value: unknown, maxLength: number): string {
  return sanitizeString(value).slice(0, maxLength)
}

/** Topes de longitud de los campos de texto libre. */
export const LIMITS = {
  nombre: 100,
  email: 254,
  password: 128,
  empresa: 150,
  marcaModelo: 100,
  matricula: 15,
  observaciones: 1000,
  descripcion: 500,
  ubicacion: 200,  // desde/hasta
  codigoInvitacion: 50,
  telefono: 30,    // espeja el CHECK perfiles_telefono_largo
} as const
