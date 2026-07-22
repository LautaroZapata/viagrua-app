import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

export async function proxy(req: NextRequest) {
  // Respuesta base, se actualizará si Supabase necesita refrescar cookies
  let res = NextResponse.next({ request: req });

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

          // recreamos la respuesta para propagar las cookies actualizadas
          res = NextResponse.next({ request: req });

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

  const pathname = req.nextUrl.pathname;
  const isDashboard = pathname.startsWith('/dashboard');
  const isChofer = pathname.startsWith('/chofer');
  const isOnboarding = pathname === '/onboarding';
  const isProtected = isDashboard || isChofer || isOnboarding;

  // Sin usuario autenticado y quiere entrar a ruta protegida → login
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Usuario autenticado - verificar rol y onboarding para rutas protegidas
  if (user && isProtected) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol, onboarding_completed')
      .eq('id', user.id)
      .single();

    // Onboarding incompleto → forzar /onboarding
    if (!perfil?.onboarding_completed && !isOnboarding) {
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }

    // Ya completó onboarding y visita /onboarding → redirigir a home
    if (perfil?.onboarding_completed && isOnboarding) {
      const redirectTo = perfil?.rol === 'chofer' ? '/chofer' : '/dashboard';
      return NextResponse.redirect(new URL(redirectTo, req.url));
    }

    // Chofer puede acceder a /dashboard/gastos (ruta compartida)
    const isGastosRoute = pathname.startsWith('/dashboard/gastos');

    // Admin puede acceder a AMBAS vistas (dashboard y chofer)
    // Solo bloquear chofer si intenta acceder a dashboard (excepto gastos)
    if (isDashboard && !isGastosRoute && perfil?.rol === 'chofer') {
      return NextResponse.redirect(new URL('/chofer', req.url));
    }
  }

  // Ya logueado y quiere ir al login o registro → redirigir según rol
  if (user && (pathname === '/login' || pathname === '/')) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol, onboarding_completed')
      .eq('id', user.id)
      .single();

    // Si no completó onboarding, ir a /onboarding
    if (!perfil?.onboarding_completed) {
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }

    const redirectTo = perfil?.rol === 'chofer' ? '/chofer' : '/dashboard';
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }

  return res;
}
