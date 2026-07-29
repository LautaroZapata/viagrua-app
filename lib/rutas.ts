/**
 * Gate de rol y onboarding para el arbol autenticado.
 *
 * Vive aparte del layout para poder testearlo: un error aca no da un bug
 * visible, da un loop de redirects que deja la app inusable.
 */

/**
 * Header interno con el pathname de la request. Lo setea proxy.ts y lo lee el
 * layout autenticado, que por ser Server Component no puede usar usePathname.
 * Vive aca y no en proxy.ts para que el layout no tenga que importar el modulo
 * del middleware.
 */
export const PATHNAME_HEADER = 'x-pathname'

export interface EstadoSesion {
  rol: string
  onboardingCompleted: boolean
}

/**
 * Devuelve la ruta a la que hay que redirigir, o null si se puede servir.
 *
 * `pathname` llega por el header que setea proxy.ts, porque un Server Component
 * no puede usar usePathname. Si el header falta no se redirige a ningun lado:
 * sin saber donde estamos, cualquier decision puede mandarnos justo a la ruta
 * en la que ya estamos y colgar la app en un loop. La autenticacion en si ya
 * la garantizan proxy.ts y el layout.
 */
export function decidirRedireccion(
  pathname: string | null | undefined,
  { rol, onboardingCompleted }: EstadoSesion
): string | null {
  if (!pathname) return null

  const esOnboarding = pathname === '/onboarding'
  const destinoPorRol = rol === 'chofer' ? '/chofer' : '/dashboard'

  if (!onboardingCompleted) {
    return esOnboarding ? null : '/onboarding'
  }

  if (esOnboarding) {
    return destinoPorRol
  }

  // /dashboard/gastos es compartida: el chofer carga ahi sus gastos.
  const esDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/')
  const esGastos = pathname === '/dashboard/gastos' || pathname.startsWith('/dashboard/gastos/')

  if (rol === 'chofer' && esDashboard && !esGastos) {
    return '/chofer'
  }

  return null
}
