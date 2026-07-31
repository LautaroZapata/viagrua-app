/**
 * Construccion de la Content-Security-Policy.
 *
 * Vive aca y no adentro de proxy.ts para poder testearla: ese archivo solo
 * puede exportar `proxy` y `config`, asi que cualquier cosa que viva ahi adentro
 * es inalcanzable desde un test. Y la CSP ya no es una constante: cambia segun
 * si la ruta es publica o autenticada, y segun que servicios externos esten
 * configurados. Una directiva de mas afloja la politica en silencio y una de
 * menos rompe una funcionalidad entera sin dar un error claro; ninguno de los
 * dos casos se nota mirando el codigo.
 */

/**
 * Hash del <script> inline que inyecta next-themes en el <head>.
 *
 * Ese script aplica la clase del tema antes del primer pintado, para que quien
 * tenga modo oscuro no vea un flash blanco. Lo genera la libreria, asi que no
 * pasa por el nonce. Se autoriza por hash: 'strict-dynamic' ignora 'self' y
 * 'unsafe-inline', pero sigue respetando nonces y hashes.
 *
 * La alternativa era pasarle el nonce a ThemeProvider, pero para eso hay que
 * leer headers() en el layout raiz y eso vuelve dinamica tambien a la landing,
 * que hoy se sirve estatica.
 *
 * OJO: el hash sale del texto exacto del script, que depende de la version de
 * next-themes y de los props de <ThemeProvider> en app/providers.tsx
 * (attribute, defaultTheme, enableSystem). Si se toca cualquiera de esas cosas,
 * el hash deja de coincidir y vuelve el flash de tema en el area autenticada.
 * Se saca de la consola del navegador: la violacion de CSP reporta el hash que
 * corresponde.
 */
const HASH_SCRIPT_TEMA = "'sha256-n46vPwSWuMC0W703pBofImv82Z26xo4LXymv0E9caPk='"

/**
 * Origenes que necesita reCAPTCHA v3.
 *
 * Cada uno esta por algo distinto: api.js sale de www.google.com, los recursos
 * del widget de www.gstatic.com, el badge se monta en un iframe (frame-src) y
 * el token se pide por XHR contra www.google.com (connect-src). Si falta
 * cualquiera de los cuatro, el token nunca se genera.
 */
const RECAPTCHA_SCRIPT = 'https://www.google.com/recaptcha/ https://www.gstatic.com'
const RECAPTCHA_FRAME = 'https://www.google.com/recaptcha/'
const RECAPTCHA_CONNECT = 'https://www.google.com/recaptcha/'

/**
 * Origen al que Sentry manda los eventos, sacado del propio DSN.
 *
 * Se deriva en vez de escribirse a mano porque el host depende de la
 * organizacion y de la region del proyecto (oNNNN.ingest.us.sentry.io). Un
 * wildcard tipo https://*.sentry.io alcanzaria, pero abriria connect-src a
 * cualquier proyecto de Sentry del mundo; esto autoriza exactamente uno.
 *
 * Si el DSN no esta o no parsea no se agrega nada: la CSP no se afloja en los
 * entornos donde Sentry ni siquiera arranca.
 */
export function origenSentry(dsn: string | undefined): string | null {
  if (!dsn) return null
  try {
    return new URL(dsn).origin
  } catch {
    return null
  }
}

/**
 * Origenes de la instancia de Supabase configurada, sacados de su URL.
 *
 * Los comodines https://*.supabase.co cubren cualquier proyecto en la nube pero
 * no cubren un Supabase local, que escucha en http://127.0.0.1:<puerto>. Sin
 * esto, en local el navegador bloquea todo lo que el cliente de Supabase manda
 * directo —el login entre otras cosas— mientras que las rutas de API siguen
 * andando porque son same-origin. El sintoma es un login que "no hace nada".
 *
 * Devuelve el origen http y el ws, porque Realtime abre el socket contra el
 * mismo host.
 */
