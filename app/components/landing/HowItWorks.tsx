'use client'

import { motion } from 'motion/react'
import { UserPlus, ClipboardList, Users, BarChart3 } from 'lucide-react'

const steps = [
  { icon: UserPlus, title: 'Registrate', description: 'Crea tu cuenta gratis en menos de 2 minutos. Sin tarjeta.' },
  { icon: Users, title: 'Invitá choferes', description: 'Compartí el código QR con tus choferes. Se unen al instante.' },
  { icon: ClipboardList, title: 'Gestioná traslados', description: 'Creá, asigná y seguí cada traslado en tiempo real.' },
  { icon: BarChart3, title: 'Controlá resultados', description: 'Ingresos, gastos, rentabilidad por chofer. Todo visible.' },
]

export function HowItWorks() {
  return (
    <section className="py-20 sm:py-32 bg-muted/50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
            Empezá en 4 pasos
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            En menos de 5 minutos tenés tu empresa configurada y tus choferes invitados.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 relative">
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-border">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0" />
          </div>

          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="text-center relative"
            >
              <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center mx-auto mb-5 relative z-10 shadow-lg shadow-primary/20">
                <s.icon className="w-6 h-6" />
              </div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s', animationDelay: `${i * 0.3}s` }} />
              <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
