import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const config = {
  matcher: ['/((?!api/).*)'],
}

export async function middleware(request: NextRequest) {
  // Respuesta base que iremos actualizando si Supabase necesita refrescar cookies
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          // recreamos la respuesta para propagar las cookies actualizadas
          response = NextResponse.next({ request })

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isDashboard = pathname.startsWith('/dashboard')
  const isChofer = pathname.startsWith('/chofer')
  const isProtected = isDashboard || isChofer

  // Rutas protegidas: si no hay usuario, mandamos a login
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Usuario autenticado: redirecciones según rol y ruta
  if (user) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    const isGastosRoute = pathname.startsWith('/dashboard/gastos')

    // Chofer intentando entrar al dashboard (excepto gastos) → mandarlo a /chofer
    if (isDashboard && !isGastosRoute && perfil?.rol === 'chofer') {
      const url = request.nextUrl.clone()
      url.pathname = '/chofer'
      return NextResponse.redirect(url)
    }

    // Ya logueado e intentando ir a login o raíz → redirigir al panel correspondiente
    if (pathname === '/login' || pathname === '/') {
      const redirectTo = perfil?.rol === 'chofer' ? '/chofer' : '/dashboard'
      const url = request.nextUrl.clone()
      url.pathname = redirectTo
      return NextResponse.redirect(url)
    }
  }

  // Sin cambios de ruta: continuar petición normal
  return response
}

