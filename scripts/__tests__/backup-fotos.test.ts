import { describe, it, expect } from 'vitest'
import { seleccionarFaltantes } from '../backup-fotos.mjs'

/**
 * Esta funcion no borra nada, pero decide que se respalda. Un falso "ya esta"
 * deja una foto sin copia para siempre, y eso recien se descubre el dia que hay
 * que restaurar. Los casos que importan son los de rutas que se parecen.
 */

const MAX = 2000

describe('seleccionarFaltantes', () => {
  it('copia todo cuando el destino esta vacio', () => {
    const { total, copiadas, faltantes } = seleccionarFaltantes(
      ['emp1/a.jpg', 'emp1/b.jpg'],
      [],
      MAX
    )
    expect(total).toBe(2)
    expect(copiadas).toBe(0)
    expect(faltantes).toEqual(['emp1/a.jpg', 'emp1/b.jpg'])
  })

  it('no copia lo que ya esta respaldado', () => {
    const { faltantes, copiadas } = seleccionarFaltantes(
      ['emp1/a.jpg', 'emp1/b.jpg'],
      ['fotos/emp1/a.jpg'],
      MAX
    )
    expect(copiadas).toBe(1)
    expect(faltantes).toEqual(['emp1/b.jpg'])
  })

  it('no copia nada cuando el respaldo esta al dia', () => {
    const { faltantes } = seleccionarFaltantes(
      ['emp1/a.jpg'],
      ['fotos/emp1/a.jpg'],
      MAX
    )
    expect(faltantes).toEqual([])
  })

  it('ignora lo que hay en backups fuera del prefijo fotos/', () => {
    // El bucket comparte lugar con los dumps de la base. Un dump que se llamara
    // parecido a una foto no puede hacer pasar esa foto por respaldada.
    const { copiadas, faltantes } = seleccionarFaltantes(
      ['emp1/a.jpg'],
      ['viagrua-2026-07-29.tar.gz', 'emp1/a.jpg'],
      MAX
    )
    expect(copiadas).toBe(0)
    expect(faltantes).toEqual(['emp1/a.jpg'])
  })

  it('distingue rutas con el mismo nombre en distinta empresa', () => {
    // Las fotos se aislaron por empresa: frontal.jpg existe en todas. Comparar
    // por nombre de archivo y no por ruta completa dejaria sin copia a todas
    // menos una.
    const { faltantes } = seleccionarFaltantes(
      ['emp1/frontal.jpg', 'emp2/frontal.jpg', 'emp3/frontal.jpg'],
      ['fotos/emp1/frontal.jpg'],
      MAX
    )
    expect(faltantes).toEqual(['emp2/frontal.jpg', 'emp3/frontal.jpg'])
  })

  it('no confunde un prefijo con una ruta completa', () => {
    const { faltantes } = seleccionarFaltantes(
      ['emp1/foto.jpg', 'emp10/foto.jpg'],
      ['fotos/emp1/foto.jpg'],
      MAX
    )
    expect(faltantes).toEqual(['emp10/foto.jpg'])
  })

  it('corta en el tope y reporta lo que queda pendiente', () => {
    const origen = Array.from({ length: 10 }, (_, i) => `emp1/${i}.jpg`)
    const { faltantes, pendientes } = seleccionarFaltantes(origen, [], 4)
    expect(faltantes).toHaveLength(4)
    expect(pendientes).toBe(6)
  })

  it('no reporta pendientes cuando todo entra en el tope', () => {
    const { pendientes } = seleccionarFaltantes(['emp1/a.jpg'], [], 4)
    expect(pendientes).toBe(0)
  })

  it('aguanta un bucket de origen vacio', () => {
    const { total, faltantes, pendientes } = seleccionarFaltantes([], ['fotos/emp1/a.jpg'], MAX)
    expect(total).toBe(0)
    expect(faltantes).toEqual([])
    expect(pendientes).toBe(0)
  })
})
