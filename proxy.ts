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

  // req.cookies.set() actualiza el header 'cookie' del request, asi que hay que
  // releer req.headers despues de que Supabase refresque la sesion.
  const conPathname = () => {
    const headers = new Headers(req.headers);
    headers.set(PATHNAME_HEADER, pathname);
    return NextResponse.next({ request: { headers } });
  };

  let res = conPathname();

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

          res = conPathname();

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
