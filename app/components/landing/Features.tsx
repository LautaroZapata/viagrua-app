'use client'

import { motion } from 'motion/react'
import { ClipboardList, Users, Receipt, Download } from 'lucide-react'

const features = [
  {
    icon: ClipboardList,
    title: 'Traslados',
    description: 'Creá y seguí cada traslado con fotos, estados y control de pagos. Todo desde tu celular.',
  },
  {
    icon: Users,
    title: 'Choferes',
    description: 'Invitálos con un código QR, asignales trabajo y sabé exactamente qué está haciendo cada uno.',
  },
  {
    icon: Receipt,
    title: 'Gastos',
    description: 'Registrá combustible, peajes, seguro. Conocé la rentabilidad real de tu negocio mes a mes.',
  },
  {
    icon: Download,
    title: 'Exportación CSV',
    description: 'Descargá un respaldo completo de todos tus movimientos, listo para abrir en Excel o Google Sheets.',
  },
]

export function Features() {
  return (
    <section id="features" className="py-20 sm:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
            Todo lo que necesitás para gestionar tu flota
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Desde crear un traslado hasta saber cuánto ganaste este mes. Todo en una sola app.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
              }}
              className="rounded-xl border border-border bg-card p-6 hover:shadow-md hover:border-primary/20 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
