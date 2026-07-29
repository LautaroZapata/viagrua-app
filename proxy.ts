import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PATHNAME_HEADER } from '@/lib/rutas';

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

/**
 * CSP estricta, con nonce, para el area autenticada.
 *
 * 'strict-dynamic' hace que un script ya autorizado por el nonce pueda cargar
 * otros, que es lo que permite sacar 'unsafe-inline' sin romper el arranque de
 * Next.
 *
 * Solo se aplica al area autenticada, y es a proposito: el nonce cambia en cada
 * request, asi que la pagina deja de poder servirse cacheada. Ponerlo en la
 * landing la volveria dinamica y le costaria el rendimiento de una pagina
 * estatica, que es lo primero que ve alguien que todavia no es cliente. La
 * landing no muestra datos de nadie ni recibe input, asi que ahi 'unsafe-inline'
 * no le compra nada a un atacante; donde hay datos de empresas, va la estricta.
 *
 * style-src conserva 'unsafe-inline': Next inyecta <style> sin nonce y Radix
 * escribe estilos inline para posicionar popovers y sheets.
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
 * En desarrollo hace falta 'unsafe-eval': Turbopack envuelve cada modulo en
 * eval() para el hot-reload y los source maps. Sin esto, la consola en local se
 * llena de violaciones que no existen en produccion —verificado: el build no
 * tiene un solo eval( en sus chunks— y esconderian a las de verdad.
 *
 * Nunca se agrega en produccion.
 */
const EVAL_EN_DEV = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"

function construirCsp(nonce: string | null): string {
  return [
    "default-src 'self'",
    nonce
      ? `script-src 'self' 'nonce-${nonce}' ${HASH_SCRIPT_TEMA} 'strict-dynamic'${EVAL_EN_DEV}`
      : `script-src 'self' 'unsafe-inline'${EVAL_EN_DEV}`,
    "style-src 'self' 'unsafe-inline'",
    // Cloudinary ya no figura: las 472 fotos que estaban ahi se migraron al
    // storage propio y no quedan referencias en la base.
    "img-src 'self' blob: data: https://*.supabase.co",
    "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ')
}

function esAreaAutenticada(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/chofer') ||
    pathname === '/onboarding'
  )
}

/**
 * Arranca en modo reporte.
 *
 * Con Content-Security-Policy-Report-Only el navegador anota en consola lo que
 * habria bloqueado, pero no bloquea nada. Si la propagacion del nonce fallara,
 * en modo bloqueante el dashboard se quedaria sin cargar un solo script: una
 * caida total, y no hay forma de comprobarlo sin abrir un navegador.
 *
 * Para pasar a bloqueante: CSP_ENFORCE=1 en las variables de entorno del
 * deploy. Antes de hacerlo, recorrer el dashboard con la consola abierta y
 * confirmar que no aparece ninguna violacion.
 */
const CSP_HEADER = process.env.CSP_ENFORCE === '1'
  ? 'Content-Security-Policy'
  : 'Content-Security-Policy-Report-Only'

/**
 * Refresca la sesion de Supabase y resuelve lo unico que se puede decidir sin
 * tocar la base: si hay usuario o no.
 *
 * El ruteo por rol y el gate de onboarding viven en
 * app/(authenticated)/layout.tsx, que ya consulta el perfil para poblar el
 * contexto. Antes esa misma query corria aca (hasta dos veces) ademas de en el
 * cliente, o sea hasta cuatro round trips por navegacion.
 */
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Toda la CSP se arma aca y no en next.config.js: emitirla en los dos lados
  // manda dos headers, y el navegador exige que la request pase por ambos.
  // Ademas obligaba a repetir la lista de rutas autenticadas en dos archivos.
  const nonce = esAreaAutenticada(pathname) ? crypto.randomUUID().replace(/-/g, '') : null;
  const csp = construirCsp(nonce);

  // req.cookies.set() actualiza el header 'cookie' del request, asi que hay que
  // releer req.headers despues de que Supabase refresque la sesion.
  const construirRespuesta = () => {
    const headers = new Headers(req.headers);
    headers.set(PATHNAME_HEADER, pathname);

    if (nonce) {
      // Next lee estos dos del request para ponerle el nonce a sus propios
      // scripts. Aca va siempre como Content-Security-Policy, sin -Report-Only:
      // es la senal que Next busca, y de este header no depende el bloqueo.
      headers.set('x-nonce', nonce);
      headers.set('Content-Security-Policy', csp);
    }

    const respuesta = NextResponse.next({ request: { headers } });
    // El que ve el navegador. La estricta arranca en modo reporte; la base, que
    // es la que ya regia, se sigue aplicando de verdad.
    respuesta.headers.set(nonce ? CSP_HEADER : 'Content-Security-Policy', csp);
    return respuesta;
  };

  let res = construirRespuesta();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value);
          });

          res = construirRespuesta();

          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/chofer') ||
    pathname === '/onboarding';

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Ya logueado entrando al login o a la landing. Va a /dashboard y el layout
  // autenticado corrige a /chofer o /onboarding segun el perfil, que ahi ya
  // esta cargado.
  if (user && (pathname === '/login' || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}
