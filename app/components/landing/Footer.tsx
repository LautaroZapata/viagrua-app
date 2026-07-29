import { Truck } from 'lucide-react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-[#14161C] text-white/60 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-white">ViaGrúa</span>
          </div>

          <nav className="flex items-center gap-6 text-sm">
            <Link href="/terminos" className="hover:text-white transition-colors">Términos</Link>
            <Link href="/privacidad" className="hover:text-white transition-colors">Privacidad</Link>
            <a href="mailto:hola@viagrua.com" className="hover:text-white transition-colors">Contacto</a>
          </nav>

          <p className="text-sm">&copy; {new Date().getFullYear()} ViaGrúa. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
