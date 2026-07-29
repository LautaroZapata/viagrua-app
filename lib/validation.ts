/**
 * Sanitización de inputs y chequeos sueltos por campo para los formularios.
 *
 * Las reglas de negocio viven en lib/schemas.ts; lo que hay acá son las
 * primitivas de limpieza (que los esquemas usan por dentro) y unos wrappers
 * delgados para validar de a un campo mientras el usuario escribe.
 */
import { tipoGasto, fechaCalendario } from './schemas'

// Se re-exportan para no tener que tocar los ~20 imports que ya las usaban
// desde acá. La definición vive en sanitize.ts, que no depende de nada: si
// viviera acá, schemas.ts y validation.ts se importarían mutuamente y LIMITS
// quedaba en undefined al evaluar los esquemas.
export { sanitizeString, sanitizeAndLimit, LIMITS } from './sanitize'

// --- Validaciones ---

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUUID(value: unknown): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value) && value.length <= 254
}

export function isValidPassword(value: string): boolean {
  return value.length >= 6 && value.length <= 128
}

export function isValidName(value: string): boolean {
  return value.length >= 1 && value.length <= 100
}

export function isValidCompanyName(value: string): boolean {
  return value.length >= 1 && value.length <= 150
}

/** Valida que un importe sea un número positivo razonable */
export function isValidImporte(value: unknown): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value)
  return !isNaN(num) && num >= 0 && num <= 99_999_999
}

/** Valida una matrícula (formato flexible, solo alfanuméricos y guiones) */
const MATRICULA_REGEX = /^[A-Za-z0-9\s\-]{1,15}$/

export function isValidMatricula(value: string): boolean {
  return MATRICULA_REGEX.test(value)
}

/** Valida un código de invitación (alfanumérico, longitud razonable) */
const CODIGO_REGEX = /^[A-Za-z0-9\-_]{3,50}$/

export function isValidCodigoInvitacion(value: string): boolean {
  return CODIGO_REGEX.test(value)
}

/**
 * Detecta el error de email duplicado de Supabase Auth.
 *
 * El mensaje real es "A user with this email address has already been
 * registered", asi que buscar la subcadena 'already registered' no matchea y el
 * alta terminaba devolviendo un 500 generico en vez de un 409 con un mensaje
 * util. Se chequea tambien el code, que es lo estable.
 */
export function esEmailDuplicado(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === 'email_exists') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('already') && msg.includes('registered')
}

// --- Validaciones derivadas de los esquemas ---
//
// Estas envuelven lo que ya define lib/schemas.ts. Existen porque los
// formularios las usan como chequeo suelto por campo, pero la regla vive en el
// esquema: asi no hay dos definiciones de "que es un tipo de gasto valido" que
// se puedan desincronizar, que es justo lo que paso antes.

export function isValidTipoGasto(value: string): boolean {
  return tipoGasto.safeParse(value).success
}

export function isValidFecha(value: string): boolean {
  return fechaCalendario.safeParse(value).success
}
