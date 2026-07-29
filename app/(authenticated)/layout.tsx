import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { PATHNAME_HEADER, decidirRedireccion } from '@/lib/rutas'
import AuthenticatedShell from '../components/AuthenticatedShell'
import type { Empresa, Perfil, SesionInicial } from '../components/UserContext'

/**
 * Server Component: resuelve la sesion una sola vez, en el servidor.
 *
 * Antes este layout era 'use client' y volvia a pedir getUser() + el perfil que
 * proxy.ts ya habia consultado en la misma request, con un spinner a pantalla
 * completa tapando todo mientras tanto. Eran cuatro round trips secuenciales
 * antes del primer pixel util, y los loading.tsx de cada ruta no se veian nunca
 * porque el spinner del layout les ganaba siempre.
 */
export default async function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        redirect('/login')
    }

    const { data: perfilData, error: perfilError } = await supabase
        .from('perfiles')
        .select('id, nombre_completo, rol, empresa_id, email, onboarding_completed, empresas(id, nombre)')
        .eq('id', user.id)
        .single()

    // Fallar cerrado: sin perfil no se puede decidir que puede ver este usuario.
    if (perfilError || !perfilData) {
        redirect('/login')
    }

    const { empresas, ...perfil } = perfilData as typeof perfilData & { empresas: Empresa | null }

    // Gate de rol y onboarding. Vivia en proxy.ts, que para resolverlo consultaba
    // perfiles otra vez; aca el perfil ya esta a mano.
    // La decision esta en lib/rutas.ts para poder testearla: un error aca no da
    // un bug visible, da un loop de redirects. Ver lib/__tests__/rutas.test.ts.
    const destino = decidirRedireccion((await headers()).get(PATHNAME_HEADER), {
        rol: perfil.rol,
        onboardingCompleted: perfil.onboarding_completed,
    })
    if (destino) {
        redirect(destino)
    }

    const sesion: SesionInicial = {
        user: { id: user.id, email: user.email },
        perfil: perfil as Perfil,
        empresa: empresas ?? null,
    }

    return <AuthenticatedShell sesion={sesion}>{children}</AuthenticatedShell>
}
