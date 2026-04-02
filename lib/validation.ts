/**
 * Utilidades de validación y sanitización de inputs.
 * Se usan tanto en client-side (forms) como server-side (API routes).
 */

// --- Sanitización ---

/** Elimina caracteres de control (excepto newline/tab) y recorta espacios */
export function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return ''
  // Eliminar caracteres de control excepto \n y \t
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
}

/** Sanitiza y limita la longitud de un string */
export function sanitizeAndLimit(value: unknown, maxLength: number): string {
  return sanitizeString(value).slice(0, maxLength)
}

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

// --- Límites de longitud para campos de texto libre ---

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
} as const

// --- Validación server-side para create-traslado-safe ---

export interface TrasladoInput {
  user_id: string
  empresa_id: string
  chofer_id: string
  marca_modelo: string
  matricula?: string | null
  es_0km?: boolean
  importe_total?: string | number | null
  observaciones?: string | null
  desde?: string | null
  hasta?: string | null
  fecha?: string | null
}

export function validateTrasladoInput(body: Record<string, unknown>): { valid: true; data: TrasladoInput } | { valid: false; error: string } {
  const userId = sanitizeString(body.user_id)
  const empresaId = sanitizeString(body.empresa_id)
  const choferId = sanitizeString(body.chofer_id)
  const marcaModelo = sanitizeAndLimit(body.marca_modelo, LIMITS.marcaModelo)

  // UUIDs requeridos
  if (!isValidUUID(userId)) return { valid: false, error: 'user_id inválido' }
  if (!isValidUUID(empresaId)) return { valid: false, error: 'empresa_id inválido' }
  if (!isValidUUID(choferId)) return { valid: false, error: 'chofer_id inválido' }

  // marca_modelo requerido
  if (!marcaModelo) return { valid: false, error: 'marca_modelo es requerido' }

  // Matrícula opcional
  const es0km = !!body.es_0km
  let matricula: string | null = null
  if (!es0km && body.matricula) {
    matricula = sanitizeAndLimit(body.matricula, LIMITS.matricula)
    if (matricula && !isValidMatricula(matricula)) {
      return { valid: false, error: 'Formato de matrícula inválido' }
    }
  }

  // Importe opcional pero si viene, debe ser válido
  let importeTotal: string | number | null = null
  if (body.importe_total !== undefined && body.importe_total !== null && body.importe_total !== '') {
    if (!isValidImporte(body.importe_total)) {
      return { valid: false, error: 'Importe inválido (debe ser un número positivo)' }
    }
    importeTotal = body.importe_total as string | number
  }

  // Textos opcionales con límite
  const observaciones = body.observaciones ? sanitizeAndLimit(body.observaciones, LIMITS.observaciones) : null
  const desde = body.desde ? sanitizeAndLimit(body.desde, LIMITS.ubicacion) : null
  const hasta = body.hasta ? sanitizeAndLimit(body.hasta, LIMITS.ubicacion) : null

  // Fecha opcional: debe ser YYYY-MM-DD y no puede ser futura
  let fecha: string | null = null
  if (body.fecha) {
    const fechaStr = sanitizeString(body.fecha)
    if (!isValidFecha(fechaStr)) {
      return { valid: false, error: 'Formato de fecha inválido (se esperaba YYYY-MM-DD)' }
    }
    const fechaDate = new Date(fechaStr)
    const hoy = new Date()
    hoy.setHours(23, 59, 59, 999)
    if (fechaDate > hoy) {
      return { valid: false, error: 'La fecha no puede ser futura' }
    }
    fecha = fechaStr
  }

  return {
    valid: true,
    data: {
      user_id: userId,
      empresa_id: empresaId,
      chofer_id: choferId,
      marca_modelo: marcaModelo,
      matricula,
      es_0km: es0km,
      importe_total: importeTotal,
      observaciones,
      desde,
      hasta,
      fecha,
    },
  }
}

// --- Validación de preapprovalId (Mercado Pago) ---

export function isValidPreapprovalId(id: unknown): boolean {
  return typeof id === 'string' && id.length > 0 && id.length < 100 && /^[a-zA-Z0-9_-]+$/.test(id)
}

// --- Validación para gastos ---

const TIPOS_GASTO_VALIDOS = ['combustible', 'seguro', 'mantenimiento', 'peaje', 'patente', 'multa', 'otro']

export function isValidTipoGasto(value: string): boolean {
  return TIPOS_GASTO_VALIDOS.includes(value)
}

export function isValidFecha(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value)
  return !isNaN(date.getTime())
}
