'use client'

import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function CTA() {
  return (
    <section className="py-20 sm:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background pointer-events-none" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-4">
            Empezá a controlar tu flota hoy
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Creá tu cuenta gratis en menos de 2 minutos. No necesitas tarjeta de crédito.
          </p>
          <Link href="#registro">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 px-8 py-6 text-base">
              Comenzar gratis — es gratis, siempre
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
