'use client'

import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/mes',
    description: 'Para dueños que manejan su propia grúa.',
    features: [
      '1 administrador',
      '1 chofer',
      '15 traslados por mes',
      'Dashboard básico',
      'Registro de gastos',
    ],
    cta: 'Comenzar gratis',
    featured: false,
  },
  {
    name: 'Premium',
    price: '$15',
    period: '/mes',
    description: 'Para flotas con varios choferes.',
    features: [
      '1 administrador',
      'Choferes ilimitados',
      'Traslados ilimitados',
      'Dashboard completo con analytics',
      'Exportación CSV',
      'Registro de gastos ilimitado',
    ],
    cta: 'Elegir Premium',
    featured: true,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="py-20 sm:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
            Sin sorpresas. Precios simples.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Empezás gratis. Cuando crezcas, pasás a Premium. Sin contratos ni compromisos.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className={`rounded-2xl border p-8 relative ${
                p.featured
                  ? 'border-primary/30 bg-card shadow-xl shadow-primary/5 ring-1 ring-primary/20'
                  : 'border-border bg-card'
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                  Más popular
                </div>
              )}

              <h3 className="text-lg font-semibold text-foreground mb-1">{p.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{p.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">{p.price}</span>
                <span className="text-muted-foreground text-sm">{p.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link href="#registro">
                <Button
                  className={`w-full ${
                    p.featured
                      ? 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {p.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
