'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Camera, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BUCKET_FOTOS, TIPOS_FOTO, VIGENCIA_URL_FIRMADA, referenciasDeFoto, type FotoRef } from '@/lib/fotos'
import type { Tables } from '@/lib/db'

/**
 * Grilla de fotos de inspeccion con visor ampliado.
 *
 * Las URLs se firman en el momento de mostrar, no se guardan. El bucket es
 * privado: sin firma no se accede al archivo, y la firma solo la consigue quien
 * pasa las policies de storage, o sea alguien de la empresa dueña del traslado.
 *
 * Antes se guardaba la URL publica en la base y cualquiera con ese link veia la
 * foto sin iniciar sesion, incluidas las matriculas.
 */
export default function FotosTraslado({ traslado }: { traslado: Tables<'traslados'> }) {
    const [ampliada, setAmpliada] = useState<string | null>(null)
    const [urls, setUrls] = useState<Record<string, string> | null>(null)
    const [error, setError] = useState(false)

    // Se listan las rutas presentes, en el orden en que se muestran.
    // Una columna puede traer varias fotos: el formato viejo guardaba un array.
    const fotos: { clave: string; etiqueta: string; ref: FotoRef }[] = []
    for (const t of TIPOS_FOTO) {
        const refs = referenciasDeFoto(traslado[t.columna])
        refs.forEach((ref, i) => {
            const clave = ref.tipo === 'storage' ? ref.ruta : ref.url
            fotos.push({
                clave,
                etiqueta: refs.length > 1 ? `${t.etiqueta} ${i + 1}` : t.etiqueta,
                ref,
            })
        })
    }

    // Solo las de nuestro bucket necesitan firma; las externas ya son URLs.
    const claveRutas = fotos
        .filter((f) => f.ref.tipo === 'storage')
        .map((f) => f.clave)
        .join('|')

    useEffect(() => {
        if (!claveRutas) return
        let cancelado = false
        const rutas = claveRutas.split('|')

        supabase.storage
            .from(BUCKET_FOTOS)
            .createSignedUrls(rutas, VIGENCIA_URL_FIRMADA)
            .then(({ data, error: err }) => {
                if (cancelado) return
                if (err || !data) {
                    setError(true)
                    return
                }
                const mapa: Record<string, string> = {}
                for (const item of data) {
                    // path viene sin el prefijo del bucket, igual que lo pedimos.
                    if (item.signedUrl && item.path) mapa[item.path] = item.signedUrl
                }
                setUrls(mapa)
            })

        return () => { cancelado = true }
    }, [claveRutas])

    if (fotos.length === 0) return null

    return (
        <>
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Camera className="size-4 text-muted-foreground" />
                        Fotos de inspeccion
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {error ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4" role="alert">
                            <AlertTriangle className="size-4 text-destructive shrink-0" />
                            No se pudieron cargar las fotos. Probá recargar la página.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {fotos.map((f) => {
                                const url = f.ref.tipo === 'externa' ? f.ref.url : urls?.[f.ref.ruta]
                                if (!url) {
                                    return <Skeleton key={f.clave} className="w-full h-28 sm:h-36 rounded-lg" />
                                }
                                return (
                                    <button
                                        key={f.clave}
                                        type="button"
                                        onClick={() => setAmpliada(url)}
                                        aria-label={`Ampliar foto ${f.etiqueta.toLowerCase()}`}
                                        className="relative block w-full rounded-lg overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={url}
                                            alt={`Foto ${f.etiqueta.toLowerCase()} del vehiculo`}
                                            loading="lazy"
                                            className="w-full h-28 sm:h-36 object-cover hover:opacity-90 transition"
                                        />
                                        <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                                            {f.etiqueta}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!ampliada} onOpenChange={() => setAmpliada(null)}>
                <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
                    <DialogTitle className="sr-only">Foto ampliada</DialogTitle>
                    {ampliada && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ampliada} alt="Foto ampliada del vehiculo" className="w-full max-h-[90vh] object-contain" />
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
