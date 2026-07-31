import { describe, it, expect } from 'vitest'
import { verificarEsLocal } from '../e2e-preparar.mjs'

/**
 * Este freno es lo unico que separa "correr los E2E" de "sembrar y borrar datos
 * en la base que usa gente de verdad". Los tests dan de alta empresas, choferes
 * y traslados; si el destino fuera produccion, cada corrida ensuciaria la base
 * real.
 */

describe('verificarEsLocal', () => {
  it('acepta el stack local', () => {
    expect(verificarEsLocal('http://127.0.0.1:54421')).toBe('127.0.0.1')
    expect(verificarEsLocal('http://localhost:54421')).toBe('localhost')
  })

  it('frena el proyecto de produccion', () => {
    expect(() => verificarEsLocal('https://kqqaamnnmwyekvjzxuvy.supabase.co')).toThrow(/FRENO/)
  })

  it('frena cualquier proyecto de Supabase, no solo el actual', () => {
    // Si algun dia cambia el ref, el freno tiene que seguir agarrando.
    expect(() => verificarEsLocal('https://otroproyecto.supabase.co')).toThrow(/FRENO/)
  })

  it('frena un host que solo empieza parecido a localhost', () => {
    // localhost.atacante.com resuelve donde quiera el atacante, y un prefijo
    // suelto lo daria por bueno.
    expect(() => verificarEsLocal('http://localhost.ejemplo.com')).toThrow(/FRENO/)
  })

  it('falla claro si la URL no parsea', () => {
    expect(() => verificarEsLocal('no-es-una-url')).toThrow(/no parsea/)
  })
})
