'use client'
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Perfil {
    id: string
    nombre_completo: string
    rol: string
    empresa_id: string
    email?: string
}

interface Empresa {
    id: string
    nombre: string
}

interface UserContextType {
    user: { id: string; email?: string } | null
    perfil: Perfil | null
    empresa: Empresa | null
    role: string | null
    loading: boolean
    reload: () => Promise<void>
    logout: () => Promise<void>
}

const UserCtx = createContext<UserContextType>({
    user: null,
    perfil: null,
    empresa: null,
    role: null,
    loading: true,
    reload: async () => {},
    logout: async () => {},
})

export function useUser() {
    return useContext(UserCtx)
}

export function UserProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
    const [perfil, setPerfil] = useState<Perfil | null>(null)
    const [empresa, setEmpresa] = useState<Empresa | null>(null)
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) {
                router.replace('/login')
                return
            }

            setUser({ id: authUser.id, email: authUser.email })

            const { data: perfilData } = await supabase
                .from('perfiles')
                .select('id, nombre_completo, rol, empresa_id, email, empresas(id, nombre)')
                .eq('id', authUser.id)
                .single()

            if (!perfilData) {
                router.replace('/login')
                return
            }

            const { empresas, ...perfilOnly } = perfilData as typeof perfilData & { empresas: Empresa | null }
            setPerfil(perfilOnly)
            setEmpresa(empresas ?? null)
        } catch {
            router.replace('/login')
        } finally {
            setLoading(false)
        }
    }, [router])

    useEffect(() => { load() }, [load])

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