export function origenesSupabase(url: string | undefined): string[] {
  if (!url) return []
  try {
    const { origin, protocol, host } = new URL(url)
    const ws = protocol === 'https:' ? `wss://${host}` : `ws://${host}`
    return [origin, ws]
  } catch {
    return []
  }
}

export interface OpcionesCsp {
  /**
   * El nonce del request, o null en las rutas publicas.
   *
   * Es lo que distingue las dos politicas. Con nonce va la estricta del area
   * autenticada; sin nonce, la base de la landing y las pantallas de acceso.
   */
  nonce: string | null
  /**
   * En desarrollo hace falta 'unsafe-eval': Turbopack envuelve cada modulo en
   * eval() para el hot-reload y los source maps. Sin esto, la consola en local
   * se llena de violaciones que no existen en produccion —verificado: el build
   * no tiene un solo eval( en sus chunks— y esconderian a las de verdad.
   *
   * Nunca se activa en produccion.
   */
  desarrollo: boolean
  /** El DSN configurado, si lo hay. Ver origenSentry(). */
  dsnSentry?: string
  /** La URL de Supabase configurada. Ver origenesSupabase(). */
  urlSupabase?: string
}

/**
 * Arma el valor del header.
 *
 * La politica estricta con nonce solo se aplica al area autenticada, y es a
 * proposito: el nonce cambia en cada request, asi que la pagina deja de poder
 * servirse cacheada. Ponerlo en la landing la volveria dinamica y le costaria
 * el rendimiento de una pagina estatica, que es lo primero que ve alguien que
 * todavia no es cliente. La landing no muestra datos de nadie; donde hay datos
 * de empresas, va la estricta.
 *
 * 'strict-dynamic' hace que un script ya autorizado por el nonce pueda cargar
 * otros, que es lo que permite sacar 'unsafe-inline' sin romper el arranque de
 * Next.
 *
 * style-src conserva 'unsafe-inline' en los dos casos: Next inyecta <style> sin
 * nonce y Radix escribe estilos inline para posicionar popovers y sheets.
 */
export function construirCsp({
  nonce,
  desarrollo,
  dsnSentry,
  urlSupabase,
}: OpcionesCsp): string {
  const evalEnDev = desarrollo ? " 'unsafe-eval'" : ''

  /**
   * reCAPTCHA corre en las tres pantallas publicas (landing, login y /unirse) y
   * en ninguna del area autenticada. Ademas de innecesario, ahi seria inutil:
   * con 'strict-dynamic' el navegador ignora cualquier lista de hosts en
   * script-src.
   */
  const esPublica = nonce === null

  // Los comodines quedan por compatibilidad con lo que ya regia en produccion.
  // Se podrian sacar —el origen derivado de urlSupabase es exactamente el
  // proyecto propio, mientras que el comodin habilita cualquier proyecto de
  // Supabase del mundo— pero eso aprieta la politica justo cuando se esta
  // pasando a bloqueante, y conviene un cambio por vez.
  const conectar = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    ...origenesSupabase(urlSupabase),
    origenSentry(dsnSentry),
    esPublica ? RECAPTCHA_CONNECT : null,
  ].filter(Boolean)

  const scripts = esPublica
    ? ["'self'", "'unsafe-inline'", RECAPTCHA_SCRIPT]
    : ["'self'", `'nonce-${nonce}'`, HASH_SCRIPT_TEMA, "'strict-dynamic'"]

  return [
    "default-src 'self'",
    `script-src ${scripts.join(' ')}${evalEnDev}`,
    "style-src 'self' 'unsafe-inline'",
    // Cloudinary ya no figura: las 472 fotos que estaban ahi se migraron al
    // storage propio y no quedan referencias en la base.
    "img-src 'self' blob: data: https://*.supabase.co",
    "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
    `connect-src ${conectar.join(' ')}`,
    esPublica ? `frame-src ${RECAPTCHA_FRAME}` : "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ')
}
