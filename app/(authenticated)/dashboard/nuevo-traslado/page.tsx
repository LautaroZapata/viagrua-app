'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { compressImage, formatFileSize } from '@/lib/compressImage'
import { confirmDelete, showError } from '@/lib/swal'
import { sanitizeString, isValidImporte, isValidMatricula, isValidFecha, LIMITS } from '@/lib/validation'
import { useUser } from '@/app/components/UserContext'
import AppHeader from '@/app/components/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Camera, X } from 'lucide-react'

interface Chofer { id: string; nombre_completo: string; rol?: string }
interface FotoPreview { file: File; preview: string; compressedSize?: number }

export default function NuevoTraslado() {
    const router = useRouter()
    const { user, perfil } = useUser()
    const [loading, setLoading] = useState(false)
    const [choferes, setChoferes] = useState<Chofer[]>([])
    const [formData, setFormData] = useState({
        marca_modelo: '', matricula: '', es_0km: false, chofer_id: '',
        importe_total: '', observaciones: '', desde: '', hasta: ''
    })
    const [fechaPersonalizada, setFechaPersonalizada] = useState(false)
    const [fechaValor, setFechaValor] = useState('')
    const today = new Date().toISOString().split('T')[0]
    const [fotos, setFotos] = useState<{ [key: string]: FotoPreview | null }>({ frontal: null, lateral: null, trasera: null, interior: null })
    const [comprimiendo, setComprimiendo] = useState<string | null>(null)
    const inputRefs = {
        frontal: useRef<HTMLInputElement>(null), lateral: useRef<HTMLInputElement>(null),
        trasera: useRef<HTMLInputElement>(null), interior: useRef<HTMLInputElement>(null),
    }

    useEffect(() => { return () => { Object.values(fotos).forEach(f => { if (f) URL.revokeObjectURL(f.preview) }) } }, [])

    useEffect(() => {
        if (!perfil?.empresa_id) return
        const load = async () => {
            const { data } = await supabase.from('perfiles').select('id, nombre_completo, rol')
                .eq('empresa_id', perfil.empresa_id).in('rol', ['chofer', 'admin'])
            setChoferes(data || [])
        }
        load()
    }, [perfil?.empresa_id])

    const handleFotoChange = async (tipo: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setComprimiendo(tipo)
        try {
            const blob = await compressImage(file, 1200, 0.7)
            const preview = URL.createObjectURL(blob)
            setFotos(p => ({ ...p, [tipo]: { file: new File([blob], file.name, { type: 'image/jpeg' }), preview, compressedSize: blob.size } }))
        } catch { showError('Error al procesar la imagen') }
        setComprimiendo(null)
    }

    const eliminarFoto = async (tipo: string) => {
        const ok = await confirmDelete({ title: 'Quitar foto', text: `¿Eliminar la foto ${tipo}?`, confirmButtonText: 'Si, quitar' })
        if (!ok) return
        if (fotos[tipo]?.preview) URL.revokeObjectURL(fotos[tipo]!.preview)
        setFotos(p => ({ ...p, [tipo]: null }))
    }

    const subirFotos = async (trasladoId: string) => {
        const urls: { [key: string]: string } = {}
        for (const [tipo, d] of Object.entries(fotos)) {
            if (d) {
                const name = `${trasladoId}/${tipo}_${Date.now()}.jpg`
                const { error } = await supabase.storage.from('fotos-traslados').upload(name, d.file)
                if (error) showError(`Error subiendo ${tipo}: ${error.message}`)
                else { const { data } = supabase.storage.from('fotos-traslados').getPublicUrl(name); urls[`foto_${tipo}`] = data.publicUrl }
            }
        }
        return urls
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !perfil) return
        const mm = sanitizeString(formData.marca_modelo)
        const mat = sanitizeString(formData.matricula)
        const obs = sanitizeString(formData.observaciones)
        const desde = sanitizeString(formData.desde)
        const hasta = sanitizeString(formData.hasta)

        if (!mm || mm.length > LIMITS.marcaModelo) { showError('Marca/Modelo requerido (max. 100)'); return }
        if (!formData.es_0km && mat && !isValidMatricula(mat)) { showError('Matricula invalida'); return }
        if (!formData.chofer_id) { showError('Selecciona un chofer'); return }
        if (formData.importe_total && !isValidImporte(formData.importe_total)) { showError('Importe invalido'); return }
        if (obs.length > LIMITS.observaciones) { showError('Observaciones muy largas'); return }
        if (desde.length > LIMITS.ubicacion) { showError('Origen muy largo'); return }
        if (hasta.length > LIMITS.ubicacion) { showError('Destino muy largo'); return }
        if (fechaPersonalizada && (!fechaValor || !isValidFecha(fechaValor) || fechaValor > today)) { showError('Fecha invalida'); return }

        setLoading(true)
        const resp = await fetch('/api/create-traslado-safe', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user.id, empresa_id: perfil.empresa_id, chofer_id: formData.chofer_id,
                marca_modelo: mm, matricula: formData.es_0km ? null : mat, es_0km: formData.es_0km,
                importe_total: formData.importe_total, observaciones: obs || null,
                desde: desde || null, hasta: hasta || null, fecha: fechaPersonalizada ? fechaValor : null,
            })
        })
        if (!resp.ok) { const err = await resp.json().catch(() => ({})); showError('Error: ' + (err.error || resp.statusText)); setLoading(false); return }
        const { traslado } = await resp.json()
        if (Object.values(fotos).some(f => f !== null)) {
            const urls = await subirFotos(traslado.id)
            if (Object.keys(urls).length) await supabase.from('traslados').update(urls).eq('id', traslado.id)
        }
        router.push('/dashboard/traslados')
    }

    return (
        <>
            <AppHeader breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Nuevo Traslado' }]} />
            <div className="page-enter p-4 sm:p-6 max-w-2xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Detalles del Traslado</CardTitle></CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="marca">Marca y Modelo</Label>
                                    <Input id="marca" required maxLength={LIMITS.marcaModelo} placeholder="Ej: Toyota Corolla"
                                        value={formData.marca_modelo} onChange={e => setFormData({ ...formData, marca_modelo: e.target.value })} />
                                </div>
                                <label className="flex items-center gap-3 cursor-pointer p-3 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition">
                                    <input type="checkbox" checked={formData.es_0km}
                                        onChange={e => setFormData({ ...formData, es_0km: e.target.checked, matricula: '' })}
                                        className="size-4 cursor-pointer accent-primary" />
                                    <span className="font-medium text-sm text-foreground">Es un vehiculo 0 KM</span>
                                </label>
                                {!formData.es_0km && (
                                    <div className="space-y-2">
                                        <Label htmlFor="matricula">Matricula</Label>
                                        <Input id="matricula" maxLength={LIMITS.matricula} placeholder="Ej: ABC-123"
                                            value={formData.matricula} onChange={e => setFormData({ ...formData, matricula: e.target.value })} />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label htmlFor="chofer">Chofer Asignado</Label>
                                    <select id="chofer" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        value={formData.chofer_id} onChange={e => setFormData({ ...formData, chofer_id: e.target.value })}>
                                        <option value="">Selecciona un chofer</option>
                                        {choferes.map(c => <option key={c.id} value={c.id}>{c.nombre_completo}{c.id === user?.id ? ' (Yo)' : ''}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="importe">Importe Total</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                        <Input id="importe" type="number" step="0.01" min="0" required className="pl-7"
                                            value={formData.importe_total} onChange={e => setFormData({ ...formData, importe_total: e.target.value })} />
                                    </div>
                                </div>
                                <Separator />
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="desde">Desde</Label>
                                        <Input id="desde" maxLength={LIMITS.ubicacion} placeholder="Origen"
                                            value={formData.desde} onChange={e => setFormData({ ...formData, desde: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="hasta">Hasta</Label>
                                        <Input id="hasta" maxLength={LIMITS.ubicacion} placeholder="Destino"
                                            value={formData.hasta} onChange={e => setFormData({ ...formData, hasta: e.target.value })} />
                                    </div>
                                </div>
                                <label className="flex items-center gap-3 cursor-pointer p-3 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition">
                                    <input type="checkbox" checked={fechaPersonalizada}
                                        onChange={e => { setFechaPersonalizada(e.target.checked); if (e.target.checked && !fechaValor) setFechaValor(today) }}
                                        className="size-4 cursor-pointer accent-primary shrink-0" />
                                    <span className="font-medium text-sm text-foreground">Registrar en fecha anterior</span>
                                </label>
                                {fechaPersonalizada && (
                                    <div className="space-y-2">
                                        <Label htmlFor="fecha">Fecha del traslado</Label>
                                        <Input id="fecha" type="date" required max={today} value={fechaValor} onChange={e => setFechaValor(e.target.value)} />
                                        <p className="text-xs text-muted-foreground">Solo fechas anteriores o de hoy.</p>
                                    </div>
                                )}
                                <div className="flex gap-2 pt-2">
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => router.push('/dashboard')}>Cancelar</Button>
                                    <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Creando...' : 'Crear Traslado'}</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2"><Camera className="size-4 text-muted-foreground" />Inspeccion</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground mb-4">Adjunta fotos del estado (opcional)</p>
                            <div className="grid grid-cols-2 gap-2">
                                {(['frontal', 'lateral', 'trasera', 'interior'] as const).map(tipo => (
                                    <div key={tipo}>
                                        <input ref={inputRefs[tipo]} type="file" accept="image/*" className="hidden" onChange={e => handleFotoChange(tipo, e)} />
                                        {fotos[tipo] ? (
                                            <div className="relative">
                                                <img src={fotos[tipo]!.preview} alt={tipo} className="w-full h-24 object-cover rounded-lg border-2 border-emerald-500" />
                                                <button type="button" onClick={() => eliminarFoto(tipo)}
                                                    className="absolute top-1 right-1 size-6 bg-destructive hover:bg-destructive/80 rounded-full flex items-center justify-center shadow-md transition"
                                                    aria-label={`Eliminar foto ${tipo}`}><X className="size-3.5 text-white" /></button>
                                                <p className="text-[10px] text-center text-muted-foreground mt-1">{formatFileSize(fotos[tipo]!.compressedSize || 0)}</p>
                                            </div>
                                        ) : (
                                            <button type="button" onClick={() => inputRefs[tipo].current?.click()} disabled={comprimiendo === tipo}
                                                className="w-full h-24 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition text-center flex flex-col items-center justify-center">
                                                {comprimiendo === tipo ? <p className="text-xs text-muted-foreground">Comprimiendo...</p> : (
                                                    <><Camera className="size-5 text-muted-foreground/50 mb-1" /><p className="font-medium text-[10px] text-muted-foreground capitalize">{tipo}</p></>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4">
                                <Label htmlFor="obs">Observaciones</Label>
                                <Textarea id="obs" className="mt-1.5" rows={3} maxLength={LIMITS.observaciones} placeholder="Notas adicionales..."
                                    value={formData.observaciones} onChange={e => setFormData({ ...formData, observaciones: e.target.value })} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    )
}
