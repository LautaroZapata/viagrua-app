'use client'
import { useEffect } from 'react'

/**
 * Registra el Service Worker de la PWA.
 * Se monta una sola vez en el RootLayout como componente vacío.
 * Solo actúa en producción y cuando el navegador soporta SW.
 */
export default function PwaRegister() {
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!('serviceWorker' in navigator)) return

        // Registrar después del primer paint para no bloquear la carga inicial
        const registerSW = async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                    updateViaCache: 'none', // Siempre pedir el SW al servidor (no usar caché HTTP)
                })

                // Verificar actualizaciones cada vez que el usuario vuelve a la app
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing
                    if (!newWorker) return

                    newWorker.addEventListener('statechange', () => {
                        if (
                            newWorker.state === 'installed' &&
                            navigator.serviceWorker.controller
                        ) {
                            // Hay una nueva versión disponible — recargar silenciosamente
                            // para que el usuario siempre tenga la última versión
                            newWorker.postMessage({ type: 'SKIP_WAITING' })
                            window.location.reload()
                        }
                    })
                })
            } catch (err) {
                console.warn('[ViaGrua SW] Error al registrar:', err)
            }
        }

        if (document.readyState === 'complete') {
            registerSW()
        } else {
            window.addEventListener('load', registerSW, { once: true })
        }
    }, [])

    return null
}
