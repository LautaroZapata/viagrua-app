'use client'

interface LoadingSpinnerProps {
  message?: string
  submessage?: string
}

export default function LoadingSpinner({ message = 'Cargando', submessage = 'Verificando sesión y cargando datos...' }: LoadingSpinnerProps) {
  return (
    <div className="page-bg flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-orange-200 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full absolute top-0 left-0 animate-spin"></div>
        </div>
        <div className="text-center">
          <p className="text-gray-700 font-semibold">{message}</p>
          <p className="text-gray-400 text-sm">{submessage}</p>
        </div>
      </div>
    </div>
  )
}
