import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PATHNAME_HEADER } from '@/lib/rutas';
// La politica se arma en lib/csp.ts, que si se puede testear: este archivo solo
// admite los exports `proxy` y `config`. Ver los tests en lib/__tests__/csp.test.ts.
import { construirCsp } from '@/lib/csp';

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

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
  const csp = construirCsp({
    nonce,
    desarrollo: process.env.NODE_ENV !== 'production',
    dsnSentry: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });

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
