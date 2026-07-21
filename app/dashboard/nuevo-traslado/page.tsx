'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { compressImage, formatFileSize } from '@/lib/compressImage'
import { confirmDelete, showError } from '@/lib/swal'
import { sanitizeString, isValidImporte, isValidMatricula, isValidFecha, LIMITS } from '@/lib/validation'
import { ArrowLeft, Camera, X, Truck } from 'lucide-react'

interface Chofer {
    id: string
    nombre_completo: string
    rol?: string
}

interface FotoPreview {
    file: File
    preview: string
    compressedSize?: number
}

export default function NuevoTraslado() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [choferes, setChoferes] = useState<Chofer[]>([])
    const [empresaId, setEmpresaId] = useState<string>('')
    const [userId, setUserId] = useState<string>('')
    const [perfil, setPerfil] = useState<{ empresa_id: string } | null>(null)
    const [formData, setFormData] = useState({
        marca_modelo: '',
        matricula: '',
        es_0km: false,
        chofer_id: '',
        importe_total: '',
        observaciones: '',
        desde: '',
        hasta: ''
    })
    const [fechaPersonalizada, setFechaPersonalizada] = useState(false)
    const [fechaValor, setFechaValor] = useState('')
    const today = new Date().toISOString().split('T')[0]

    const [fotos, setFotos] = useState<{ [key: string]: FotoPreview | null }>({
        frontal: null,
        lateral: null,
        trasera: null,
        interior: null
    })
    const [comprimiendo, setComprimiendo] = useState<string | null>(null)

    const inputRefs = {
        frontal: useRef<HTMLInputElement>(null),
        lateral: useRef<HTMLInputElement>(null),
        trasera: useRef<HTMLInputElement>(null),
        interior: useRef<HTMLInputElement>(null)
    }

    useEffect(() => {
        return () => {
            Object.values(fotos).forEach(fotoData => {
                if (fotoData) URL.revokeObjectURL(fotoData.preview);
            });
        };
    }, []);

    useEffect(() => {
        const cargarDatos = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }

            setUserId(user.id)

            const { data: perfilData } = await supabase
                .from('perfiles')
                .select('id, empresa_id')
                .eq('id', user.id).single()
            if (!perfilData) return
            setPerfil(perfilData)
            setEmpresaId(perfilData.empresa_id)

            const { data } = await supabase
                .from('perfiles').select('id, nombre_completo, rol')
                .eq('empresa_id', perfilData.empresa_id)
                .in('rol', ['chofer', 'admin'])
            setChoferes(data || [])
        }
        cargarDatos()
    }, [])

    const handleFotoChange = async (tipo: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setComprimiendo(tipo)

        try {
            const compressedBlob = await compressImage(file, 1200, 0.7)
            const preview = URL.createObjectURL(compressedBlob)
            const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' })

            setFotos(prev => ({
                ...prev,
                [tipo]: {
                    file: compressedFile,
                    preview,
                    compressedSize: compressedBlob.size
                }
            }))
        } catch (error) {
            console.error('Error al comprimir:', error)
            showError('Error al procesar la imagen')
        }

        setComprimiendo(null)
    }

    const eliminarFoto = async (tipo: string) => {
        const ok = await confirmDelete({
            title: 'Quitar foto',
            text: `¿Eliminar la foto ${tipo}?`,
            confirmButtonText: 'Si, quitar',
        })
        if (!ok) return
        if (fotos[tipo]?.preview) {
            URL.revokeObjectURL(fotos[tipo]!.preview)
        }
        setFotos(prev => ({ ...prev, [tipo]: null }))
    }

    const subirFotos = async (trasladoId: string): Promise<{ [key: string]: string }> => {
        const urls: { [key: string]: string } = {}

        for (const [tipo, fotoData] of Object.entries(fotos)) {
            if (fotoData) {
                const fileName = `${trasladoId}/${tipo}_${Date.now()}.jpg`;
                const { error } = await supabase.storage
                    .from('fotos-traslados')
                    .upload(fileName, fotoData.file)

                if (error) {
                    console.error(`Error subiendo ${tipo}:`, error)
                    showError(`Error al subir foto ${tipo}: ${error.message}`)
                } else {
                    const { data: urlData } = supabase.storage
                        .from('fotos-traslados')
                        .getPublicUrl(fileName)
                    urls[`foto_${tipo}`] = urlData.publicUrl
                }
            }
        }

        return urls
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const marcaModelo = sanitizeString(formData.marca_modelo)
        const matricula = sanitizeString(formData.matricula)
        const observaciones = sanitizeString(formData.observaciones)
        const desde = sanitizeString(formData.desde)
        const hasta = sanitizeString(formData.hasta)

        if (!marcaModelo || marcaModelo.length > LIMITS.marcaModelo) {
            showError('Marca/Modelo es requerido (max. 100 caracteres)'); return
        }
        if (!formData.es_0km && matricula && !isValidMatricula(matricula)) {
            showError('Matricula invalida (solo letras, numeros y guiones, max. 15)'); return
        }
        if (!formData.chofer_id) { showError('Selecciona un chofer'); return }
        if (formData.importe_total && !isValidImporte(formData.importe_total)) {
            showError('Importe invalido'); return
        }
        if (observaciones.length > LIMITS.observaciones) { showError('Observaciones demasiado largas (max. 1000)'); return }
        if (desde.length > LIMITS.ubicacion) { showError('Origen demasiado largo (max. 200)'); return }
        if (hasta.length > LIMITS.ubicacion) { showError('Destino demasiado largo (max. 200)'); return }
        if (fechaPersonalizada) {
            if (!fechaValor || !isValidFecha(fechaValor)) { showError('Fecha invalida'); return }
            if (fechaValor > today) { showError('La fecha no puede ser futura'); return }
        }

        setLoading(true)

        const resp = await fetch('/api/create-traslado-safe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                empresa_id: empresaId,
                chofer_id: formData.chofer_id,
                marca_modelo: marcaModelo,
                matricula: formData.es_0km ? null : matricula,
                es_0km: formData.es_0km,
                importe_total: formData.importe_total,
                observaciones: observaciones || null,
                desde: desde || null,
                hasta: hasta || null,
                fecha: fechaPersonalizada ? fechaValor : null,
            })
        })

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}))
            showError('No se pudo crear el traslado: ' + (err.error || resp.statusText))
            setLoading(false)
            return
        }

        const { traslado } = await resp.json()

        const hayFotos = Object.values(fotos).some(f => f !== null)
        if (hayFotos) {
            const fotoUrls = await subirFotos(traslado.id)

            if (Object.keys(fotoUrls).length > 0) {
                const { error: updateError } = await supabase.from('traslados')
                    .update(fotoUrls)
                    .eq('id', traslado.id)

                if (updateError) {
                    console.error('Error guardando URLs:', updateError)
                    showError('Error al guardar URLs de fotos: ' + updateError.message)
                }
            }
        }

        router.push('/dashboard')
    }

    return (
        <div className="min-h-screen bg-background pb-8">
            {/* Navbar */}
            <nav className="navbar sticky top-0 z-30">
                <div className="flex items-center gap-3 w-full px-4 sm:px-6 lg:px-8 py-3">
                    <button onClick={() => router.push('/dashboard')} className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                        <Truck className="w-4 h-4 text-white" />
                    </div>
                    <h1 className="text-sm sm:text-base font-semibold text-white">Nuevo Traslado</h1>
                </div>
            </nav>

            {/* Content */}
            <div className="page-enter w-full min-w-0 max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Form */}
                    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                        <h2 className="text-base font-semibold text-foreground mb-4">Detalles del Traslado</h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Marca y Modelo</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={LIMITS.marcaModelo}
                                    placeholder="Ej: Toyota Corolla"
                                    className="input-field"
                                    value={formData.marca_modelo}
                                    onChange={(e) => setFormData({ ...formData, marca_modelo: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-3 cursor-pointer p-3 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition">
                                    <input
                                        type="checkbox"
                                        checked={formData.es_0km}
                                        onChange={(e) => setFormData({ ...formData, es_0km: e.target.checked, matricula: '' })}
                                        className="w-4 h-4 cursor-pointer accent-primary"
                                    />
                                    <span className="font-medium text-sm text-foreground">Es un vehiculo 0 KM</span>
                                </label>
                            </div>

                            {!formData.es_0km && (
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Matricula</label>
                                    <input
                                        type="text"
                                        maxLength={LIMITS.matricula}
                                        placeholder="Ej: ABC-123"
                                        className="input-field"
                                        value={formData.matricula}
                                        onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Chofer Asignado</label>
                                <select
                                    required
                                    className="input-field"
                                    value={formData.chofer_id}
                                    onChange={(e) => setFormData({ ...formData, chofer_id: e.target.value })}
                                >
                                    <option value="">Selecciona un chofer</option>
                                    {choferes.map((chofer) => (
                                        <option key={chofer.id} value={chofer.id}>
                                            {chofer.nombre_completo} {chofer.id === userId ? '(Yo mismo)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Importe Total</label>
                                <div className="currency-input">
                                    <span className="currency-symbol">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        name="importe"
                                        value={formData.importe_total}
                                        onChange={(e) => setFormData({ ...formData, importe_total: e.target.value })}
                                        className="input-field"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Desde</label>
                                    <input
                                        type="text"
                                        maxLength={LIMITS.ubicacion}
                                        placeholder="Origen del traslado"
                                        className="input-field"
                                        value={formData.desde}
                                        onChange={(e) => setFormData({ ...formData, desde: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Hasta</label>
                                    <input
                                        type="text"
                                        maxLength={LIMITS.ubicacion}
                                        placeholder="Destino del traslado"
                                        className="input-field"
                                        value={formData.hasta}
                                        onChange={(e) => setFormData({ ...formData, hasta: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-3 cursor-pointer p-3 border border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition">
                                    <input
                                        type="checkbox"
                                        checked={fechaPersonalizada}
                                        onChange={(e) => {
                                            setFechaPersonalizada(e.target.checked)
                                            if (e.target.checked && !fechaValor) setFechaValor(today)
                                        }}
                                        className="w-4 h-4 cursor-pointer accent-primary shrink-0"
                                    />
                                    <span className="font-medium text-sm text-foreground">Registrar en fecha anterior</span>
                                </label>
                                {fechaPersonalizada && (
                                    <div className="mt-2">
                                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Fecha del traslado</label>
                                        <input
                                            type="date"
                                            required
                                            max={today}
                                            value={fechaValor}
                                            onChange={(e) => setFechaValor(e.target.value)}
                                            className="input-field w-full"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Solo fechas anteriores o de hoy.</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => router.push('/dashboard')} className="btn-secondary flex-1 py-2.5 text-sm">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={loading} className="btn-primary flex-1 py-2.5 text-sm">
                                    {loading ? 'Creando...' : 'Crear Traslado'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Inspeccion */}
                    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                        <div className="flex items-center gap-2 mb-1">
                            <Camera className="w-4 h-4 text-muted-foreground" />
                            <h2 className="text-base font-semibold text-foreground">Inspeccion</h2>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">Adjunta fotos del estado (opcional)</p>

                        <div className="grid grid-cols-2 gap-2">
                            {(['frontal', 'lateral', 'trasera', 'interior'] as const).map((tipo) => (
                                <div key={tipo}>
                                    <input
                                        ref={inputRefs[tipo]}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleFotoChange(tipo, e)}
                                    />

                                    {fotos[tipo] ? (
                                        <div className="relative">
                                            <img
                                                src={fotos[tipo]!.preview}
                                                alt={tipo}
                                                className="w-full h-24 object-cover rounded-lg border-2 border-emerald-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => eliminarFoto(tipo)}
                                                className="absolute top-1 right-1 w-6 h-6 bg-destructive hover:bg-destructive/80 rounded-full flex items-center justify-center shadow-md transition touch-manipulation"
                                                aria-label={`Eliminar foto ${tipo}`}
                                            >
                                                <X className="w-3.5 h-3.5 text-white" />
                                            </button>
                                            <p className="text-[10px] text-center text-muted-foreground mt-1">
                                                {formatFileSize(fotos[tipo]!.compressedSize || 0)}
                                            </p>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => inputRefs[tipo].current?.click()}
                                            disabled={comprimiendo === tipo}
                                            className="w-full h-24 border-2 border-dashed border-border rounded-lg hover:border-primary/50 hover:bg-primary/5 transition text-center flex flex-col items-center justify-center"
                                        >
                                            {comprimiendo === tipo ? (
                                                <p className="text-xs text-muted-foreground">Comprimiendo...</p>
                                            ) : (
                                                <>
                                                    <Camera className="w-5 h-5 text-muted-foreground/50 mb-1" />
                                                    <p className="font-medium text-[10px] text-muted-foreground capitalize">{tipo}</p>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                            <p className="font-medium text-xs text-muted-foreground mb-1.5">Observaciones</p>
                            <textarea
                                className="w-full border border-border bg-card rounded-lg p-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition"
                                rows={3}
                                maxLength={LIMITS.observaciones}
                                placeholder="Notas adicionales..."
                                value={formData.observaciones}
                                onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
