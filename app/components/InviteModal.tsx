'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { showError } from '@/lib/swal'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Mail, Copy, Check } from 'lucide-react'

interface InviteModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    empresaId: string | null
}

export default function InviteModal({ open, onOpenChange, empresaId }: InviteModalProps) {
    const [codigoInvitacion, setCodigoInvitacion] = useState('')
    const [linkInvitacion, setLinkInvitacion] = useState('')
    const [generandoCodigo, setGenerandoCodigo] = useState(false)
    const [linkCopiado, setLinkCopiado] = useState(false)
    const timersRef = useRef<NodeJS.Timeout[]>([])

    useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

    useEffect(() => {
        if (open) {
            setCodigoInvitacion('')
            setLinkInvitacion('')
            setLinkCopiado(false)
        }
    }, [open])

    const generarCodigo = async () => {
        if (!empresaId) return
        setGenerandoCodigo(true)
        const arr = new Uint8Array(5)
        crypto.getRandomValues(arr)
        const codigo = Array.from(arr, b => b.toString(36).padStart(2, '0')).join('').substring(0, 8).toUpperCase()
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        const { error } = await supabase.from('invitaciones').insert({ empresa_id: empresaId, codigo, expires_at: expiresAt })
        if (error) { showError('Error al generar codigo: ' + error.message); setGenerandoCodigo(false); return }
        setCodigoInvitacion(codigo)
        setLinkInvitacion(`${window.location.origin}/unirse/${codigo}`)
        setGenerandoCodigo(false)
    }

    const copiarLink = async () => {
        if (!linkInvitacion) return
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(linkInvitacion)
            } else {
                const ta = document.createElement('textarea')
                ta.value = linkInvitacion
                document.body.appendChild(ta)
                ta.select()
                document.execCommand('copy')
                document.body.removeChild(ta)
            }
            setLinkCopiado(true)
            timersRef.current.push(setTimeout(() => setLinkCopiado(false), 2000))
        } catch { showError('No se pudo copiar. Copialo manualmente: ' + linkInvitacion) }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Invitar Chofer</DialogTitle>
                </DialogHeader>
                {!codigoInvitacion ? (
                    <div className="text-center py-4">
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <Mail className="size-7 text-primary" />
                        </div>
                        <p className="text-muted-foreground text-sm mb-6">
                            Genera un codigo de invitacion para que un chofer se una a tu equipo
                        </p>
                        <Button onClick={generarCodigo} disabled={generandoCodigo} className="w-full">
                            {generandoCodigo ? 'Generando...' : 'Generar Invitacion'}
                        </Button>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Codigo de invitacion</p>
                        <p className="text-2xl font-bold text-primary mb-5 tracking-widest font-mono">{codigoInvitacion}</p>
                        {linkInvitacion && (
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(linkInvitacion)}`}
                                alt="QR Code"
                                className="w-36 h-36 mx-auto mb-4 rounded-lg"
                            />
                        )}
                        <p className="text-xs text-muted-foreground mb-3">El chofer puede escanear el QR o usar el link</p>
                        <div className="bg-muted rounded-lg p-3 mb-5">
                            <p className="text-xs text-muted-foreground break-all font-mono">{linkInvitacion}</p>
                        </div>
                        <Button onClick={copiarLink} className="w-full" variant={linkCopiado ? 'outline' : 'default'}>
                            {linkCopiado ? <><Check className="size-4 mr-1.5" /> Link Copiado</> : <><Copy className="size-4 mr-1.5" /> Copiar Link</>}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-4">Este codigo expira en 7 dias y solo puede usarse una vez</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
