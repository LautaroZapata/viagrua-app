'use client'

import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function Hero() {
  return (
    <section className="min-h-dvh pt-16 sm:pt-20 flex items-center relative overflow-hidden bg-[#14161C]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[70%] bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/15 text-primary text-sm font-medium rounded-full mb-6">
              <span className="w-2 h-2 bg-primary rounded-full" />
              Para empresas de grúas en Uruguay
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1] mb-6">
              Sabé qué hace cada chofer{' '}
              <span className="text-primary">sin tener que llamarlo</span>
            </h1>

            <p className="text-lg sm:text-xl text-white/60 leading-relaxed mb-8 max-w-lg">
              ViaGrúa te muestra los traslados en curso, los gastos de cada camión y la rentabilidad de tu negocio. Todo desde el celular.
            </p>

            <div className="flex flex-wrap gap-3">
              {/* Al formulario de alta de esta misma pagina, no a /login:
                  quien todavia no tiene cuenta caia en una pantalla que le
                  pedia credenciales que no tiene. */}
              <Link href="#registro">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 px-8 py-6 text-base">
                  Comenzar gratis <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="border-white/10 text-white/70 hover:text-white hover:bg-white/5 px-8 py-6 text-base">
                  Ver características
                </Button>
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
            className="flex justify-center lg:justify-end"
          >
            <div className="relative w-[270px] sm:w-[300px]">
              <div className="relative rounded-[2.5rem] border-4 border-gray-700 bg-[#F6F7F9] shadow-2xl shadow-black/40 overflow-hidden" style={{ aspectRatio: '9/19.5' }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-700 rounded-b-xl z-10" />

                <div className="h-full pt-6 pb-3 px-3">
                  <div className="flex justify-between items-center mb-3 px-1">
                    <span className="text-[11px] font-semibold text-gray-800">9:41</span>
                    <span className="text-[11px] font-semibold text-gray-800">87%</span>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-900">Dashboard</h3>
                    <span className="text-[10px] text-primary font-medium">Hoy</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 mb-4">
                    <div className="bg-white rounded-lg p-2.5 text-center shadow-sm border border-gray-100">
                      <div className="text-lg font-bold text-primary">15</div>
                      <div className="text-[9px] text-gray-400 font-medium">Total</div>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 text-center shadow-sm border border-gray-100">
                      <div className="text-lg font-bold text-amber-500">8</div>
                      <div className="text-[9px] text-gray-400 font-medium">Pend.</div>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 text-center shadow-sm border border-gray-100">
                      <div className="text-lg font-bold text-blue-500">3</div>
                      <div className="text-[9px] text-gray-400 font-medium">Curso</div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { name: 'Toyota Corolla', plate: 'ABC123', status: 'En curso', color: 'text-blue-500', bg: 'bg-blue-50', dot: 'bg-blue-500' },
                      { name: 'VW Gol', plate: 'XYZ789', status: 'Pendiente', color: 'text-amber-500', bg: 'bg-amber-50', dot: 'bg-amber-500' },
                      { name: 'Fiat Uno', plate: 'DEF456', status: 'Completado', color: 'text-green-600', bg: 'bg-green-50', dot: 'bg-green-500' },
                    ].map((item) => (
                      <div key={item.plate} className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-[11px] font-semibold text-gray-900">{item.name}</div>
                            <div className="text-[10px] text-gray-400">{item.plate}</div>
                          </div>
                          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${item.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                            <span className={`text-[9px] font-medium ${item.color}`}>{item.status}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 flex justify-around border-t border-gray-100 pt-2">
                    {['\u{1F3E0}', '\u{1F4CB}', '\u{1F4CA}', '\u{1F464}'].map((icon, i) => (
                      <span key={i} className={`text-sm ${i === 0 ? 'opacity-100' : 'opacity-30'}`}>{icon}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
