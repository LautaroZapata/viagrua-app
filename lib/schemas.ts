import { z } from 'zod'
import { sanitizeString, sanitizeAndLimit, LIMITS } from './sanitize'
// Las reglas de negocio viven en reglas.ts, en JS plano, y acá se envuelven en
// zod. Al revés (definirlas con zod y consumirlas desde los formularios) metía
// zod en el bundle del cliente.
import { TIPOS_GASTO, esFechaCalendarioValida, esFechaNoFutura } from './reglas'

export { TIPOS_GASTO }

/**
 * Esquemas de entrada, en un solo lugar.
 *
 * Antes cada regla vivia repartida: un validador suelto en validation.ts, un
 * CHECK en la base y el dropdown de la UI, sin nada que los mantuviera juntos.
 * Ese desfasaje ya rompio produccion dos veces. Aca la regla se escribe una vez
 * y el tipo se deriva con z.infer, asi que no puede quedar desincronizado del
 * codigo que lo usa.
 *
 * La sanitizacion va adentro del esquema, con .transform(), para que sea
 * imposible validar sin sanitizar primero.
 */

// --- Piezas reutilizables ---

const textoLimpio = (max: number) =>
  z.unknown().transform((v) => sanitizeAndLimit(v, max))

/**
 * Texto opcional: un string vacío se guarda como NULL, no como ''.
 * En la base son cosas distintas, y `WHERE descripcion IS NULL` no encuentra
 * las filas con cadena vacía.
 */
// .optional() explicito: en zod 4 z.unknown() acepta undefined como valor pero
// no vuelve omitible la clave dentro de un objeto.
const textoOpcional = (max: number) =>
  z.unknown().optional().transform((v) => {
    const limpio = sanitizeAndLimit(v, max)
    return limpio.length > 0 ? limpio : null
  })

/**
 * Identificador con formato 8-4-4-4-12.
 *
 * z.guid() y no z.uuid(): este ultimo exige ademas que la version y la variante
 * sean las de RFC 4122. Estos ids salen de Supabase y solo se comparan o se
 * usan para buscar, asi que atarse a la version agrega fragilidad sin comprar
 * nada. El mensaje va por campo porque "Identificador invalido" no le dice a
 * nadie cual de los tres esta mal.
 */
const uuid = (campo: string) => z.guid(`${campo} inválido`)

const email = z
  .unknown()
  .transform((v) => sanitizeString(v).toLowerCase())
  .pipe(z.string().min(1, 'El email es requerido').max(LIMITS.email).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email invalido'))

const password = z
  .string({ message: 'La contraseña es requerida' })
  .min(6, 'La contraseña debe tener al menos 6 caracteres')
  .max(LIMITS.password, `La contraseña no puede superar los ${LIMITS.password} caracteres`)

const nombrePersona = textoLimpio(LIMITS.nombre)
  .pipe(z.string().min(1, 'El nombre es requerido'))

/**
 * Fecha YYYY-MM-DD que ademas existe en el calendario. z.iso.date() acepta la
 * forma pero no descarta un 2024-02-30, asi que se revalida con Date en UTC.
 */
export const fechaCalendario = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha invalido (se espera YYYY-MM-DD)')
  .refine(esFechaCalendarioValida, 'Esa fecha no existe')

/** Importe en pesos. Acepta string porque llega de un <input>. */
export const importe = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? Number.parseFloat(v) : v))
  .pipe(
    z.number({ message: 'Importe invalido' })
      .min(0, 'El importe no puede ser negativo')
      .max(99_999_999, 'Importe demasiado grande')
  )

export const tipoGasto = z.enum(TIPOS_GASTO, { message: 'Tipo de gasto inválido' })

/** Alfanumerico y guiones. El generador usa 12 chars, pero los viejos son 8. */
export const codigoInvitacion = z
  .unknown()
  .transform((v) => sanitizeString(v))
  .pipe(z.string().regex(/^[A-Za-z0-9\-_]{3,50}$/, 'Codigo de invitacion invalido'))

/** Patente: alfanumerico, espacios y guiones, y no puede ser solo espacios. */
export const matricula = textoLimpio(LIMITS.matricula)
  .pipe(
    z.string()
      .regex(/^[A-Za-z0-9\s\-]{1,15}$/, 'Formato de matricula invalido')
      .refine((v) => v.trim().length > 0, 'La matricula no puede estar vacia')
  )

// --- Esquemas por operacion ---

export const altaEmpresaSchema = z.object({
  nombre_empresa: textoLimpio(LIMITS.empresa).pipe(z.string().min(1, 'El nombre de la empresa es requerido')),
  nombre_duenio: nombrePersona,
  email,
  password,
})
export type AltaEmpresa = z.infer<typeof altaEmpresaSchema>

export const unirseConCodigoSchema = z.object({
  codigo: codigoInvitacion,
  nombre: nombrePersona,
  email,
  password,
})
export type UnirseConCodigo = z.infer<typeof unirseConCodigoSchema>

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'La contraseña es requerida'),
})
export type Login = z.infer<typeof loginSchema>

export const nuevoGastoSchema = z.object({
  empresa_id: uuid('empresa_id'),
  user_id: uuid('user_id'),
  tipo: tipoGasto,
  importe,
  fecha: fechaCalendario,
  descripcion: textoOpcional(LIMITS.descripcion),
})
export type NuevoGasto = z.infer<typeof nuevoGastoSchema>

export const nuevoTrasladoSchema = z
  .object({
    user_id: uuid('user_id'),
    empresa_id: uuid('empresa_id'),
    chofer_id: uuid('chofer_id'),
    marca_modelo: textoLimpio(LIMITS.marcaModelo).pipe(z.string().min(1, 'marca_modelo es requerido')),
    es_0km: z.coerce.boolean().default(false),
    matricula: matricula.nullish(),
    importe_total: importe.nullish(),
    observaciones: textoOpcional(LIMITS.observaciones),
    desde: textoOpcional(LIMITS.ubicacion),
    hasta: textoOpcional(LIMITS.ubicacion),
    fecha: fechaCalendario.nullish(),
  })
  .refine((d) => !d.fecha || esFechaNoFutura(d.fecha), {
    message: 'La fecha no puede ser futura',
    path: ['fecha'],
  })
export type NuevoTraslado = z.infer<typeof nuevoTrasladoSchema>

// --- Helper para las rutas ---

export interface ResultadoParseo<T> {
  ok: boolean
  data?: T
  error?: string
}

/**
 * Corre un esquema y devuelve el primer mensaje de error, que es lo unico que
 * la UI muestra. No se devuelve el detalle completo de zod a proposito: incluye
 * las rutas de los campos y no aporta nada al usuario final.
 */
export function parsear<T extends z.ZodType>(
  schema: T,
  entrada: unknown
): ResultadoParseo<z.infer<T>> {
  const resultado = schema.safeParse(entrada)
  if (resultado.success) return { ok: true, data: resultado.data }
  return { ok: false, error: resultado.error.issues[0]?.message ?? 'Datos invalidos' }
}
