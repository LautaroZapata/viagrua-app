'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { confirmDelete, showError } from '@/lib/swal'
import { useUser } from '@/app/components/UserContext'
import AppHeader from '@/app/components/AppHeader'
import EmptyState from '@/app/components/EmptyState'
import ErrorBoundary from '@/app/components/ErrorBoundary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserPlus, Mail, Copy, Check } from 'lucide-react'

interface Chofer { id: string; nombre_completo: string; email: string }

export default function ChoferesPage() {
    const { perfil } = useUser()
    const [choferes, setChoferes] = useState<Chofer[]>([])
    const [modalAbierto, setModalAbierto] = useState(false)
    const [codigoInvitacion, setCodigoInvitacion] = useState('')
    const [linkInvitacion, setLinkInvitacion] = useState('')
    const [generandoCodigo, setGenerandoCodigo] = useState(false)
    const [linkCopiado, setLinkCopiado] = useState(false)
    const [isClient, setIsClient] = useState(false)
    const timersRef = useRef<NodeJS.Timeout[]>([])

    useEffect(() => () => timersRef.current.forEach(clearTimeout), [])
    useEffect(() => { setIsClient(true) }, [])

    useEffect(() => {
        if (perfil?.empresa_id) cargarChoferes(perfil.empresa_id)
    }, [perfil?.empresa_id])

    useEffect(() => {
        if (!perfil?.empresa_id) return
        const sub = supabase.channel('choferes-page')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles' }, (payload) => {
                const n = payload.new as { empresa_id?: string }
                const o = payload.old as { empresa_id?: string }
                if (n?.empresa_id === perfil.empresa_id || o?.empresa_id === perfil.empresa_id)
                    cargarChoferes(perfil.empresa_id)
            }).subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [perfil?.empresa_id])

    const cargarChoferes = async (empresaId: string) => {
        const { data } = await supabase.from('perfiles').select('*').eq('empresa_id', empresaId).eq('rol', 'chofer')
        setChoferes(data || [])
    }

    const expulsarChofer = async (id: string, nombre: string) => {
        const ok = await confirmDelete({ title: 'Expulsar chofer', text: `¿Expulsar a ${nombre}?`, confirmButtonText: 'Si, expulsar' })
        if (!ok) return
        setChoferes(prev => prev.filter(c => c.id !== id))
        const { error } = await supabase.rpc('expulsar_chofer', { chofer_id: id })
        if (error) { showError('Error: ' + error.message); if (perfil) cargarChoferes(perfil.empresa_id) }
    }

    const generarCodigo = async () => {
        if (!perfil?.empresa_id) return
        setGenerandoCodigo(true)
        const arr = new Uint8Array(5)
        if (isClient) crypto.getRandomValues(arr)
        const codigo = Array.from(arr, b => b.toString(36).padStart(2, '0')).join('').substring(0, 8).toUpperCase()
        const { error } = await supabase.from('invitaciones').insert({ empresa_id: perfil.empresa_id, codigo })
        if (error) { showError('Error: ' + error.message); setGenerandoCodigo(false); return }
        setCodigoInvitacion(codigo)
        if (isClient) setLinkInvitacion(`${window.location.origin}/unirse/${codigo}`)
        setGenerandoCodigo(false)
    }

    const copiarLink = async () => {
        if (!linkInvitacion) return
        try {
            await navigator.clipboard.writeText(linkInvitacion)
            setLinkCopiado(true)
            timersRef.current.push(setTimeout(() => setLinkCopiado(false), 2000))
        } catch { showError('No se pudo copiar') }
    }

    const abrirModal = () => { setCodigoInvitacion(''); setLinkInvitacion(''); setLinkCopiado(false); setModalAbierto(true) }

    return (
        <ErrorBoundary>
            <AppHeader
                breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Choferes' }]}
                actions={<Button size="sm" onClick={abrirModal}><UserPlus className="size-4 mr-1.5" />Invitar</Button>}
            />
            <div className="page-enter p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
                <Card>
                    <CardHeader>
                        <CardTitle>Equipo de Choferes ({choferes.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {choferes.length === 0 ? (
                            <EmptyState message="No hay choferes registrados" />
                        ) : (
                            <div className="space-y-2">
                                {choferes.map((c) => (
                                    <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-accent/30 transition">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar className="size-10">
                                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                                    {c.nombre_completo.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm text-foreground truncate">{c.nombre_completo}</p>
                                                <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Activo</Badge>
                                            <Button variant="ghost" size="sm" onClick={() => expulsarChofer(c.id, c.nombre_completo)}
                                                className="text-muted-foreground hover:text-destructive text-xs">Expulsar</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Invitar Chofer</DialogTitle></DialogHeader>
                    {!codigoInvitacion ? (
                        <div className="text-center py-4">
                            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                <Mail className="size-7 text-primary" />
                            </div>
                            <p className="text-muted-foreground text-sm mb-6">Genera un codigo para que un chofer se una</p>
                            <Button onClick={generarCodigo} disabled={generandoCodigo} className="w-full">
                                {generandoCodigo ? 'Generando...' : 'Generar Invitacion'}
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Codigo</p>
                            <p className="text-2xl font-bold text-primary mb-5 tracking-widest font-mono">{codigoInvitacion}</p>
                            {isClient && linkInvitacion && (
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(linkInvitacion)}`}
                                    alt="QR" className="w-36 h-36 mx-auto mb-4 rounded-lg" />
                            )}
                            <div className="bg-muted rounded-lg p-3 mb-5">
                                <p className="text-xs text-muted-foreground break-all font-mono">{linkInvitacion}</p>
                            </div>
                            <Button onClick={copiarLink} className="w-full" variant={linkCopiado ? 'outline' : 'default'}>
                                {linkCopiado ? <><Check className="size-4 mr-1.5" />Copiado</> : <><Copy className="size-4 mr-1.5" />Copiar Link</>}
                            </Button>
                            <p className="text-[10px] text-muted-foreground mt-4">Expira en 7 dias, uso unico</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </ErrorBoundary>
    )
}
