import { describe, it, expect } from 'vitest'
import { decidirRedireccion } from '../rutas'

const admin = { rol: 'admin', onboardingCompleted: true }
const chofer = { rol: 'chofer', onboardingCompleted: true }
const adminNuevo = { rol: 'admin', onboardingCompleted: false }
const choferNuevo = { rol: 'chofer', onboardingCompleted: false }

describe('decidirRedireccion / onboarding pendiente', () => {
  it('manda a onboarding desde cualquier ruta', () => {
    expect(decidirRedireccion('/dashboard', adminNuevo)).toBe('/onboarding')
    expect(decidirRedireccion('/chofer', choferNuevo)).toBe('/onboarding')
    expect(decidirRedireccion('/dashboard/gastos', choferNuevo)).toBe('/onboarding')
  })

  it('sirve /onboarding sin loop', () => {
    expect(decidirRedireccion('/onboarding', adminNuevo)).toBeNull()
    expect(decidirRedireccion('/onboarding', choferNuevo)).toBeNull()
  })
})

describe('decidirRedireccion / onboarding completo', () => {
  it('saca de /onboarding segun el rol', () => {
    expect(decidirRedireccion('/onboarding', admin)).toBe('/dashboard')
    expect(decidirRedireccion('/onboarding', chofer)).toBe('/chofer')
  })

  it('deja al admin en todo el dashboard', () => {
    expect(decidirRedireccion('/dashboard', admin)).toBeNull()
    expect(decidirRedireccion('/dashboard/traslados', admin)).toBeNull()
    expect(decidirRedireccion('/dashboard/choferes', admin)).toBeNull()
    expect(decidirRedireccion('/dashboard/traslado/abc-123', admin)).toBeNull()
    expect(decidirRedireccion('/chofer', admin)).toBeNull()
  })

  it('rebota al chofer fuera del dashboard', () => {
    expect(decidirRedireccion('/dashboard', chofer)).toBe('/chofer')
    expect(decidirRedireccion('/dashboard/traslados', chofer)).toBe('/chofer')
    expect(decidirRedireccion('/dashboard/choferes', chofer)).toBe('/chofer')
  })

  it('deja al chofer en /dashboard/gastos, que es compartida', () => {
    expect(decidirRedireccion('/dashboard/gastos', chofer)).toBeNull()
    expect(decidirRedireccion('/dashboard/gastos/nuevo', chofer)).toBeNull()
  })

  it('deja al chofer en sus propias rutas', () => {
    expect(decidirRedireccion('/chofer', chofer)).toBeNull()
    expect(decidirRedireccion('/chofer/traslado/abc-123', chofer)).toBeNull()
  })

  it('no confunde una ruta que solo empieza parecido a gastos', () => {
    // /dashboard/gastosbis no es la ruta compartida
    expect(decidirRedireccion('/dashboard/gastosbis', chofer)).toBe('/chofer')
  })
})

describe('decidirRedireccion / sin pathname', () => {
  it('no redirige si falta el header, para no colgar la app en un loop', () => {
    expect(decidirRedireccion(null, adminNuevo)).toBeNull()
    expect(decidirRedireccion(undefined, chofer)).toBeNull()
    expect(decidirRedireccion('', chofer)).toBeNull()
  })
})

describe('decidirRedireccion / no hay ciclos', () => {
  // Aplica la decision en cadena: si en 5 saltos no se estabiliza, hay loop.
  const rutas = [
    '/dashboard', '/dashboard/traslados', '/dashboard/gastos',
    '/dashboard/choferes', '/chofer', '/chofer/traslado/x', '/onboarding',
  ]
  const perfiles = [admin, chofer, adminNuevo, choferNuevo]

  for (const perfil of perfiles) {
    for (const inicio of rutas) {
      it(`${perfil.rol}/onb=${perfil.onboardingCompleted} desde ${inicio} converge`, () => {
        let actual = inicio
        let saltos = 0
        while (saltos < 5) {
          const siguiente = decidirRedireccion(actual, perfil)
          if (siguiente === null) break
          expect(siguiente).not.toBe(actual) // nunca redirigir a uno mismo
          actual = siguiente
          saltos++
        }
        expect(saltos).toBeLessThan(5)
      })
    }
  }
})
