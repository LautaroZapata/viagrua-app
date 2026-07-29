'use client'
import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * Ultima red de contencion: se usa cuando el error ocurre en el layout raiz,
 * donde error.tsx no llega. Reemplaza el <html> entero, asi que no puede
 * apoyarse en nada del layout ni en componentes compartidos.
 *
 * Los estilos van inline a proposito: si lo que fallo es la carga del CSS, unas
 * clases de Tailwind no servirian de nada.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // El error del layout raiz no pasa por onRequestError ni por el error.tsx
    // de ninguna ruta, asi que si no se reporta aca no se reporta en ningun
    // lado: la app queda rota y en Sentry no aparece nada.
    Sentry.captureException(error)
    console.error('Error global:', error)
  }, [error])

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#F6F7F9',
          color: '#1A1D23',
        }}
      >
        <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Algo salió mal
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#61687A', marginBottom: '1.5rem' }}>
            Ocurrió un error inesperado. Probá de nuevo; si sigue pasando, escribinos.
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#61687A', marginBottom: '1.5rem' }}>
              Código de referencia: <code>{error.digest}</code>
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: '#FF7A00',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
