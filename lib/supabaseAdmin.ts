import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Cliente con service_role: ignora RLS. Solo del lado del servidor, nunca
 * importar desde un componente cliente (lo impide 'server-only').
 *
 * Se crea perezosamente, en el primer uso, por dos razones:
 *
 * 1. El build no tiene la service role key (CI compila con placeholders), y
 *    crearlo al importar el modulo hacia fallar el build.
 * 2. Antes, para no romper el build, si faltaba la key se caia a la anon key
 *    "solo en desarrollo". Eso significaba que en local las escrituras de
 *    supabaseAdmin pasaban por RLS y en produccion no: dos comportamientos
 *    distintos para el mismo codigo. Es exactamente la clase de divergencia
 *    que ya rompio cosas en este proyecto, asi que ahora falta la key y falla,
 *    en todos los entornos por igual.
 */
let cliente: SupabaseClient<Database> | null = null

function crearCliente(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!serviceKey) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY. Es obligatoria: sin ella las rutas que ' +
      'escriben con permisos elevados no pueden funcionar. Agregala a .env.local ' +
      'para desarrollo y a las variables de entorno del deploy.'
    )
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    cliente ??= crearCliente()
    // El receiver va como el cliente real para que los metodos conserven su this.
    return Reflect.get(cliente, prop, cliente)
  },
})
