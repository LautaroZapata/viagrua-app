'use client'
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/db'

// Derivados del esquema real (lib/database.types.ts, generado con `pnpm db:types`).
// Escritos a mano decian empresa_id: string, pero en la base es nullable: un
// chofer expulsado queda sin empresa (expulsar_chofer la pone en NULL) y ve la
// pantalla para unirse con codigo. El tipo tiene que reflejarlo.
export type Perfil = Pick<
    Tables<'perfiles'>,
    'id' | 'nombre_completo' | 'rol' | 'empresa_id' | 'email' | 'onboarding_completed'
>

export type Empresa = Pick<Tables<'empresas'>, 'id' | 'nombre'>

export interface SesionInicial {
    user: { id: string; email?: string }
    perfil: Perfil
    empresa: Empresa | null
}

interface UserContextType {
    user: { id: string; email?: string } | null
    perfil: Perfil | null
    empresa: Empresa | null
    role: string | null
    /**
     * Solo es true mientras corre un reload() explicito. El primer render ya
     * llega con los datos resueltos en el servidor, asi que nunca arranca en
     * true: no hace falta tapar la pagina con un spinner.
     */
    loading: boolean
    reload: () => Promise<void>
    logout: () => Promise<void>
}

const UserCtx = createContext<UserContextType>({
    user: null,
    perfil: null,
    empresa: null,
    role: null,
    loading: false,
    reload: async () => {},
    logout: async () => {},
})

export function useUser() {
    return useContext(UserCtx)
}

export function UserProvider({
    sesion,
    children,
}: {
    sesion: SesionInicial
    children: React.ReactNode
}) {
    const router = useRouter()
    const [user, setUser] = useState<UserContextType['user']>(sesion.user)
    const [perfil, setPerfil] = useState<Perfil | null>(sesion.perfil)
    const [empresa, setEmpresa] = useState<Empresa | null>(sesion.empresa)
    const [loading, setLoading] = useState(false)

    // El layout servidor vuelve a correr en cada navegacion; si cambio el perfil
    // (por ejemplo tras completar el onboarding) hay que tomar el valor nuevo.
    useEffect(() => {
        setUser(sesion.user)
        setPerfil(sesion.perfil)
        setEmpresa(sesion.empresa)
    }, [sesion])

    /** Re-lee el perfil desde el cliente tras una mutacion propia. */
    const load = useCallback(async () => {
        setLoading(true)
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) {
                router.replace('/login')
                return
            }

            const { data: perfilData } = await supabase
                .from('perfiles')
                .select('id, nombre_completo, rol, empresa_id, email, onboarding_completed, empresas(id, nombre)')
                .eq('id', authUser.id)
                .single()

            if (!perfilData) {
                router.replace('/login')
                return
            }

            const { empresas, ...perfilOnly } = perfilData as typeof perfilData & { empresas: Empresa | null }
            setUser({ id: authUser.id, email: authUser.email })
            setPerfil(perfilOnly as Perfil)
            setEmpresa(empresas ?? null)
        } catch {
            router.replace('/login')
        } finally {
            setLoading(false)
        }
    }, [router])

    const logout = useCallback(async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }, [router])

    const value = useMemo(() => ({
        user,
        perfil,
        empresa,
        role: perfil?.rol ?? null,
        loading,
        reload: load,
        logout,
    }), [user, perfil, empresa, loading, load, logout])

    return (
        <UserCtx.Provider value={value}>
            {children}
        </UserCtx.Provider>
    )
}
