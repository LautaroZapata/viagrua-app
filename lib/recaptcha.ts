import 'server-only'

/**
 * Verificacion de reCAPTCHA v3 contra Google.
 *
 * v3 no le muestra nada al usuario: corre en segundo plano y devuelve un score
 * de 0 a 1, donde 1 es "casi seguro humano". No hay casilla que tildar, asi que
 * el unico lugar donde se decide es aca.
 *
 * Complementa al rate limiting, no lo reemplaza. El cupo frena el volumen (mil
 * intentos desde una IP); el captcha frena la automatizacion (un script con
 * proxies rotativos, que pasa el cupo porque cada intento viene de otra IP).
 */

const SECRET = process.env.RECAPTCHA_SECRET_KEY ?? ''

/**
 * Sin secret, la verificacion se saltea entera.
 *
 * En local y en el build de CI no hay keys, y ninguno de los dos deberia
 * quedarse sin poder loguearse ni pegarle a la API de Google en cada test.
 */
export const RECAPTCHA_ACTIVO = SECRET.length > 0

/**
 * Debajo de este score se rechaza. 0.5 es el corte que recomienda Google y el
 * que conviene mientras no haya trafico real para calibrar: en el panel de
 * reCAPTCHA se ve la distribucion de scores y ahi se ajusta con datos.
 */
const UMBRAL = Number(process.env.RECAPTCHA_MIN_SCORE ?? '0.5')

/**
 * Google a veces tarda. Sin corte, un pico de latencia de su lado deja los
 * logins colgados hasta el timeout de la funcion.
 */
const TIMEOUT_MS = 5_000

export interface ResultadoRecaptcha {
  permitido: boolean
  /** Para el log del servidor. Nunca se le muestra al usuario. */
  motivo?: string
  score?: number
}

interface RespuestaSiteverify {
  success?: boolean
  score?: number
  action?: string
  hostname?: string
  'error-codes'?: string[]
}

/**
 * @param token   Lo que mando el navegador en el header X-Recaptcha-Token.
 * @param accion  La accion con la que se genero el token del lado del cliente.
 *                Tiene que coincidir: sin este chequeo, un token sacado del
 *                formulario publico de alta sirve para martillar el login.
 * @param exigirToken  Que hacer cuando no llega token. Ver la nota en cada
 *                ruta: no es la misma decision en el login que en el alta.
 */
export async function verificarRecaptcha(
  token: string | null,
  accion: string,
  exigirToken: boolean
): Promise<ResultadoRecaptcha> {
  if (!RECAPTCHA_ACTIVO) {
    return { permitido: true, motivo: 'sin-configurar' }
  }

  if (!token) {
    return { permitido: !exigirToken, motivo: 'sin-token' }
  }

  let datos: RespuestaSiteverify
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: SECRET, response: token }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })

    if (!res.ok) {
      // Igual criterio que en rateLimit.ts: que se caiga un servicio externo no
      // puede dejar afuera a los usuarios de verdad. Un atacante no puede
      // provocar esta rama; solo puede aprovecharla si Google ya esta caido.
      console.warn('recaptcha: siteverify respondio', res.status, '- se deja pasar')
      return { permitido: true, motivo: 'siteverify-no-disponible' }
    }

    datos = await res.json()
  } catch (e) {
    console.warn('recaptcha: no se pudo verificar, se deja pasar:', e)
    return { permitido: true, motivo: 'error-de-red' }
  }

  if (!datos.success) {
    return {
      permitido: false,
      motivo: `rechazado: ${datos['error-codes']?.join(',') ?? 'sin-detalle'}`,
    }
  }

  // Un token es de una accion concreta y se puede usar una sola vez. Sin este
  // chequeo, cualquier token valido del sitio sirve para cualquier endpoint.
  if (datos.action !== accion) {
    return {
      permitido: false,
      motivo: `accion no coincide: esperaba ${accion}, vino ${datos.action}`,
      score: datos.score,
    }
  }

  const score = datos.score ?? 0
  if (score < UMBRAL) {
    return { permitido: false, motivo: `score bajo: ${score} < ${UMBRAL}`, score }
  }

  return { permitido: true, score }
}

/** El header por el que viaja el token. Ver la nota en lib/recaptchaCliente.ts. */
export const HEADER_RECAPTCHA = 'x-recaptcha-token'

export function tokenDeRequest(request: Request): string | null {
  return request.headers.get(HEADER_RECAPTCHA)
}

/**
 * Respuesta unica para el rechazo, para no repetirla en cada ruta.
 *
 * No dice "reCAPTCHA": al usuario no le sirve saberlo y a un atacante le
 * confirma que barrera acaba de tocar.
 */
export function respuestaRecaptcha403(): Response {
  return new Response(
    JSON.stringify({
      error: 'No pudimos verificar que la solicitud sea legítima. Recargá la página y probá de nuevo.',
    }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  )
}
