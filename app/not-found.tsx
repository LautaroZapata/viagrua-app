import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="text-center max-w-sm">
                <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                    <FileQuestion className="w-8 h-8 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Pagina no encontrada</h1>
                <p className="text-sm text-muted-foreground mb-6">La pagina que buscas no existe o fue movida.</p>
                <Link href="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
                    Ir al inicio
                </Link>
            </div>
        </div>
    )
}
