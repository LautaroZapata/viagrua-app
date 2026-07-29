/**
 * Lado navegador de reCAPTCHA v3.
 *
 * El script de Google se carga cuando hace falta y una sola vez, no en el
 * layout: son ~80 KB que solo necesitan tres formularios publicos (login, alta
 * de empresa y sumarse con invitacion). Cargarlo global se lo cobraria a cada
 * navegacion del dashboard, que es donde la app se usa todo el dia.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ''

/**
 * El token viaja en un header y no en el body.
 *
 * Un token de v3 mide cerca de 1900 caracteres, y las rutas de auth cortan el
 * body en 2000 (MAX_BODY_SIZE). Metido en el JSON, cualquier login legitimo
 * pasaba a rebotar con 413. Subir ese limite para que entre el token seria
 * aflojar justo el guard que evita que a estas rutas publicas les manden un
 * body enorme.
 */
export const HEADER_RECAPTCHA = 'X-Recaptcha-Token'

/** Las acciones tienen que coincidir con las que valida el servidor. */
export const ACCIONES = {
  login: 'login',
  registro: 'registro',
  unirse: 'unirse',
} as const

export type AccionRecaptcha = (typeof ACCIONES)[keyof typeof ACCIONES]

interface Grecaptcha {
  ready: (cb: () => void) => void
  execute: (siteKey: string, opciones: { action: string }) => Promise<string>
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha
  }
}

/** Se guarda la promesa, no un booleano: dos formularios que arranquen a la vez
 *  tienen que compartir la misma carga en vez de inyectar el script dos veces. */
let cargaEnCurso: Promise<Grecaptcha | null> | null = null

function cargarScript(): Promise<Grecaptcha | null> {
  if (typeof window === 'undefined' || !SITE_KEY) return Promise.resolve(null)
  if (window.grecaptcha) return Promise.resolve(window.grecaptcha)

  cargaEnCurso ??= new Promise<Grecaptcha | null>((resolver) => {
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`
    script.async = true

    script.onload = () => {
      const api = window.grecaptcha
      if (!api) return resolver(null)
      // ready() espera a que el widget termine de inicializarse. Llamar a
      // execute() antes tira "Invalid site key" aunque la key este bien.
      api.ready(() => resolver(api))
    }

    // Bloqueadores de publicidad y extensiones de privacidad cortan
    // google.com/recaptcha. No es un caso raro y no puede tirar el formulario:
    // se devuelve null y decide el servidor.
    script.onerror = () => {
      cargaEnCurso = null // que un reintento pueda volver a probar
      resolver(null)
    }

    document.head.appendChild(script)
  })

  return cargaEnCurso
}

/**
 * Devuelve un token para `accion`, o null si reCAPTCHA no esta configurado o el
 * navegador no lo pudo cargar.
 *
 * Nunca lanza: un formulario no se puede quedar sin poder enviarse porque falle
 * un tercero. Que un null sea aceptable o no lo decide cada ruta del servidor.
 */
export async function tokenRecaptcha(accion: AccionRecaptcha): Promise<string | null> {
  try {
    const api = await cargarScript()
    if (!api) return null
    return await api.execute(SITE_KEY, { action: accion })
  } catch (e) {
    console.warn('recaptcha: no se pudo generar el token:', e)
    return null
  }
}

/**
 * Headers para el fetch, con el token si se pudo obtener.
 *
 * Se omite la clave cuando no hay token, en vez de mandarla vacia: asi el
 * servidor distingue "no llego token" de "llego un token vacio".
 */
export async function headersConRecaptcha(accion: AccionRecaptcha): Promise<HeadersInit> {
  const token = await tokenRecaptcha(accion)
  return token
    ? { 'Content-Type': 'application/json', [HEADER_RECAPTCHA]: token }
    : { 'Content-Type': 'application/json' }
}
