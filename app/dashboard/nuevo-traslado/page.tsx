'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { compressImage, formatFileSize } from '@/lib/compressImage'

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

const PLANES: Record<string, { nombre: string; traslados_max: number | null; } > = {
    free: {
        nombre: 'Free',
        traslados_max: 30,
    },
    mensual: {
        nombre: 'Pago Mensual',
        traslados_max: null,
    },
    anual: {
        nombre: 'Pago Anual',
        traslados_max: null,
    },
};

export default function NuevoTraslado() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [choferes, setChoferes] = useState<Chofer[]>([])
    const [empresaId, setEmpresaId] = useState<string>('')
    const [userId, setUserId] = useState<string>('')
    const [perfil, setPerfil] = useState<any | null>(null)
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
    
    // Departamentos de Uruguay
    const departamentos = [
        'Artigas', 'Canelones', 'Cerro Largo', 'Colonia', 'Durazno',
        'Flores', 'Florida', 'Lavalleja', 'Maldonado', 'Montevideo',
        'Paysandú', 'Río Negro', 'Rivera', 'Rocha', 'Salto',
        'San José', 'Soriano', 'Tacuarembó', 'Treinta y Tres'
    ]
    
    // Estados para fotos
    const [fotos, setFotos] = useState<{ [key: string]: FotoPreview | null }>({
        frontal: null,
        lateral: null,
        trasera: null,
        interior: null
    })
    const [comprimiendo, setComprimiendo] = useState<string | null>(null)
    
    // Refs para inputs file
    const inputRefs = {
        frontal: useRef<HTMLInputElement>(null),
        lateral: useRef<HTMLInputElement>(null),
        trasera: useRef<HTMLInputElement>(null),
        interior: useRef<HTMLInputElement>(null)
    }

    useEffect(() => { cargarDatos() }, [])

    const cargarDatos = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        setUserId(user.id)

        // Traer perfil completo para saber plan y traslados
        const { data: perfilData } = await supabase
            .from('perfiles')
            .select('*, plan, plan_renovacion, traslados_mes_actual')
            .eq('id', user.id).single()
        if (!perfilData) return
        setPerfil(perfilData)
        setEmpresaId(perfilData.empresa_id)

        // Traer choferes Y al admin (para que pueda asignarse a sí mismo)
        const { data } = await supabase
            .from('perfiles').select('id, nombre_completo, rol')
            .eq('empresa_id', perfilData.empresa_id)
            .in('rol', ['chofer', 'admin'])
        setChoferes(data || [])
    }

    // Manejar selección de foto
    const handleFotoChange = async (tipo: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setComprimiendo(tipo)
        
        try {
            // Comprimir imagen
            const compressedBlob = await compressImage(file, 1200, 0.7)
            
            // Crear preview
            const preview = URL.createObjectURL(compressedBlob)
            
            // Crear nuevo File desde el blob comprimido
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
            alert('Error al procesar la imagen')
        }
        
        setComprimiendo(null)
    }

    // Eliminar foto
    const eliminarFoto = (tipo: string) => {
        if (fotos[tipo]?.preview) {
            URL.revokeObjectURL(fotos[tipo]!.preview)
        }
        setFotos(prev => ({ ...prev, [tipo]: null }))
    }

    // Subir fotos a Supabase Storage
    const subirFotos = async (trasladoId: string): Promise<{ [key: string]: string }> => {
        const urls: { [key: string]: string } = {}
        
        for (const [tipo, fotoData] of Object.entries(fotos)) {
            if (fotoData) {
                const fileName = `${trasladoId}/${tipo}_${Date.now()}.jpg`
                const { error } = await supabase.storage
                    .from('fotos-traslados')
                    .upload(fileName, fotoData.file)
                
                if (error) {
                    console.error(`Error subiendo ${tipo}:`, error)
                    alert(`Error al subir foto ${tipo}: ${error.message}`)
                } else {
                    const { data: urlData } = supabase.storage
                        .from('fotos-traslados')
                        .getPublicUrl(fileName)
                    urls[`foto_${tipo}`] = urlData.publicUrl
                    console.log(`Foto ${tipo} subida:`, urlData.publicUrl)
                }
            }
        }
        
        return urls
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        // 1. Llamar al endpoint server-side que reserva el cupo y crea el traslado
        const resp = await fetch('/api/create-traslado-safe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                empresa_id: empresaId,
                chofer_id: formData.chofer_id,
                marca_modelo: formData.marca_modelo,
                matricula: formData.es_0km ? null : formData.matricula,
                es_0km: formData.es_0km,
                importe_total: formData.importe_total,
                observaciones: formData.observaciones,
                desde: formData.desde,
                hasta: formData.hasta
            })
        })

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}))
            alert('No se pudo crear el traslado: ' + (err.error || resp.statusText))
            setLoading(false)
            return
        }

        const { traslado } = await resp.json()

        // 2. Incrementar contador de traslados en el perfil (si aplica)
        if (planKey === 'free') {
            try {
                const nuevoContador = (perfil?.traslados_mes_actual || 0) + 1
                const { error: perfilError } = await supabase.from('perfiles')
                    .update({ traslados_mes_actual: nuevoContador })
                    .eq('id', userId)

                if (perfilError) {
                    // Revertir: eliminar el traslado creado
                    await supabase.from('traslados').delete().eq('id', traslado.id)
                    alert('No se pudo actualizar el contador de traslados: ' + perfilError.message)
                    setLoading(false)
                    return
                }
            } catch (err) {
                // Revertir si algo inesperado falla
                await supabase.from('traslados').delete().eq('id', traslado.id)
                console.error('Error actualizando contador de traslados:', err)
                alert('Error al actualizar contador de traslados')
                setLoading(false)
                return
            }
        }

        // 3. Subir fotos si hay alguna
        const hayFotos = Object.values(fotos).some(f => f !== null)
        if (hayFotos) {
            console.log('Subiendo fotos...')
            const fotoUrls = await subirFotos(traslado.id)
            console.log('URLs generadas:', fotoUrls)
            
            // 3. Actualizar traslado con URLs de fotos
            if (Object.keys(fotoUrls).length > 0) {
                const { error: updateError } = await supabase.from('traslados')
                    .update(fotoUrls)
                    .eq('id', traslado.id)

                if (updateError) {
                    console.error('Error guardando URLs:', updateError)
                    alert('Error al guardar URLs de fotos: ' + updateError.message)
                } else {
                    console.log('URLs guardadas correctamente')
                }
            }
        }

        router.push('/dashboard')
    }

    // --- Lógica de restricción de traslados ---
    const planKey = perfil?.plan || 'free';
    const planInfo = PLANES[planKey];
    const trasladosMax = planInfo.traslados_max;
    const trasladosUsados = perfil?.traslados_mes_actual || 0;
    const trasladosRestantes = trasladosMax !== null ? Math.max(trasladosMax - trasladosUsados, 0) : null;
    const bloqueoTraslados = planKey === 'free' && trasladosRestantes === 0;

    return (
        <div className="page-bg min-h-screen pb-8">
            {/* Navbar */}
            <nav className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-30">
                <div className="max-w-6xl mx-auto flex items-center gap-3">
                    <button onClick={() => router.push('/dashboard')} className="p-2 -ml-2 text-gray-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-base font-semibold text-gray-900">Nuevo Traslado</h1>
                </div>
            </nav>

            {/* Content */}
            <div className="w-full px-4 py-4 max-w-6xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Form - Left Column */}
                    <div className="card">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Detalles del Traslado</h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {planKey === 'free' && (
                                <div className="mb-2 p-2 rounded bg-yellow-50 text-yellow-800 text-xs">
                                    Traslados usados este mes: <b>{trasladosUsados}</b> / {trasladosMax}
                                    {bloqueoTraslados && (
                                        <span className="block text-red-600 font-bold mt-1">¡Has alcanzado el límite de traslados este mes! Actualiza tu plan para más beneficios.</span>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Marca y Modelo</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Toyota Corolla"
                                    className="input-field"
                                    value={formData.marca_modelo}
                                    onChange={(e) => setFormData({ ...formData, marca_modelo: e.target.value })}
                                />
                            </div>



                            <div>
                                <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition">
                                    <input
                                        type="checkbox"
                                        checked={formData.es_0km}
                                        onChange={(e) => setFormData({ ...formData, es_0km: e.target.checked, matricula: '' })}
                                        className="w-4 h-4 cursor-pointer accent-orange-500"
                                    />
                                    <span className="font-medium text-sm text-gray-900">Es un vehículo 0 KM</span>
                                </label>
                            </div>

                            {!formData.es_0km && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Matrícula</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: ABC-123"
                                        className="input-field"
                                        value={formData.matricula}
                                        onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Chofer Asignado</label>
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
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Importe Total</label>
                                <div className="currency-input">
                                    <span className="currency-symbol">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        name="importe"
                                        value={formData.importe_total}
                                        onChange={(e) => setFormData({ ...formData, importe_total: e.target.value })}
                                        className="w-full border rounded px-3 py-2 input-field"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Desde</label>
                                    <input
                                        type="text"
                                        placeholder="Origen del traslado"
                                        className="input-field"
                                        value={formData.desde}
                                        onChange={(e) => setFormData({ ...formData, desde: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Hasta</label>
                                    <input
                                        type="text"
                                        placeholder="Destino del traslado"
                                        className="input-field"
                                        value={formData.hasta}
                                        onChange={(e) => setFormData({ ...formData, hasta: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => router.push('/dashboard')} className="btn-secondary flex-1 py-2.5 text-sm">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={loading || bloqueoTraslados} className={`btn-primary flex-1 py-2.5 text-sm ${bloqueoTraslados ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    title={bloqueoTraslados ? 'Límite de traslados alcanzado este mes' : ''}>
                                    {loading ? 'Creando...' : 'Crear Traslado'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Inspección - Right Column */}
                    <div className="card">
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">Inspección</h2>
                        <p className="text-xs text-gray-500 mb-4">Adjunta fotos del estado (opcional)</p>

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
                                        <div className="relative group">
                                            <img
                                                src={fotos[tipo]!.preview}
                                                alt={tipo}
                                                className="w-full h-24 object-cover rounded-lg border-2 border-green-500"
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => eliminarFoto(tipo)}
                                                    className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition"
                                                >
                                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-center text-gray-500 mt-1">
                                                {formatFileSize(fotos[tipo]!.compressedSize || 0)}
                                            </p>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => inputRefs[tipo].current?.click()}
                                            disabled={comprimiendo === tipo}
                                            className="w-full h-24 border-2 border-dashed border-gray-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition text-center flex flex-col items-center justify-center"
                                        >
                                            {comprimiendo === tipo ? (
                                                <p className="text-xs text-gray-500">Comprimiendo...</p>
                                            ) : (
                                                <>
                                                    <svg className="w-6 h-6 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    <p className="font-medium text-[10px] text-gray-600 capitalize">{tipo}</p>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                            <p className="font-medium text-xs text-gray-700 mb-1.5">Observaciones</p>
                            <textarea
                                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-orange-500"
                                rows={3}
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