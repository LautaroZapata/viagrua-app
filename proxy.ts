import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: ['/((?!api/).*)'],
};

export default async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  // Crear cliente Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Leer el access_token de la cookie (autenticación SSR/Edge)
  const access_token = req.cookies.get('sb-access-token')?.value;
  if (access_token) {
    // Setear la sesión manualmente (refresh_token vacío, solo para validar)
    await supabase.auth.setSession({ access_token, refresh_token: '' });
  }

  // Ahora sí, getUser() detecta la sesión
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;
  const isDashboard = pathname.startsWith('/dashboard');
  const isChofer = pathname.startsWith('/chofer');
  const isProtected = isDashboard || isChofer;

  // Sin usuario autenticado y quiere entrar a ruta protegida → login
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Usuario autenticado - verificar rol para rutas específicas
  if (user && isProtected) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single();

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
      .select('rol')
      .eq('id', user.id)
      .single();

    const redirectTo = perfil?.rol === 'chofer' ? '/chofer' : '/dashboard';
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }

  return res;
}
