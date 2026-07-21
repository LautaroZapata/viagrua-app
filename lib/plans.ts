/**
 * Configuración centralizada de planes.
 * Única fuente de verdad para límites, features y precios.
 * Si cambia un valor, se refleja en toda la app.
 */

export interface PlanConfig {
  key: string
  label: string
  precio: number | null
  moneda: string
  traslados_max: number | null // null = ilimitado
  puede_agregar_personas: boolean
  features: string[]
  excludedFeatures: string[]
}

export const PLANES: Record<string, PlanConfig> = {
  free: {
    key: 'free',
    label: 'Free',
    precio: 0,
    moneda: 'UYU',
    traslados_max: 30,
    puede_agregar_personas: false,
    features: [
      'Hasta 30 traslados por mes',
      'Registro de gastos',
      'Fotos en traslados',
    ],
    excludedFeatures: [
      'Agregar choferes',
      'Traslados ilimitados',
    ],
  },
  premium: {
    key: 'premium',
    label: 'Premium',
    precio: 199,
    moneda: 'UYU',
    traslados_max: null,
    puede_agregar_personas: true,
    features: [
      'Traslados ilimitados',
      'Agregar múltiples choferes',
      'Registro de gastos',
      'Fotos en traslados',
      'Soporte prioritario',
    ],
    excludedFeatures: [],
  },
  admin: {
    key: 'admin',
    label: 'Admin',
    precio: null,
    moneda: 'UYU',
    traslados_max: null,
    puede_agregar_personas: true,
    features: [
      'Traslados ilimitados',
      'Agregar múltiples choferes',
      'Registro de gastos',
      'Fotos en traslados',
      'Soporte prioritario',
    ],
    excludedFeatures: [],
  },
} as const

/**
 * Obtiene la config de un plan. Si no existe, retorna el plan free.
 */
export function getPlanConfig(planKey: string | undefined | null): PlanConfig {
  return PLANES[planKey || 'free'] || PLANES.free
}

/**
 * Verifica si un plan tiene traslados ilimitados.
 */
export function hasUnlimitedTraslados(planKey: string | undefined | null): boolean {
  return getPlanConfig(planKey).traslados_max === null
}

/**
 * Verifica si un plan puede agregar personas.
 */
export function canAddPeople(planKey: string | undefined | null): boolean {
  return getPlanConfig(planKey).puede_agregar_personas
}

/**
 * Calcula traslados restantes. null = ilimitado.
 */
export function getTrasladosRestantes(
  planKey: string | undefined | null,
  trasladosUsados: number
): number | null {
  const max = getPlanConfig(planKey).traslados_max
  if (max === null) return null
  return Math.max(max - trasladosUsados, 0)
}

/**
 * Verifica si el usuario ha alcanzado el límite de traslados.
 */
export function isTrasladosLimitReached(
  planKey: string | undefined | null,
  trasladosUsados: number
): boolean {
  if (hasUnlimitedTraslados(planKey)) return false
  const restantes = getTrasladosRestantes(planKey, trasladosUsados)
  return restantes !== null && restantes <= 0
}
