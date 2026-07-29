import { describe, it, expect } from 'vitest'
import { seleccionarVencidos } from '../backup-storage.mjs'

/**
 * La poda es lo unico de todo el backup que borra algo, y borra lo que se
 * supone que es la ultima copia de la base. Los casos que importan no son los
 * felices, son aquellos en los que la regla podria comerse mas de la cuenta.
 */

const HOY = '2026-07-29'
const RETENCION = 30

function nombre(fecha: string) {
  return `viagrua-${fecha}.tar.gz`
}

/** Genera N dumps diarios consecutivos terminando el dia anterior a `hasta`. */
function diarios(cantidad: number, hasta = HOY): string[] {
  const salida: string[] = []
  const d = new Date(`${hasta}T00:00:00Z`)
  for (let i = 0; i < cantidad; i++) {
    salida.push(nombre(d.toISOString().slice(0, 10)))
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return salida
}

describe('seleccionarVencidos', () => {
  it('no borra nada cuando todos entran en la retencion', () => {
    const { total, vencidos } = seleccionarVencidos(diarios(30), HOY, RETENCION)
    expect(total).toBe(30)
    expect(vencidos).toEqual([])
  })

  it('borra los que pasaron los 30 dias y conserva el resto', () => {
    const { vencidos } = seleccionarVencidos(
      [...diarios(30), nombre('2026-06-01'), nombre('2026-05-15')],
      HOY,
      RETENCION
    )
    expect(vencidos).toEqual([nombre('2026-06-01'), nombre('2026-05-15')])
  })

  it('deja pasar el dia exacto del corte y borra el anterior', () => {
    // 30 dias antes del 2026-07-29 es el 2026-06-29.
    const { fechaCorte, vencidos } = seleccionarVencidos(
      [...diarios(7), nombre('2026-06-29'), nombre('2026-06-28')],
      HOY,
      RETENCION
    )
    expect(fechaCorte).toBe('2026-06-29')
    expect(vencidos).toEqual([nombre('2026-06-28')])
  })

  it('conserva los 7 mas nuevos aunque esten todos vencidos', () => {
    // El escenario que justifica el piso: la app estuvo meses sin backups y el
    // cron vuelve a correr. Sin piso, la primera corrida borra todo lo que hay.
    const viejos = diarios(10, '2026-01-10')
    const { vencidos } = seleccionarVencidos(viejos, HOY, RETENCION)
    expect(vencidos).toHaveLength(3)
    // Los 7 mas nuevos del lote sobreviven.
    expect(vencidos).not.toContain(nombre('2026-01-10'))
    expect(vencidos).toContain(nombre('2026-01-01'))
  })

  it('nunca deja el bucket vacio', () => {
    for (const cantidad of [1, 3, 7]) {
      const { vencidos } = seleccionarVencidos(diarios(cantidad, '2020-01-01'), HOY, RETENCION)
      expect(vencidos).toEqual([])
    }
  })

  it('ignora archivos que no nombro el workflow', () => {
    const { total, vencidos } = seleccionarVencidos(
      [
        ...diarios(8),
        'notas.txt',
        'viagrua-2020-01-01.tar.gz.bak',
        'manual-2020-01-01.tar.gz',
        'viagrua-antes-de-migrar.tar.gz',
      ],
      HOY,
      RETENCION
    )
    expect(total).toBe(8)
    expect(vencidos).toEqual([])
  })
})
